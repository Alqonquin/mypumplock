/**
 * Gas Price Shield — Pricing Engine (TypeScript port)
 *
 * Prices consumer gas price protection plans using adapted Black-Scholes.
 * Product: 6-month policy, one upfront payment.
 *
 * C = e^(-qt) × S₀ × N(d₁) - K × e^(-rt) × N(d₂)
 */

// --- Standard Normal CDF (Abramowitz & Stegun approximation) ---
// WHY: Avoids external dependency for a single math function.
// Accurate to ~1e-7, more than sufficient for pricing.
function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// --- Constants ---

export const POLICY_TERM_MONTHS = 6; // Default term; kept for backward compat

// WHY: Shorter terms have lower absolute cost but higher per-month cost.
// 1-month lets users "try it out"; 6-month is best per-month value.
export const TERM_OPTIONS = [
  { months: 1, label: "1 Month", desc: "Try it out" },
  { months: 3, label: "3 Months", desc: "Seasonal coverage" },
  { months: 6, label: "6 Months", desc: "Best value" },
] as const;

export const VOLATILITY_PRESETS = {
  low: { value: 0.25, label: "Low", desc: "Calm market" },
  normal: { value: 0.40, label: "Normal", desc: "Typical conditions" },
  high: { value: 0.65, label: "High", desc: "Hurricane season / OPEC" },
  crisis: { value: 1.00, label: "Crisis", desc: "War / pandemic" },
} as const;

// WHY: Negative q in summer = expected price rise = higher forward = more expensive call
const SEASONAL_ADJUSTMENTS: Record<number, number> = {
  1: 0.0,
  2: -0.01,
  3: -0.02,
  4: -0.04,
  5: -0.05,
  6: -0.05,
  7: -0.04,
  8: -0.03,
  9: -0.01,
  10: 0.0,
  11: 0.01,
  12: 0.01,
};

const DEFAULT_OPERATIONAL_LOAD = 0.05; // $/gallon
const DEFAULT_PROFIT_MARGIN = 0.03; // $/gallon
const DEFAULT_ADVERSE_SELECTION_LOAD = 0.10; // 10% multiplier

// --- Types ---

export interface PricingInputs {
  spotPrice: number;
  strikePrice: number;
  gallonsPerMonth: number;
  volatility: number;
  riskFreeRate: number;
  currentMonth: number;
  termMonths?: number; // Defaults to POLICY_TERM_MONTHS (6)
  operationalLoad?: number;
  profitMargin?: number;
  adverseSelectionLoad?: number;
}

export interface PricingResult {
  fairValuePerGallon: number;
  seasonalAdjPerGallon: number;
  adverseSelectionPerGallon: number;
  operationalLoadPerGallon: number;
  profitMarginPerGallon: number;
  totalPremiumPerGallon: number;

  upfrontPrice: number;
  monthlyEquivalent: number;
  totalGallonsCovered: number;
  gallonsPerMonth: number;
  policyMonths: number;

  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  probabilityItm: number;

  spotPrice: number;
  strikePrice: number;
  volatility: number;
}

// --- Core BSM ---

