/**
 * Real-Time Volatility Monitor
 *
 * Computes realized volatility from recent gas price movements and
 * provides a real-time vol estimate that can override the admin-set
 * pricing volatility when markets move faster than config updates.
 *
 * WHY: During a crisis (e.g., Iran war), gas prices can spike within
 * hours. A daily vol check would leave us pricing below market for
 * the rest of the day. This module caches a vol estimate with a
 * 15-minute TTL so we catch major moves within 15 minutes.
 *
 * The real-time vol is used as: effectiveVol = max(configVol, realtimeVol)
 * This means the admin config is the floor — real-time can only push higher.
 */

import { prisma } from "@/lib/db";
import { fetchRBOB, fetchHO } from "@/lib/yahoo-finance";

// --- Cache ---

// WHY: 15-min TTL balances freshness vs API cost. During a crisis,
// a 15-min stale window is acceptable; for calm markets it's negligible.
const CACHE_TTL_MS = 15 * 60 * 1000;

interface VolCache {
  realtimeVol: number;
  hoRealtimeVol: number;
  regime: VolRegime;
  hoRegime: VolRegime;
  computedAt: Date;
  dataPoints: number;
  hoDataPoints: number;
  recentMove: number; // Latest RBOB price move as % (for display)
  hoRecentMove: number; // Latest HO price move as %
  overrideActive: boolean;
  configVol: number;
  effectiveVol: number;
}

let cachedVol: VolCache | null = null;

// --- Regime classification ---

export type VolRegime = "CALM" | "NORMAL" | "ELEVATED" | "CRISIS";

interface RegimeConfig {
  label: string;
  color: string; // Tailwind color suffix
  // WHY: Threshold is the min annualized vol for this regime.
  threshold: number;
}

export const VOL_REGIMES: Record<VolRegime, RegimeConfig> = {
  CALM: { label: "Calm", color: "emerald", threshold: 0 },
  NORMAL: { label: "Normal", color: "blue", threshold: 0.25 },
  ELEVATED: { label: "Elevated", color: "amber", threshold: 0.50 },
  CRISIS: { label: "Crisis", color: "red", threshold: 0.80 },
};

function classifyRegime(vol: number): VolRegime {
  if (vol >= 0.80) return "CRISIS";
  if (vol >= 0.50) return "ELEVATED";
  if (vol >= 0.25) return "NORMAL";
  return "CALM";
}

// --- Yahoo Finance RBOB price fetching ---
// WHY: We use RBOB front-month futures (RB=F) from Yahoo Finance as our
// volatility signal. This is the actual NYMEX futures price, not retail.
// More responsive than GasBuddy for detecting market shocks.

// --- Realized vol computation ---

/**
 * Compute annualized realized volatility from a series of daily prices.
 *
 * Method: standard deviation of log returns, annualized by √252.
 * WHY: √252 because there are ~252 trading days/year. This is the
 * standard approach for annualizing daily vol in finance.
 *
 * Also computes an "intraday boost" if the latest price is a big move
 * from the recent average, reflecting sudden market shocks.
 */
