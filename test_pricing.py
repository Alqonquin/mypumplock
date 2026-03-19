"""
Tests for the Gas Price Shield pricing engine, vehicle database, and gas price lookup.
"""

import math
import pytest
from pricing_engine import (
    PricingInputs,
    POLICY_TERM_MONTHS,
    price_protection_plan,
    generate_sensitivity_table,
    _black_scholes_call,
)
from vehicles import (
    search_vehicles,
    get_unique_makes,
    get_models_for_make,
    estimate_monthly_gallons,
    VehicleSpec,
)
from gas_prices import lookup_price, lookup_price_by_state, lookup_price_by_metro


# -- Black-Scholes Core --

class TestBlackScholesCall:
    def test_at_the_money_produces_positive_value(self):
        """ATM options always have time value."""
        price, d1, d2 = _black_scholes_call(
            S=3.00, K=3.00, r=0.05, q=0.0, sigma=0.40, t=1/12
        )
        assert price > 0, "ATM call should have positive value"

    def test_deep_in_the_money(self):
        """Deep ITM call should be worth approximately intrinsic value."""
        price, _, _ = _black_scholes_call(
            S=5.00, K=3.00, r=0.05, q=0.0, sigma=0.40, t=1/12
        )
        intrinsic = 5.00 - 3.00
        assert price >= intrinsic * 0.95, "Deep ITM should be near intrinsic"

    def test_deep_out_of_the_money(self):
        """Deep OTM call should be near zero."""
        price, _, _ = _black_scholes_call(
            S=3.00, K=10.00, r=0.05, q=0.0, sigma=0.40, t=1/12
        )
        assert price < 0.01, "Deep OTM should be near zero"

    def test_higher_volatility_increases_price(self):
        """Higher vol = higher option price (all else equal)."""
        low_vol, _, _ = _black_scholes_call(
            S=3.00, K=3.50, r=0.05, q=0.0, sigma=0.20, t=1/12
        )
        high_vol, _, _ = _black_scholes_call(
            S=3.00, K=3.50, r=0.05, q=0.0, sigma=0.60, t=1/12
        )
        assert high_vol > low_vol, "Higher vol should increase call price"

    def test_longer_time_increases_price(self):
        """More time = more value (all else equal)."""
        short, _, _ = _black_scholes_call(
            S=3.00, K=3.50, r=0.05, q=0.0, sigma=0.40, t=1/12
        )
        long, _, _ = _black_scholes_call(
            S=3.00, K=3.50, r=0.05, q=0.0, sigma=0.40, t=6/12
        )
        assert long > short, "Longer duration should increase call price"

    def test_zero_time_returns_intrinsic(self):
        """At expiration, value = max(S-K, 0)."""
        itm, _, _ = _black_scholes_call(
            S=4.00, K=3.00, r=0.05, q=0.0, sigma=0.40, t=0
        )
        assert itm == pytest.approx(1.00, abs=0.001)

        otm, _, _ = _black_scholes_call(
            S=3.00, K=4.00, r=0.05, q=0.0, sigma=0.40, t=0
        )
        assert otm == 0.0

    def test_zero_volatility(self):
        """Zero vol, forward > strike: deterministic payoff."""
        price, _, _ = _black_scholes_call(
            S=4.00, K=3.00, r=0.05, q=0.0, sigma=0.0, t=1.0
        )
        assert price > 0, "ITM with zero vol should be positive"


# -- Plan Pricing (6-month upfront) --

