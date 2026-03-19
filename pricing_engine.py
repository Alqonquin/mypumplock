"""
Gas Price Shield — Pricing Engine

Prices consumer gas price protection plans using an adapted Black-Scholes model.
The consumer is effectively buying a call option on gasoline: the right to buy
at a fixed "max price" (strike) regardless of where the market moves.

Product structure:
    - Fixed 6-month policy term
    - One upfront payment (no monthly billing — prevents mid-policy cancellation)
    - User chooses: max price (strike) + vehicle/weekly miles (determines gallons)
    - Payout = (pump price - max price) × gallons, whenever pump price > max price

Adapted BSM formula:
    C = e^(-qt) * S₀ * N(d₁) - K * e^(-rt) * N(d₂)

Where:
    S₀  = Current local gas price (spot)
    K   = User's chosen max price (strike)
    r   = Risk-free rate (3-month T-bill yield)
    q   = Cost of carry / seasonal adjustment factor
    t   = Policy duration in years (0.5 for standard 6-month term)
    σ   = Implied volatility of RBOB gasoline futures
    N() = Cumulative standard normal distribution
"""

import math
from dataclasses import dataclass
from scipy.stats import norm


# --- Volatility regime constants ---

# WHY: Gasoline volatility swings dramatically by market conditions.
# These bands are calibrated from historical RBOB options data (2015-2025).
VOLATILITY_LOW = 0.25       # Calm market (stable supply, no geopolitical risk)
VOLATILITY_NORMAL = 0.40    # Typical conditions
VOLATILITY_HIGH = 0.65      # Hurricane season, OPEC disputes, sanctions
VOLATILITY_CRISIS = 1.00    # War, pandemic, refinery disasters

# WHY: Seasonal premiums reflect the predictable April-June "summer blend"
# price increase. EIA data shows ~15-25¢/gal average seasonal lift.
# In BSM, a LOWER q increases the forward price (and thus the call value).
# So summer months get NEGATIVE q adjustments (expected price rise → cheaper
# to carry → higher forward → more expensive insurance).
SEASONAL_ADJUSTMENTS = {
    1:  0.00,   # January — winter baseline
    2: -0.01,   # February — slight uptick as refineries prep
    3: -0.02,   # March — transition begins
    4: -0.04,   # April — summer blend switchover starts
    5: -0.05,   # May — Memorial Day driving season ramp
    6: -0.05,   # June — peak summer demand
    7: -0.04,   # July — sustained high demand
    8: -0.03,   # August — demand begins tapering
    9: -0.01,   # September — back to winter blend
    10: 0.00,   # October — baseline
    11: 0.01,   # November — low demand, prices typically drop
    12: 0.01,   # December — low demand, prices typically drop
}

# WHY: Operational load covers tech stack, payment processing, compliance,
# and customer support. 5¢/gal is conservative for a fintech startup.
DEFAULT_OPERATIONAL_LOAD = 0.05  # $/gallon

# WHY: 3¢/gal profit margin targets ~15-20% gross margin on a typical
# 20¢ total premium, competitive with insurance industry norms.
DEFAULT_PROFIT_MARGIN = 0.03    # $/gallon

# WHY: Adverse selection buffer accounts for the fact that consumers sign up
# when they expect prices to rise. 10% uplift is based on insurance industry
# adverse selection loads for voluntary products.
DEFAULT_ADVERSE_SELECTION_LOAD = 0.10  # 10% multiplier on fair value


# WHY: 6 months is the fixed policy term. Long enough to make hedging
# economical and prevent adverse selection gaming, short enough that
# consumers don't balk at the upfront cost. Aligns with RBOB futures
# contract horizons.
POLICY_TERM_MONTHS = 6


@dataclass
class PricingInputs:
    """User-defined and market-derived inputs for pricing a protection plan."""
    spot_price: float           # Current local gas price ($/gal)
    strike_price: float         # User's chosen max price ($/gal)
    gallons_per_month: float    # Max gallons covered per month
    volatility: float           # Annualized implied volatility (decimal)
    risk_free_rate: float       # Annualized risk-free rate (decimal, e.g. 0.05)
    policy_months: int = POLICY_TERM_MONTHS  # Fixed 6-month term
    current_month: int = 1     # For seasonal adjustment lookup
    operational_load: float = DEFAULT_OPERATIONAL_LOAD
    profit_margin: float = DEFAULT_PROFIT_MARGIN
    adverse_selection_load: float = DEFAULT_ADVERSE_SELECTION_LOAD


