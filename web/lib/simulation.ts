/**
 * Hedge Book Simulation Engine
 *
 * Uses real RBOB/HO futures prices from Yahoo Finance and generates
 * simulated member signups to test hedging strategies.
 *
 * WHY: We need to backtest our hedge book against real market data
 * (including the Iran-war price spike) to understand P&L under stress.
 * Yahoo Finance provides free historical NYMEX RBOB (RB=F) and HO (HO=F)
 * futures settlement prices with daily OHLCV.
 */

import { priceProtectionPlan } from "./pricing-engine";
import { fetchAllFutures, type FuturesDayData } from "./yahoo-finance";

// --- Seeded PRNG (Mulberry32) ---
// WHY: Deterministic random for reproducible simulation runs.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// --- Futures Price Data ---

export interface FuturesPriceRow {
  date: Date;
  instrument: "RBOB" | "HO";
  open: number;
  high: number;
  low: number;
  settle: number;
  volume: number;
}

/**
 * Fetch real RBOB and HO futures prices from Yahoo Finance.
 *
 * Returns paired daily rows (one RBOB + one HO per trading day),
 * aligned by date. Only includes dates where both instruments have data.
 */
export async function fetchRealFuturesPrices(): Promise<FuturesPriceRow[]> {
  // WHY: 6mo range from Yahoo Finance, trimmed to ~4 months (88 trading days).
  // Yahoo doesn't offer a "4mo" option. 6mo gives us enough data to cover
  // the Iran-war price spike period for backtesting.
  const { rbob, ho } = await fetchAllFutures("6mo");

  // Index HO by date string for alignment
  const hoByDate = new Map<string, FuturesDayData>();
  for (const day of ho.days) {
    hoByDate.set(day.dateStr, day);
  }

  const prices: FuturesPriceRow[] = [];

  // WHY: Yahoo Finance can return duplicate timestamps that map to the
  // same calendar date. Deduplicate by dateStr to avoid DB unique constraint
  // violations on (date, instrument).
  const seen = new Set<string>();

  for (const rbobDay of rbob.days) {
    if (seen.has(rbobDay.dateStr)) continue;
    const hoDay = hoByDate.get(rbobDay.dateStr);
    // WHY: Only include days where both RBOB and HO have data,
    // so the simulation always has paired prices.
    if (!hoDay) continue;

    seen.add(rbobDay.dateStr);

    prices.push({
      date: rbobDay.date,
      instrument: "RBOB",
      open: rbobDay.open,
      high: rbobDay.high,
      low: rbobDay.low,
      settle: rbobDay.close,
      volume: rbobDay.volume,
    });

    prices.push({
      date: hoDay.date,
      instrument: "HO",
      open: hoDay.open,
      high: hoDay.high,
      low: hoDay.low,
      settle: hoDay.close,
      volume: hoDay.volume,
    });
  }

  return prices;
}

// --- Member Simulation ---

// WHY: Representative zip codes across the US to create geographic
// diversity. Each entry is [zip, stateCode, cityState].
const SAMPLE_LOCATIONS: [string, string, string][] = [
  ["10001", "NY", "New York, NY"],
  ["90001", "CA", "Los Angeles, CA"],
  ["60601", "IL", "Chicago, IL"],
  ["77001", "TX", "Houston, TX"],
  ["85001", "AZ", "Phoenix, AZ"],
  ["19101", "PA", "Philadelphia, PA"],
  ["78201", "TX", "San Antonio, TX"],
  ["92101", "CA", "San Diego, CA"],
  ["75201", "TX", "Dallas, TX"],
  ["95101", "CA", "San Jose, CA"],
  ["32801", "FL", "Orlando, FL"],
  ["46201", "IN", "Indianapolis, IN"],
  ["28201", "NC", "Charlotte, NC"],
  ["94101", "CA", "San Francisco, CA"],
  ["98101", "WA", "Seattle, WA"],
  ["80201", "CO", "Denver, CO"],
  ["20001", "DC", "Washington, DC"],
  ["37201", "TN", "Nashville, TN"],
  ["73301", "TX", "Austin, TX"],
  ["30301", "GA", "Atlanta, GA"],
  ["33101", "FL", "Miami, FL"],
  ["97201", "OR", "Portland, OR"],
  ["89101", "NV", "Las Vegas, NV"],
  ["02101", "MA", "Boston, MA"],
  ["48201", "MI", "Detroit, MI"],
  ["55401", "MN", "Minneapolis, MN"],
  ["63101", "MO", "St. Louis, MO"],
  ["15201", "PA", "Pittsburgh, PA"],
  ["84101", "UT", "Salt Lake City, UT"],
  ["06101", "CT", "Hartford, CT"],
];