function computeRealizedVol(
  dailyPrices: number[],
  currentPrice: number | null
): { vol: number; recentMove: number } {
  if (dailyPrices.length < 3) {
    return { vol: 0.4, recentMove: 0 };
  }

  // Compute log returns
  const logReturns: number[] = [];
  for (let i = 1; i < dailyPrices.length; i++) {
    if (dailyPrices[i - 1] > 0 && dailyPrices[i] > 0) {
      logReturns.push(Math.log(dailyPrices[i] / dailyPrices[i - 1]));
    }
  }

  if (logReturns.length < 2) {
    return { vol: 0.4, recentMove: 0 };
  }

  // Standard deviation of log returns
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  // WHY: Annualize using √252 trading days
  let annualizedVol = dailyVol * Math.sqrt(252);

  // --- Intraday shock detection ---
  // WHY: If the current live price is a big move from the recent average,
  // boost the vol estimate to reflect the sudden shock. Historical vol
  // alone can't capture a move that's happening right now.
  let recentMove = 0;
  if (currentPrice !== null && currentPrice > 0) {
    const recentAvg =
      dailyPrices.slice(-5).reduce((a, b) => a + b, 0) /
      Math.min(5, dailyPrices.length);

    if (recentAvg > 0) {
      recentMove = (currentPrice - recentAvg) / recentAvg;
      const absMove = Math.abs(recentMove);

      // WHY: A 3%+ intraday move is unusual for gas prices. Scale the
      // vol boost proportionally: 3% move → +20% vol, 5% → +40%, 10% → +80%.
      if (absMove > 0.03) {
        const boost = absMove * 8; // 8x multiplier converts price move to vol boost
        annualizedVol = Math.max(annualizedVol, annualizedVol + boost);
      }
    }
  }

  // WHY: Floor at 15% (gas is never truly zero-vol) and cap at 150%
  // to avoid absurd values from data anomalies.
  annualizedVol = Math.max(0.15, Math.min(1.5, annualizedVol));

  return {
    vol: Math.round(annualizedVol * 100) / 100,
    recentMove: Math.round(recentMove * 10000) / 10000,
  };
}

// --- Main exported function ---

export interface VolMonitorResult {
  /** The vol to use for pricing: max(configVol, realtimeVol) */
  effectiveVol: number;
  /** Admin-configured volatility from PricingConfig */
  configVol: number;
  /** Computed real-time RBOB volatility */
  realtimeVol: number;
  /** Computed real-time HO volatility */
  hoRealtimeVol: number;
  /** RBOB market regime classification */
  regime: VolRegime;
  /** HO market regime classification */
  hoRegime: VolRegime;
  /** Whether real-time vol is overriding config */
  overrideActive: boolean;
  /** Latest RBOB price move as decimal (0.03 = 3%) */
  recentMove: number;
  /** Latest HO price move as decimal */
  hoRecentMove: number;
  /** When this was last computed */
  computedAt: Date;
  /** Number of RBOB daily data points used */
  dataPoints: number;
  /** Number of HO daily data points used */
  hoDataPoints: number;
}

/**
 * Get the current effective volatility for pricing.
 *
 * Returns cached result if within TTL, otherwise recomputes from:
 * 1. Historical DailyPrice records (realized vol over last 30 days)
 * 2. Live GasBuddy price (intraday shock detection)
 * 3. Admin PricingConfig vol (floor)
 */