@dataclass
class PricingResult:
    """Complete breakdown of a protection plan price."""
    # Per-gallon components
    fair_value_per_gallon: float        # Raw BSM option value
    seasonal_adj_per_gallon: float      # Seasonal cost-of-carry adjustment
    adverse_selection_per_gallon: float  # Adverse selection buffer
    operational_load_per_gallon: float   # Ops cost
    profit_margin_per_gallon: float      # Margin
    total_premium_per_gallon: float      # All-in per-gallon cost

    # Policy totals
    upfront_price: float                # One-time payment for the full policy term
    monthly_equivalent: float           # upfront_price / policy_months (for display)
    total_gallons_covered: float        # gallons_per_month × policy_months
    gallons_per_month: float            # Monthly gallon cap
    policy_months: int                  # Duration (fixed at 6)

    # Risk metrics (Greeks adapted for gas)
    delta: float        # Sensitivity to gas price changes
    gamma: float        # Rate of change of delta
    vega: float         # Sensitivity to volatility changes
    theta: float        # Time decay per day
    probability_itm: float  # Probability the option finishes in-the-money

    # Key inputs echoed back
    spot_price: float
    strike_price: float
    volatility: float


def _black_scholes_call(
    S: float, K: float, r: float, q: float, sigma: float, t: float
) -> tuple[float, float, float]:
    """
    Compute the Black-Scholes call option price with cost-of-carry.

    Returns: (call_price, d1, d2)
    """
    if t <= 0:
        # WHY: At expiration, the option is worth its intrinsic value only
        intrinsic = max(S - K, 0)
        return intrinsic, 0.0, 0.0

    if sigma <= 0:
        # WHY: Zero volatility means deterministic outcome
        if S * math.exp((r - q) * t) > K:
            return S * math.exp(-q * t) - K * math.exp(-r * t), float('inf'), float('inf')
        return 0.0, float('-inf'), float('-inf')

    sqrt_t = math.sqrt(t)
    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * t) / (sigma * sqrt_t)
    d2 = d1 - sigma * sqrt_t

    call_price = (
        S * math.exp(-q * t) * norm.cdf(d1)
        - K * math.exp(-r * t) * norm.cdf(d2)
    )

    return call_price, d1, d2


def _compute_greeks(
    S: float, K: float, r: float, q: float, sigma: float, t: float,
    d1: float, d2: float
) -> dict:
    """
    Compute option Greeks adapted for gas price sensitivity analysis.

    Delta: If gas moves $0.10, how much does your per-gallon cost change?
    Gamma: How fast does delta itself change? (convexity risk)
    Vega:  If volatility jumps 1%, how much does the premium change?
    Theta: How much value does the option lose per day?
    """
    if t <= 0 or sigma <= 0:
        return {"delta": 0.0, "gamma": 0.0, "vega": 0.0, "theta": 0.0}

    sqrt_t = math.sqrt(t)
    n_d1 = norm.pdf(d1)  # Standard normal density at d1

    delta = math.exp(-q * t) * norm.cdf(d1)

    gamma = (math.exp(-q * t) * n_d1) / (S * sigma * sqrt_t)

    # WHY: Vega expressed per 1% vol change (divide by 100) for readability
    vega = S * math.exp(-q * t) * n_d1 * sqrt_t / 100.0

    theta_daily = -(
        (S * sigma * math.exp(-q * t) * n_d1) / (2 * sqrt_t)
        + r * K * math.exp(-r * t) * norm.cdf(d2)
        - q * S * math.exp(-q * t) * norm.cdf(d1)
    ) / 365.0  # WHY: Convert annual theta to daily for intuitive reporting

    return {
        "delta": delta,
        "gamma": gamma,
        "vega": vega,
        "theta": theta_daily,
    }