class TestPlanPricing:
    def _base_inputs(self, **overrides) -> PricingInputs:
        defaults = dict(
            spot_price=3.00,
            strike_price=3.50,
            gallons_per_month=50,
            volatility=0.40,
            risk_free_rate=0.045,
            current_month=1,
        )
        defaults.update(overrides)
        return PricingInputs(**defaults)

    def test_default_is_6_month_term(self):
        result = price_protection_plan(self._base_inputs())
        assert result.policy_months == 6

    def test_upfront_price_is_positive(self):
        result = price_protection_plan(self._base_inputs())
        assert result.upfront_price > 0

    def test_upfront_equals_per_gallon_times_total_gallons(self):
        """Upfront price = per-gallon premium * gallons/month * months."""
        result = price_protection_plan(self._base_inputs())
        expected = result.total_premium_per_gallon * result.gallons_per_month * result.policy_months
        assert result.upfront_price == pytest.approx(expected, abs=0.02)

    def test_monthly_equivalent_is_upfront_divided_by_months(self):
        result = price_protection_plan(self._base_inputs())
        assert result.monthly_equivalent == pytest.approx(
            result.upfront_price / result.policy_months, abs=0.01
        )

    def test_total_gallons_covered(self):
        result = price_protection_plan(self._base_inputs(gallons_per_month=50))
        assert result.total_gallons_covered == pytest.approx(50 * 6, abs=0.1)

    def test_price_increases_with_gallons(self):
        low = price_protection_plan(self._base_inputs(gallons_per_month=30))
        high = price_protection_plan(self._base_inputs(gallons_per_month=100))
        assert high.upfront_price > low.upfront_price

    def test_price_increases_with_volatility(self):
        low = price_protection_plan(self._base_inputs(volatility=0.20))
        high = price_protection_plan(self._base_inputs(volatility=0.80))
        assert high.upfront_price > low.upfront_price

    def test_closer_strike_costs_more(self):
        """Strike closer to spot = more likely payout = higher premium."""
        tight = price_protection_plan(self._base_inputs(strike_price=3.10))
        wide = price_protection_plan(self._base_inputs(strike_price=4.00))
        assert tight.upfront_price > wide.upfront_price

    def test_all_components_are_non_negative(self):
        result = price_protection_plan(self._base_inputs())
        assert result.fair_value_per_gallon >= 0
        assert result.adverse_selection_per_gallon >= 0
        assert result.operational_load_per_gallon >= 0
        assert result.profit_margin_per_gallon >= 0

    def test_total_is_sum_of_components(self):
        result = price_protection_plan(self._base_inputs())
        expected = (
            result.fair_value_per_gallon
            + result.adverse_selection_per_gallon
            + result.operational_load_per_gallon
            + result.profit_margin_per_gallon
        )
        assert result.total_premium_per_gallon == pytest.approx(expected, abs=0.001)

    def test_probability_itm_between_0_and_1(self):
        result = price_protection_plan(self._base_inputs())
        assert 0 <= result.probability_itm <= 1

    def test_gemini_example_scenario(self):
        """Validate against the example from the Gemini conversation:
        S=3.00, K=3.25, sigma=50%, t=1mo -> fair value ~$0.12/gal.
        For 6-month term, fair value will be higher."""
        result = price_protection_plan(self._base_inputs(
            spot_price=3.00,
            strike_price=3.25,
            volatility=0.50,
            gallons_per_month=50,
        ))
        # 6-month BSM fair value should be meaningfully higher than 1-month
        assert result.fair_value_per_gallon > 0.10
        # Upfront price for 300 total gallons should be reasonable
        assert 30.0 < result.upfront_price < 200.0

    def test_summer_month_costs_more_than_winter(self):
        """Seasonal adjustment should make June more expensive than January."""
        winter = price_protection_plan(self._base_inputs(current_month=1))
        summer = price_protection_plan(self._base_inputs(current_month=6))
        assert summer.fair_value_per_gallon >= winter.fair_value_per_gallon


# -- Greeks --

class TestGreeks:
    def _inputs(self, **overrides):
        defaults = dict(
            spot_price=3.00, strike_price=3.50,
            gallons_per_month=50, volatility=0.40,
            risk_free_rate=0.045, current_month=1,
        )
        defaults.update(overrides)
        return PricingInputs(**defaults)

    def test_delta_between_0_and_1(self):
        result = price_protection_plan(self._inputs())
        assert 0 <= result.delta <= 1

    def test_vega_is_positive(self):
        result = price_protection_plan(self._inputs())
        assert result.vega > 0, "Vega should be positive for long call"

    def test_theta_is_negative(self):
        """Options lose value over time (theta decay)."""
        result = price_protection_plan(self._inputs())
        assert result.theta < 0, "Theta should be negative (time decay)"


# -- Sensitivity Table --

class TestSensitivity:
    def _inputs(self):
        return PricingInputs(
            spot_price=3.00, strike_price=3.50,
            gallons_per_month=50, volatility=0.40,
            risk_free_rate=0.045, current_month=1,
        )

    def test_generates_rows(self):
        rows = generate_sensitivity_table(self._inputs())
        assert len(rows) > 0
        assert "upfront_price" in rows[0]

    def test_baseline_row_matches_direct_calc(self):
        inputs = self._inputs()
        rows = generate_sensitivity_table(inputs)
        baseline = [r for r in rows if r["price_shock"] == "+0%" and r["vol_shock"] == "+0%"]
        assert len(baseline) == 1
        direct = price_protection_plan(inputs)
        assert baseline[0]["upfront_price"] == pytest.approx(direct.upfront_price, abs=0.01)