function blackScholesCall(
  S: number,
  K: number,
  r: number,
  q: number,
  sigma: number,
  t: number
): { price: number; d1: number; d2: number } {
  if (t <= 0) {
    return { price: Math.max(S - K, 0), d1: 0, d2: 0 };
  }
  if (sigma <= 0) {
    if (S * Math.exp((r - q) * t) > K) {
      return {
        price: S * Math.exp(-q * t) - K * Math.exp(-r * t),
        d1: Infinity,
        d2: Infinity,
      };
    }
    return { price: 0, d1: -Infinity, d2: -Infinity };
  }

  const sqrtT = Math.sqrt(t);
  const d1 =
    (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const price =
    S * Math.exp(-q * t) * normCdf(d1) -
    K * Math.exp(-r * t) * normCdf(d2);

  return { price, d1, d2 };
}

function computeGreeks(
  S: number,
  K: number,
  r: number,
  q: number,
  sigma: number,
  t: number,
  d1: number,
  d2: number
) {
  if (t <= 0 || sigma <= 0) {
    return { delta: 0, gamma: 0, vega: 0, theta: 0 };
  }

  const sqrtT = Math.sqrt(t);
  const nD1 = normPdf(d1);

  const delta = Math.exp(-q * t) * normCdf(d1);
  const gamma = (Math.exp(-q * t) * nD1) / (S * sigma * sqrtT);
  const vega = (S * Math.exp(-q * t) * nD1 * sqrtT) / 100;
  const theta =
    -(
      (S * sigma * Math.exp(-q * t) * nD1) / (2 * sqrtT) +
      r * K * Math.exp(-r * t) * normCdf(d2) -
      q * S * Math.exp(-q * t) * normCdf(d1)
    ) / 365;

  return { delta, gamma, vega, theta };
}

// --- Main Pricing Function ---

export function priceProtectionPlan(inputs: PricingInputs): PricingResult {
  const opLoad = inputs.operationalLoad ?? DEFAULT_OPERATIONAL_LOAD;
  const profitMargin = inputs.profitMargin ?? DEFAULT_PROFIT_MARGIN;
  const advSelLoad = inputs.adverseSelectionLoad ?? DEFAULT_ADVERSE_SELECTION_LOAD;
  const termMonths = inputs.termMonths ?? POLICY_TERM_MONTHS;

  const t = termMonths / 12;
  const seasonalQ = SEASONAL_ADJUSTMENTS[inputs.currentMonth] ?? 0;

  const { price: callPrice, d1, d2 } = blackScholesCall(
    inputs.spotPrice,
    inputs.strikePrice,
    inputs.riskFreeRate,
    seasonalQ,
    inputs.volatility,
    t
  );

  const fairValue = Math.max(callPrice, 0);
  const adverseAdj = fairValue * advSelLoad;

  // Seasonal contribution for transparency
  const noSeasonalPrice = blackScholesCall(
    inputs.spotPrice,
    inputs.strikePrice,
    inputs.riskFreeRate,
    0,
    inputs.volatility,
    t
  ).price;
  const seasonalContribution = fairValue - Math.max(noSeasonalPrice, 0);

  const totalPerGallon = fairValue + adverseAdj + opLoad + profitMargin;
  const totalGallons = inputs.gallonsPerMonth * termMonths;
  const upfrontPrice = totalPerGallon * totalGallons;

  const greeks = computeGreeks(
    inputs.spotPrice,
    inputs.strikePrice,
    inputs.riskFreeRate,
    seasonalQ,
    inputs.volatility,
    t,
    d1,
    d2
  );

  const probabilityItm =
    t > 0 && inputs.volatility > 0 ? normCdf(d2) : 0;

  return {
    fairValuePerGallon: round4(fairValue),
    seasonalAdjPerGallon: round4(seasonalContribution),
    adverseSelectionPerGallon: round4(adverseAdj),
    operationalLoadPerGallon: round4(opLoad),
    profitMarginPerGallon: round4(profitMargin),
    totalPremiumPerGallon: round4(totalPerGallon),
    upfrontPrice: round2(upfrontPrice),
    monthlyEquivalent: round2(upfrontPrice / termMonths),
    totalGallonsCovered: Math.round(totalGallons * 10) / 10,
    gallonsPerMonth: inputs.gallonsPerMonth,
    policyMonths: termMonths,
    delta: round4(greeks.delta),
    gamma: round4(greeks.gamma),
    vega: round4(greeks.vega),
    theta: round4(greeks.theta),
    probabilityItm: round4(probabilityItm),
    spotPrice: inputs.spotPrice,
    strikePrice: inputs.strikePrice,
    volatility: inputs.volatility,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// --- Tier Comparison Helper ---

export interface TierRow {
  strikePrice: number;
  buffer: number;
  premiumPerGallon: number;
  upfrontPrice: number;
  monthlyEquivalent: number;
  probabilityItm: number;
}

export function generateTierComparison(
  spotPrice: number,
  gallonsPerMonth: number,
  volatility: number,
  riskFreeRate: number,
  currentMonth: number,
  termMonths?: number
): TierRow[] {
  const offsets = [0.10, 0.25, 0.50, 0.75, 1.0, 1.5, 2.0];
  return offsets.map((offset) => {
    const strike = round2(spotPrice + offset);
    const result = priceProtectionPlan({
      spotPrice,
      strikePrice: strike,
      gallonsPerMonth,
      volatility,
      riskFreeRate,
      currentMonth,
      termMonths,
    });
    return {
      strikePrice: strike,
      buffer: offset,
      premiumPerGallon: result.totalPremiumPerGallon,
      upfrontPrice: result.upfrontPrice,
      monthlyEquivalent: result.monthlyEquivalent,
      probabilityItm: result.probabilityItm,
    };
  });
}