// WHY: State-level retail price adjustments reflect that gas costs
// more in CA/NY/WA than in TX/MO. Applied as $/gal offset from the
// base retail price derived from futures.
export const STATE_RETAIL_OFFSET: Record<string, number> = {
  CA: 0.45,
  NY: 0.25,
  WA: 0.3,
  OR: 0.2,
  CT: 0.15,
  MA: 0.15,
  PA: 0.1,
  IL: 0.1,
  DC: 0.1,
  CO: 0.05,
  AZ: 0.0,
  FL: 0.0,
  GA: 0.0,
  NC: 0.0,
  NV: 0.0,
  MN: 0.0,
  MI: 0.0,
  IN: -0.05,
  TN: -0.05,
  MO: -0.1,
  TX: -0.1,
  UT: -0.05,
};

// WHY: Rack spread converts wholesale futures to retail pump price.
// Regular = RBOB + $0.95, Premium = RBOB + $1.30, Diesel = HO + $0.85.
const RACK_SPREAD: Record<string, { instrument: "RBOB" | "HO"; spread: number }> = {
  Regular: { instrument: "RBOB", spread: 0.95 },
  Premium: { instrument: "RBOB", spread: 1.3 },
  Diesel: { instrument: "HO", spread: 0.85 },
};

export interface SimMemberRow {
  signupDate: Date;
  dayNumber: number;
  zip: string;
  stateCode: string;
  cityState: string;
  fuelType: string;
  spotPrice: number;
  futuresPrice: number;
  strikePrice: number;
  termDays: number;
  gallonsPerMonth: number;
  premiumPerGallon: number;
  upfrontPrice: number;
  status: string;
  endDate: Date;
}

/**
 * Compute how many members sign up on each simulation day.
 *
 * WHY: Realistic slow-growth ramp for a startup over ~125 trading days (6 months).
 * Month 1 (days 1-21):   1-5/day — just launched, word of mouth
 * Month 2 (days 22-42):  3-10/day — early traction
 * Month 3 (days 43-63):  5-15/day — marketing kicks in
 * Month 4 (days 64-84):  8-25/day — steady growth
 * Month 5 (days 85-105): 12-35/day — building momentum
 * Month 6 (days 106+):   15-45/day — established, occasional big days
 *
 * ~21 trading days per calendar month.
 */
function signupsForDay(dayNumber: number, rng: () => number): number {
  const noise = (rng() - 0.5) * 2; // -1 to +1

  if (dayNumber <= 21) {
    // Month 1: 1-5/day, very slow start
    const base = 1 + (4 * (dayNumber - 1)) / 20;
    return Math.max(1, Math.round(base + noise * 2));
  }
  if (dayNumber <= 42) {
    // Month 2: 3-10/day
    const base = 3 + (7 * (dayNumber - 22)) / 20;
    return Math.max(1, Math.round(base + noise * 3));
  }
  if (dayNumber <= 63) {
    // Month 3: 5-15/day
    const base = 5 + (10 * (dayNumber - 43)) / 20;
    return Math.max(2, Math.round(base + noise * 4));
  }
  if (dayNumber <= 84) {
    // Month 4: 8-25/day
    const base = 8 + (17 * (dayNumber - 64)) / 20;
    return Math.max(3, Math.round(base + noise * 5));
  }
  if (dayNumber <= 105) {
    // Month 5: 12-35/day
    const base = 12 + (23 * (dayNumber - 85)) / 20;
    return Math.max(4, Math.round(base + noise * 6));
  }
  // Month 6+: 15-45/day with occasional spikes
  const roll = rng();
  if (roll > 0.93) return Math.round(40 + rng() * 20); // Big day: 40-60
  if (roll < 0.07) return Math.round(5 + rng() * 8);   // Slow day: 5-13
  return Math.max(5, Math.round(15 + rng() * 30 + noise * 5)); // Normal: 15-45
}

export interface SimPricingConfig {
  operationalLoad: number;   // $/gallon (from PricingConfig)
  profitMargin: number;      // $/gallon (from PricingConfig)
  adverseSelectionLoad: number; // multiplier (from PricingConfig)
  riskFreeRate: number;      // decimal (from PricingConfig / Treasury API)
}

/**
 * Generate simulated members across all trading days in the futures data.
 * Uses real RBOB/HO settlement prices to set retail spot prices.
 *
 * WHY: Pricing config (margin, loads, rate) comes from the active PricingConfig
 * so the simulation uses the same pricing logic as real members. No manual
 * override sliders — what you see in pricing config is what the sim uses.
 */