# -- Vehicle Database --

class TestVehicles:
    def test_search_by_make(self):
        results = search_vehicles(make="Toyota")
        assert len(results) > 0
        assert all("Toyota" in v.make for v in results)

    def test_search_by_make_model(self):
        results = search_vehicles(make="Ford", model="F-150")
        assert len(results) > 0
        assert all("F-150" in v.model for v in results)

    def test_search_by_year(self):
        results = search_vehicles(make="Honda", model="Civic", year=2024)
        assert len(results) == 1
        assert results[0].year == 2024

    def test_get_unique_makes(self):
        makes = get_unique_makes()
        assert "Toyota" in makes
        assert "Ford" in makes
        assert len(makes) > 5

    def test_get_models_for_make(self):
        models = get_models_for_make("Toyota")
        assert "Camry" in models
        assert "RAV4" in models

    def test_estimate_monthly_gallons(self):
        vehicle = VehicleSpec(2024, "Test", "Car", 14.0, 30, "regular")
        gallons = estimate_monthly_gallons(vehicle, weekly_miles=300)
        # 300 miles/week / 30 MPG = 10 gal/week * 4.33 = 43.3 gal/month
        assert gallons == pytest.approx(43.3, abs=0.5)

    def test_electric_vehicle_zero_gallons(self):
        ev = VehicleSpec(2024, "Tesla", "Model Y", 0.0, 0, "electric")
        gallons = estimate_monthly_gallons(ev, weekly_miles=300)
        assert gallons == 0.0

    def test_tank_cap_fraud_check(self):
        """Monthly gallons shouldn't exceed reasonable fill-ups x tank size."""
        f150 = search_vehicles(make="Ford", model="F-150", year=2024)[0]
        gallons = estimate_monthly_gallons(f150, weekly_miles=500)
        max_reasonable = f150.tank_gallons * 8  # 8 fill-ups/month is a lot
        assert gallons < max_reasonable


# -- Gas Price Lookup --

class TestGasPrices:
    def test_lookup_by_state(self):
        result = lookup_price_by_state("FL")
        assert result is not None
        assert result.price > 0
        assert result.source == "state"

    def test_lookup_by_metro(self):
        result = lookup_price_by_metro("Miami")
        assert result is not None
        assert result.area_name == "Miami, FL"
        assert result.source == "metro"

    def test_lookup_fallback_to_national(self):
        result = lookup_price("Atlantis")
        assert result.source == "national"
        assert result.price > 0

    def test_lookup_prefers_metro_over_state(self):
        result = lookup_price("Miami")
        assert result.source == "metro", "Metro match should take priority"

    def test_state_lookup_case_insensitive(self):
        result = lookup_price_by_state("fl")
        assert result is not None

    def test_california_more_expensive_than_texas(self):
        ca = lookup_price_by_state("CA")
        tx = lookup_price_by_state("TX")
        assert ca.price > tx.price, "CA gas should be pricier than TX"


# -- Product Rules --

class TestProductRules:
    """Tests for the fixed product structure: 6-month, upfront payment."""

    def test_policy_term_constant_is_6(self):
        assert POLICY_TERM_MONTHS == 6

    def test_no_monthly_billing_field(self):
        """PricingResult should not have a 'monthly_premium' field."""
        result = price_protection_plan(PricingInputs(
            spot_price=3.00, strike_price=3.50,
            gallons_per_month=50, volatility=0.40,
            risk_free_rate=0.045, current_month=1,
        ))
        assert not hasattr(result, 'monthly_premium'), \
            "Should not expose monthly_premium -- product is upfront only"

    def test_upfront_covers_full_6_months(self):
        """Upfront price should cover all 6 months of gallons."""
        result = price_protection_plan(PricingInputs(
            spot_price=3.00, strike_price=3.50,
            gallons_per_month=60, volatility=0.40,
            risk_free_rate=0.045, current_month=1,
        ))
        assert result.total_gallons_covered == pytest.approx(360, abs=0.1)
        assert result.policy_months == 6
