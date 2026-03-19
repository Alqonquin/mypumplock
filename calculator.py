"""
Gas Price Shield — Interactive CLI Calculator

User flow:
  1. Enter location -> auto-pulls local average gas price
  2. Enter vehicle (year/make/model) -> gets tank size + MPG
  3. Enter weekly miles -> calculates monthly gallons automatically
  4. Choose max price ("I never pay more than $X") -> prices the plan

Product: 6-month policy, one upfront payment, no monthly billing.
"""

import datetime
from pricing_engine import (
    PricingInputs,
    PricingResult,
    POLICY_TERM_MONTHS,
    price_protection_plan,
    generate_sensitivity_table,
    VOLATILITY_LOW,
    VOLATILITY_NORMAL,
    VOLATILITY_HIGH,
    VOLATILITY_CRISIS,
)
from vehicles import (
    VehicleSpec,
    search_vehicles,
    get_unique_makes,
    get_models_for_make,
    get_years_for_make_model,
    estimate_monthly_gallons,
)
from gas_prices import lookup_price, LocalPriceResult


def print_header():
    print()
    print("=" * 64)
    print("  GAS PRICE SHIELD")
    print(f"  {POLICY_TERM_MONTHS}-Month Protection Plan — One Upfront Payment")
    print("=" * 64)
    print()


def get_float(prompt: str, default: float | None = None) -> float:
    suffix = f" [{default}]" if default is not None else ""
    while True:
        raw = input(f"  {prompt}{suffix}: ").strip()
        if raw == "" and default is not None:
            return default
        try:
            val = float(raw)
            if val <= 0:
                print("    -> Must be a positive number.")
                continue
            return val
        except ValueError:
            print("    -> Please enter a valid number.")


# -- Step 1: Location & Gas Price --

def step_location() -> LocalPriceResult:
    print("  STEP 1: Where do you live?")
    print("  --------------------------")
    print("  Enter a city (e.g., 'Miami'), state code (e.g., 'FL'),")
    print("  or press Enter for the national average.")
    print()

    query = input("  Location: ").strip()
    if not query:
        query = "national"

    result = lookup_price(query)
    print()
    print(f"    Area:      {result.area_name}")
    print(f"    Avg price: ${result.price:.2f}/gal")
    print(f"    Source:    {result.source}")
    print()
    return result


# -- Step 2: Vehicle Selection --

def step_vehicle() -> VehicleSpec | None:
    print("  STEP 2: What do you drive?")
    print("  --------------------------")
    print()

    makes = get_unique_makes()
    print("  Available makes:")
    for i, make in enumerate(makes, 1):
        print(f"    {i:>2}) {make}")
    print()

    while True:
        raw = input("  Enter make name or number: ").strip()
        if not raw:
            continue
        try:
            idx = int(raw) - 1
            if 0 <= idx < len(makes):
                selected_make = makes[idx]
                break
        except ValueError:
            pass
        matches = [m for m in makes if raw.lower() in m.lower()]
        if len(matches) == 1:
            selected_make = matches[0]
            break
        elif len(matches) > 1:
            print(f"    -> Multiple matches: {', '.join(matches)}. Be more specific.")
        else:
            print(f"    -> '{raw}' not found. Pick from the list.")

    models = get_models_for_make(selected_make)
    print()
    print(f"  {selected_make} models:")
    for i, model in enumerate(models, 1):
        print(f"    {i:>2}) {model}")
    print()

    while True:
        raw = input("  Enter model name or number: ").strip()
        if not raw:
            continue
        try:
            idx = int(raw) - 1
            if 0 <= idx < len(models):
                selected_model = models[idx]
                break
        except ValueError:
            pass
        matches = [m for m in models if raw.lower() in m.lower()]
        if len(matches) == 1:
            selected_model = matches[0]
            break
        elif len(matches) > 1:
            print(f"    -> Multiple matches: {', '.join(matches)}. Be more specific.")
        else:
            print(f"    -> '{raw}' not found. Pick from the list.")

    years = get_years_for_make_model(selected_make, selected_model)
    print()
    print(f"  Available years for {selected_make} {selected_model}: {', '.join(str(y) for y in years)}")
    while True:
        raw = input(f"  Enter year [{years[0]}]: ").strip() or str(years[0])
        try:
            year = int(raw)
            if year in years:
                break
            print(f"    -> Year {year} not available. Choose from: {', '.join(str(y) for y in years)}")
        except ValueError:
            print("    -> Enter a valid year.")

    results = search_vehicles(make=selected_make, model=selected_model, year=year)
    if not results:
        print("    -> Vehicle not found in database.")
        return None

    vehicle = results[0]
    print()
    print(f"    {vehicle.year} {vehicle.make} {vehicle.model}")
    print(f"    Tank: {vehicle.tank_gallons} gal | MPG: {vehicle.combined_mpg} | Fuel: {vehicle.fuel_type}")

    if vehicle.fuel_type == "electric":
        print()
        print("    This is an electric vehicle -- no gas insurance needed!")
        return None

    print()
    return vehicle