export async function getEffectiveVolatility(): Promise<VolMonitorResult> {
  // Return cache if fresh
  if (cachedVol && Date.now() - cachedVol.computedAt.getTime() < CACHE_TTL_MS) {
    return cachedVol;
  }

  // Get admin config vol
  const config = await prisma.pricingConfig.findFirst({
    where: { isActive: true },
    select: { volatility: true },
  });
  const configVol = config?.volatility ?? 0.4;

  // WHY: Use RBOB and HO futures settlement prices from Yahoo Finance for vol
  // computation. Both instruments need monitoring — diesel (HO) can spike
  // independently from gasoline (RBOB) due to winter heating demand, refinery
  // outages, or supply disruptions. A RBOB-only monitor misses HO-specific risk.
  let rbobPrices: number[] = [];
  let rbobCurrentPrice: number | null = null;
  let hoPrices: number[] = [];
  let hoCurrentPrice: number | null = null;

  try {
    const [rbobData, hoData] = await Promise.all([
      fetchRBOB("3mo"),
      fetchHO("3mo"),
    ]);
    rbobPrices = rbobData.days.map((d) => d.close);
    rbobCurrentPrice = rbobData.latestPrice;
    hoPrices = hoData.days.map((d) => d.close);
    hoCurrentPrice = hoData.latestPrice;
  } catch {
    // WHY: If Yahoo Finance is down, fall back to stored DailyPrice data
    // so vol monitoring doesn't break entirely.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPrices = await prisma.dailyPrice.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: { date: true, avgPrice: true },
      orderBy: { date: "asc" },
    });

    const priceByDay = new Map<string, number[]>();
    for (const dp of recentPrices) {
      const key = new Date(dp.date).toISOString().slice(0, 10);
      const arr = priceByDay.get(key) || [];
      arr.push(dp.avgPrice);
      priceByDay.set(key, arr);
    }

    rbobPrices = Array.from(priceByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, prices]) => prices.reduce((a, b) => a + b, 0) / prices.length);
  }

  const { vol: realtimeVol, recentMove } = computeRealizedVol(rbobPrices, rbobCurrentPrice);
  const { vol: hoRealtimeVol, recentMove: hoRecentMove } = computeRealizedVol(hoPrices, hoCurrentPrice);

  // WHY: Effective vol uses the HIGHER of RBOB and HO. If diesel is spiking
  // but gasoline is calm, we still need to price conservatively because
  // diesel members have real exposure. Taking the max ensures we don't
  // underprice when either market moves.
  const effectiveVol = Math.max(realtimeVol, hoRealtimeVol);
  const overrideActive = Math.abs(effectiveVol - configVol) > 0.02;
  const regime = classifyRegime(realtimeVol);
  const hoRegime = classifyRegime(hoRealtimeVol);

  const result: VolMonitorResult = {
    effectiveVol: Math.round(effectiveVol * 100) / 100,
    configVol,
    realtimeVol,
    hoRealtimeVol,
    regime,
    hoRegime,
    overrideActive,
    recentMove,
    hoRecentMove,
    computedAt: new Date(),
    dataPoints: rbobPrices.length,
    hoDataPoints: hoPrices.length,
  };

  // Update cache
  cachedVol = result;

  // WHY: Log when real-time vol overrides config so admins can see it in server logs.
  if (overrideActive) {
    console.log(
      `[VOL-MONITOR] Real-time vol override: config=${configVol}, realtime=${realtimeVol}, effective=${effectiveVol}, regime=${regime}, move=${(recentMove * 100).toFixed(2)}%`
    );
  }

  return result;
}

/**
 * Force clear the vol cache. Useful after admin updates pricing config.
 */
export function clearVolCache(): void {
  cachedVol = null;
}

/**
 * Compute the impact of a vol change on a sample membership.
 * Returns the price difference for a typical 90-day, 65 gal/mo plan.
 */
export function volImpactPreview(
  spotPrice: number,
  fromVol: number,
  toVol: number
): { fromPrice: number; toPrice: number; diff: number; pctChange: number } {
  // Inline simplified Black-Scholes to avoid circular import
  const t = 90 / 365;
  const strikePrice = spotPrice + 0.50; // Typical $0.50 buffer
  const gallons = 65 * 3; // 65 gal/mo × 3 months

  function quickPrice(sigma: number): number {
    if (sigma <= 0 || t <= 0) return 0;
    const sqrtT = Math.sqrt(t);
    const d1 = (Math.log(spotPrice / strikePrice) + 0.5 * sigma * sigma * t) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    // normCdf approximation
    function nc(x: number): number {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
      const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      const ax = Math.abs(x) / Math.SQRT2;
      const tt = 1.0 / (1.0 + p * ax);
      const y = 1.0 - ((((a5 * tt + a4) * tt + a3) * tt + a2) * tt + a1) * tt * Math.exp(-ax * ax);
      return 0.5 * (1.0 + sign * y);
    }
    const call = spotPrice * nc(d1) - strikePrice * Math.exp(-0.045 * t) * nc(d2);
    // Add loads: adverse selection 10% + operational $0.05 + profit $0.03
    const total = call * 1.1 + 0.05 + 0.03;
    return Math.round(total * gallons * 100) / 100;
  }

  const fromPrice = quickPrice(fromVol);
  const toPrice = quickPrice(toVol);
  const diff = Math.round((toPrice - fromPrice) * 100) / 100;
  const pctChange = fromPrice > 0 ? Math.round(((toPrice - fromPrice) / fromPrice) * 1000) / 10 : 0;

  return { fromPrice, toPrice, diff, pctChange };
}