export function generateSimMembers(
  futuresPrices: FuturesPriceRow[],
  pricingConfig: SimPricingConfig
): SimMemberRow[] {
  const rng = mulberry32(1337);
  const members: SimMemberRow[] = [];

  // Build ordered list of unique trading dates with both RBOB and HO
  const priceByDate = new Map<string, { RBOB: number; HO: number }>();
  for (const fp of futuresPrices) {
    const key = fp.date.toISOString().slice(0, 10);
    const existing = priceByDate.get(key) || { RBOB: 0, HO: 0 };
    existing[fp.instrument] = fp.settle;
    priceByDate.set(key, existing);
  }

  // WHY: Iterate over actual trading days from Yahoo Finance data,
  // not hardcoded calendar days. This ensures we only simulate on
  // days with real market prices.
  const tradingDays = Array.from(priceByDate.entries())
    .filter(([, p]) => p.RBOB > 0 && p.HO > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const totalDays = tradingDays.length;
  const now = new Date();

  // WHY: Compute realized vol from the actual price series to detect
  // high-vol regimes dynamically instead of hardcoding day ranges.
  const rbobPrices = tradingDays.map(([, p]) => p.RBOB);
  function rollingVol(idx: number): number {
    // 10-day trailing realized vol, annualized
    const window = rbobPrices.slice(Math.max(0, idx - 10), idx + 1);
    if (window.length < 3) return 0.4;
    const logReturns: number[] = [];
    for (let i = 1; i < window.length; i++) {
      logReturns.push(Math.log(window[i] / window[i - 1]));
    }
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
    return Math.max(0.25, Math.min(1.2, Math.sqrt(variance) * Math.sqrt(252)));
  }

  for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
    const [dateKey, dayPrices] = tradingDays[dayIdx];
    const date = new Date(dateKey + "T00:00:00Z");
    const day = dayIdx + 1; // 1-based day number

    const count = signupsForDay(day, rng);

    for (let m = 0; m < count; m++) {
      const loc = SAMPLE_LOCATIONS[Math.floor(rng() * SAMPLE_LOCATIONS.length)];
      const [zip, stateCode, cityState] = loc;

      const fuelRoll = rng();
      const fuelType = fuelRoll < 0.7 ? "Regular" : fuelRoll < 0.85 ? "Premium" : "Diesel";
      const { instrument, spread } = RACK_SPREAD[fuelType];

      const futuresPrice = dayPrices[instrument];
      const stateOffset = STATE_RETAIL_OFFSET[stateCode] ?? 0;
      const spotPrice = round2(futuresPrice + spread + stateOffset);

      // Strike = spot + buffer ($0.10 to $1.50, weighted toward $0.25-$0.75)
      const bufferRoll = rng();
      let buffer: number;
      if (bufferRoll < 0.15) buffer = 0.1 + rng() * 0.15;
      else if (bufferRoll < 0.6) buffer = 0.25 + rng() * 0.5;
      else if (bufferRoll < 0.85) buffer = 0.75 + rng() * 0.25;
      else buffer = 1.0 + rng() * 0.5;
      const strikePrice = round2(spotPrice + buffer);

      const termRoll = rng();
      const termDays = termRoll < 0.2 ? 30 : termRoll < 0.6 ? 90 : 180;

      const gallonsPerMonth = Math.round(
        Math.max(40, Math.min(120, 65 + (rng() + rng() + rng() - 1.5) * 30))
      );

      // WHY: Use realized vol from actual price data to set the implied
      // vol for pricing. During the crisis spike, this naturally increases.
      const vol = rollingVol(dayIdx);

      // WHY: Pass pricing config directly — operational load, profit margin,
      // and adverse selection come from the admin PricingConfig, not a manual
      // multiplier. The simulation prices members exactly like production does.
      const pricing = priceProtectionPlan({
        spotPrice,
        strikePrice,
        gallonsPerMonth,
        volatility: vol,
        riskFreeRate: pricingConfig.riskFreeRate,
        currentMonth: date.getMonth() + 1,
        termDays,
        operationalLoad: pricingConfig.operationalLoad,
        profitMargin: pricingConfig.profitMargin,
        adverseSelectionLoad: pricingConfig.adverseSelectionLoad,
      });

      const premiumPerGallon = round4(pricing.totalPremiumPerGallon);
      const totalGallons = gallonsPerMonth * (termDays / 30);
      const upfrontPrice = round2(premiumPerGallon * totalGallons);

      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + termDays);

      // WHY: Mark memberships that have already ended as EXPIRED.
      const status = endDate < now ? "EXPIRED" : "ACTIVE";

      members.push({
        signupDate: date,
        dayNumber: day,
        zip,
        stateCode,
        cityState,
        fuelType,
        spotPrice,
        futuresPrice,
        strikePrice,
        termDays,
        gallonsPerMonth,
        premiumPerGallon,
        upfrontPrice,
        status,
        endDate,
      });
    }
  }

  return members;
}

/**
 * Compute the retail price for a fuel type given today's futures prices.
 * Used by the hedge engine to calculate member liability.
 */
export function retailFromFutures(
  fuelType: string,
  rbobSettle: number,
  hoSettle: number,
  stateCode: string
): number {
  const { instrument, spread } = RACK_SPREAD[fuelType] || RACK_SPREAD.Regular;
  const futuresPrice = instrument === "HO" ? hoSettle : rbobSettle;
  const stateOffset = STATE_RETAIL_OFFSET[stateCode] ?? 0;
  return round2(futuresPrice + spread + stateOffset);
}