# -- Step 3: Driving Habits --

def step_driving(vehicle: VehicleSpec) -> float:
    print("  STEP 3: How much do you drive?")
    print("  ------------------------------")
    print()

    weekly_miles = get_float("Weekly miles driven", default=250.0)
    monthly_gallons = estimate_monthly_gallons(vehicle, weekly_miles)

    monthly_miles = weekly_miles * 4.33
    fills_per_month = monthly_gallons / vehicle.tank_gallons if vehicle.tank_gallons > 0 else 0

    print()
    print(f"    Weekly miles:         {weekly_miles:.0f}")
    print(f"    Monthly miles:        {monthly_miles:.0f}")
    print(f"    Est. monthly gallons: {monthly_gallons:.1f}")
    print(f"    Est. fill-ups/month:  {fills_per_month:.1f}")
    print(f"    6-month total:        {monthly_gallons * POLICY_TERM_MONTHS:.0f} gallons covered")
    print()

    return monthly_gallons


# -- Step 4: Protection Level --

def step_protection(spot_price: float) -> tuple[float, float]:
    print("  STEP 4: Set your protection level")
    print("  ----------------------------------")
    print()
    print(f"  Your local avg. is ${spot_price:.2f}/gal.")
    print(f"  What's the MOST you'd want to pay per gallon?")
    print()
    print(f"  Examples:")
    print(f"    ${spot_price + 0.25:.2f} -- Aggressive (tight ceiling, higher premium)")
    print(f"    ${spot_price + 0.50:.2f} -- Moderate")
    print(f"    ${spot_price + 1.00:.2f} -- Catastrophic only (low premium)")
    print()

    strike = get_float("Your max price ($/gal)")

    if strike <= spot_price:
        print()
        print(f"    Your max (${strike:.2f}) is at or below the current price (${spot_price:.2f}).")
        print(f"    This means you're already 'in the money' -- the premium will be high")
        print(f"    because you'd get payouts starting immediately.")
        print()

    vol = get_volatility()
    print()

    return strike, vol


def get_volatility() -> float:
    print()
    print("  Volatility regime:")
    print(f"    1) Low    (calm market)        -- {VOLATILITY_LOW:.0%}")
    print(f"    2) Normal (typical conditions) -- {VOLATILITY_NORMAL:.0%}")
    print(f"    3) High   (hurricane/OPEC)     -- {VOLATILITY_HIGH:.0%}")
    print(f"    4) Crisis (war/pandemic)        -- {VOLATILITY_CRISIS:.0%}")
    print(f"    5) Custom")
    print()
    while True:
        choice = input("  Select volatility [2]: ").strip() or "2"
        if choice == "1":
            return VOLATILITY_LOW
        elif choice == "2":
            return VOLATILITY_NORMAL
        elif choice == "3":
            return VOLATILITY_HIGH
        elif choice == "4":
            return VOLATILITY_CRISIS
        elif choice == "5":
            return get_float("Enter custom volatility (decimal, e.g. 0.50)")
        else:
            print("    -> Pick 1-5.")


# -- Output --

def print_result(result: PricingResult, vehicle: VehicleSpec | None = None):
    print()
    print("=" * 64)
    print("  YOUR GAS PRICE SHIELD QUOTE")
    print("=" * 64)
    print()

    if vehicle:
        print(f"  Vehicle")
        print(f"    {vehicle.year} {vehicle.make} {vehicle.model}")
        print(f"    Tank: {vehicle.tank_gallons} gal | MPG: {vehicle.combined_mpg} | Fuel: {vehicle.fuel_type}")
        print()

    print(f"  Coverage")
    print(f"    Current avg. price:    ${result.spot_price:.2f}/gal")
    print(f"    Your max price:        ${result.strike_price:.2f}/gal")
    print(f"    Buffer:                ${result.strike_price - result.spot_price:+.2f}/gal")
    print(f"    Volatility:            {result.volatility:.0%}")
    print(f"    Policy term:           {result.policy_months} months")
    print(f"    Gallons/month:         {result.gallons_per_month:.0f}")
    print(f"    Total gallons covered: {result.total_gallons_covered:.0f}")
    print()

    print(f"  Per-Gallon Premium Breakdown")
    print(f"    Black-Scholes value:   ${result.fair_value_per_gallon:.4f}")
    print(f"    Seasonal adjustment:   ${result.seasonal_adj_per_gallon:.4f}")
    print(f"    Adverse selection:     ${result.adverse_selection_per_gallon:.4f}")
    print(f"    Operational cost:      ${result.operational_load_per_gallon:.4f}")
    print(f"    Profit margin:         ${result.profit_margin_per_gallon:.4f}")
    print(f"    ----------------------------------------")
    print(f"    TOTAL per gallon:      ${result.total_premium_per_gallon:.4f}")
    print()

    print(f"  +-----------------------------------------------+")
    print(f"  |                                               |")
    print(f"  |   6-MONTH PRICE:    ${result.upfront_price:>8.2f}  (one payment) |")
    print(f"  |   That's just       ${result.monthly_equivalent:>8.2f}/month          |")
    print(f"  |                                               |")
    print(f"  +-----------------------------------------------+")
    print()

    print(f"  Risk Metrics")
    print(f"    Delta:               {result.delta:.4f}   (price sensitivity)")
    print(f"    Gamma:               {result.gamma:.4f}   (delta acceleration)")
    print(f"    Vega:                {result.vega:.4f}   (volatility sensitivity)")
    print(f"    Theta:              {result.theta:.4f}   (daily time decay)")
    print(f"    Prob. of payout:     {result.probability_itm:.1%}")
    print()

    # Break-even analysis
    if result.total_premium_per_gallon > 0:
        breakeven_price = result.strike_price + result.total_premium_per_gallon
        pct_increase = ((breakeven_price / result.spot_price) - 1) * 100
        print(f"  Break-Even Analysis")
        print(f"    Gas must exceed ${breakeven_price:.2f}/gal for payouts to exceed your premium")
        print(f"    That's a {pct_increase:.1f}% increase from today's price")
        print()