def price_protection_plan(inputs: PricingInputs) -> PricingResult:
    """
    Price a gas price protection plan for a consumer.

    The consumer picks:
        - A max price (strike): "I never want to pay more than $X"
        - A volume cap (gallons/month): "Cover up to Y gallons"

    The engine returns a monthly premium using adapted Black-Scholes,
    with operational costs, adverse selection buffer, and profit margin
    layered on top.
    """
    t = inputs.policy_months / 12.0  # Convert months to years

    # Seasonal cost-of-carry adjustment
    seasonal_q = SEASONAL_ADJUSTMENTS.get(inputs.current_month, 0.0)

    # Core BSM calculation
    call_price, d1, d2 = _black_scholes_call(
        S=inputs.spot_price,
        K=inputs.strike_price,
        r=inputs.risk_free_rate,
        q=seasonal_q,
        sigma=inputs.volatility,
        t=t,
    )

    fair_value = max(call_price, 0.0)

    # Adverse selection uplift
    adverse_adj = fair_value * inputs.adverse_selection_load

    # Seasonal adjustment contribution (already baked into BSM via q,
    # but we surface it for transparency)
    seasonal_contribution = fair_value - max(
        _black_scholes_call(
            S=inputs.spot_price,
            K=inputs.strike_price,
            r=inputs.risk_free_rate,
            q=0.0,  # No seasonal adjustment
            sigma=inputs.volatility,
            t=t,
        )[0],
        0.0,
    )

    # Total per-gallon premium
    total_per_gallon = (
        fair_value
        + adverse_adj
        + inputs.operational_load
        + inputs.profit_margin
    )

    # Total gallons over the full policy term
    total_gallons = inputs.gallons_per_month * inputs.policy_months

    # One-time upfront price for the full policy
    upfront_price = total_per_gallon * total_gallons

    # Greeks
    greeks = _compute_greeks(
        S=inputs.spot_price,
        K=inputs.strike_price,
        r=inputs.risk_free_rate,
        q=seasonal_q,
        sigma=inputs.volatility,
        t=t,
        d1=d1,
        d2=d2,
    )

    # Probability of finishing in-the-money (gas exceeds strike)
    prob_itm = norm.cdf(d2) if t > 0 and inputs.volatility > 0 else 0.0

    return PricingResult(
        fair_value_per_gallon=round(fair_value, 4),
        seasonal_adj_per_gallon=round(seasonal_contribution, 4),
        adverse_selection_per_gallon=round(adverse_adj, 4),
        operational_load_per_gallon=round(inputs.operational_load, 4),
        profit_margin_per_gallon=round(inputs.profit_margin, 4),
        total_premium_per_gallon=round(total_per_gallon, 4),
        upfront_price=round(upfront_price, 2),
        monthly_equivalent=round(upfront_price / inputs.policy_months, 2),
        total_gallons_covered=round(total_gallons, 1),
        gallons_per_month=inputs.gallons_per_month,
        policy_months=inputs.policy_months,
        delta=round(greeks["delta"], 4),
        gamma=round(greeks["gamma"], 4),
        vega=round(greeks["vega"], 4),
        theta=round(greeks["theta"], 4),
        probability_itm=round(prob_itm, 4),
        spot_price=inputs.spot_price,
        strike_price=inputs.strike_price,
        volatility=inputs.volatility,
    )


def generate_sensitivity_table(
    base_inputs: PricingInputs,
    price_shocks: list[float] | None = None,
    vol_shocks: list[float] | None = None,
) -> list[dict]:
    """
    Generate a sensitivity matrix showing how the monthly premium changes
    across different spot price and volatility scenarios.

    Returns a list of dicts suitable for tabular display.
    """
    if price_shocks is None:
        # WHY: ±20% covers most non-crisis scenarios; ±40% covers major shocks
        price_shocks = [-0.40, -0.20, -0.10, 0.0, 0.10, 0.20, 0.40]
    if vol_shocks is None:
        vol_shocks = [-0.15, -0.10, 0.0, 0.10, 0.15, 0.25]

    results = []
    for ps in price_shocks:
        for vs in vol_shocks:
            shocked_inputs = PricingInputs(
                spot_price=round(base_inputs.spot_price * (1 + ps), 4),
                strike_price=base_inputs.strike_price,
                gallons_per_month=base_inputs.gallons_per_month,
                volatility=max(base_inputs.volatility + vs, 0.05),
                risk_free_rate=base_inputs.risk_free_rate,
                policy_months=base_inputs.policy_months,
                current_month=base_inputs.current_month,
                operational_load=base_inputs.operational_load,
                profit_margin=base_inputs.profit_margin,
                adverse_selection_load=base_inputs.adverse_selection_load,
            )
            result = price_protection_plan(shocked_inputs)
            results.append({
                "price_shock": f"{ps:+.0%}",
                "spot_price": shocked_inputs.spot_price,
                "vol_shock": f"{vs:+.0%}",
                "volatility": round(shocked_inputs.volatility, 2),
                "upfront_price": result.upfront_price,
                "fair_value_gal": result.fair_value_per_gallon,
                "prob_itm": f"{result.probability_itm:.1%}",
            })

    return results