def print_tier_comparison(spot: float, gallons: float, vol: float, rfr: float, month: int):
    print("-" * 64)
    print("  PLAN COMPARISON (same vehicle & miles, different max prices)")
    print("-" * 64)
    print()

    offsets = [0.10, 0.25, 0.50, 0.75, 1.00, 1.50, 2.00]

    print(f"  {'Max Price':>10} {'Buffer':>8} {'$/gal':>8} {'6-Mo Price':>11} {'~$/month':>9} {'P(ITM)':>8}")
    print(f"  {'----------':>10} {'--------':>8} {'--------':>8} {'-----------':>11} {'---------':>9} {'--------':>8}")

    for offset in offsets:
        strike = spot + offset
        inputs = PricingInputs(
            spot_price=spot,
            strike_price=strike,
            gallons_per_month=gallons,
            volatility=vol,
            risk_free_rate=rfr,
            current_month=month,
        )
        r = price_protection_plan(inputs)
        print(
            f"  ${strike:>8.2f}"
            f" {f'+${offset:.2f}':>8}"
            f" ${r.total_premium_per_gallon:>6.4f}"
            f" ${r.upfront_price:>9.2f}"
            f" ${r.monthly_equivalent:>7.2f}"
            f" {r.probability_itm:>7.1%}"
        )
    print()


def print_sensitivity(base_inputs: PricingInputs):
    print("-" * 64)
    print("  SENSITIVITY ANALYSIS")
    print("  How the 6-month price shifts across scenarios")
    print("-" * 64)
    print()

    rows = generate_sensitivity_table(base_inputs)

    print(f"  {'Price D':>8} {'Spot':>7} {'Vol D':>7} {'Vol':>6} {'6-Mo Price':>11} {'Fair/gal':>10} {'P(ITM)':>8}")
    print(f"  {'--------':>8} {'-------':>7} {'-------':>7} {'------':>6} {'-----------':>11} {'----------':>10} {'--------':>8}")
    for row in rows:
        print(
            f"  {row['price_shock']:>8}"
            f" ${row['spot_price']:>5.2f}"
            f" {row['vol_shock']:>7}"
            f" {row['volatility']:>5.0%}"
            f" ${row['upfront_price']:>9.2f}"
            f" ${row['fair_value_gal']:>8.4f}"
            f" {row['prob_itm']:>8}"
        )
    print()


# -- Main Flow --

def main():
    print_header()
    current_month = datetime.date.today().month

    # Step 1: Location
    local_price = step_location()
    spot = local_price.price

    # Step 2: Vehicle
    vehicle = step_vehicle()
    if vehicle is None:
        print("  Cannot price a plan without a gas-powered vehicle.")
        return

    # Step 3: Driving habits
    monthly_gallons = step_driving(vehicle)

    # Step 4: Protection level
    strike, vol = step_protection(spot)

    # WHY: 4.5% is approximately the 3-month T-bill yield as of early 2026
    rfr = 0.045

    # Build pricing inputs (6-month term is the default)
    inputs = PricingInputs(
        spot_price=spot,
        strike_price=strike,
        gallons_per_month=monthly_gallons,
        volatility=vol,
        risk_free_rate=rfr,
        current_month=current_month,
    )

    # Price the plan
    result = price_protection_plan(inputs)
    print_result(result, vehicle)

    # Tier comparison
    print_tier_comparison(spot, monthly_gallons, vol, rfr, current_month)

    # Sensitivity analysis
    show_sens = input("  Show sensitivity analysis? (y/n) [y]: ").strip().lower()
    if show_sens != "n":
        print_sensitivity(inputs)

    print("  Done.")
    print()


if __name__ == "__main__":
    main()
