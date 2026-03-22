/**
 * Hedge Engine — Options pricing and hedging strategies
 *
 * Uses the Black-76 model (Black-Scholes for futures options) to price
 * NYMEX RBOB and HO call options, then runs two parallel strategies:
 *
 * 1. Matching Calls: Buy calls to cover accumulated member gallons
 * 2. Delta Hedging: Rebalance daily to maintain delta-neutral portfolio
 *
 * WHY Black-76 instead of standard Black-Scholes: We're pricing options
 * on futures, not on spot. The futures price replaces the spot price and
 * there's no dividend yield term.
 *
 * C = e^(-rT) × [F × N(d1) - K × N(d2)]
 * d1 = [ln(F/K) + (σ²/2)T] / (σ√T)
 * d2 = d1 - σ√T
 */

import { SimMemberRow, FuturesPriceRow, retailFromFutures, STATE_RETAIL_OFFSET } from "./simulation";

// --- Math helpers ---

function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// --- Black-76 model ---

export interface Black76Result {
  price: number; // $/gallon option premium
  d1: number;
  d2: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
}

/**
 * Price a call option on a futures contract using Black-76.
 *
 * @param F  Current futures price ($/gal)
 * @param K  Option strike price ($/gal)
 * @param r  Risk-free rate (annualized)
 * @param sigma  Implied volatility (annualized)
 * @param T  Time to expiry in years
 */
export function black76Call(
  F: number,
  K: number,
  r: number,
  sigma: number,
  T: number
): Black76Result {
  if (T <= 0) {
    const intrinsic = Math.max(F - K, 0);
    return { price: intrinsic, d1: 0, d2: 0, delta: intrinsic > 0 ? 1 : 0, gamma: 0, vega: 0, theta: 0 };
  }
  if (sigma <= 0) {
    const fwd = F > K ? (F - K) * Math.exp(-r * T) : 0;
    return { price: fwd, d1: 0, d2: 0, delta: F > K ? Math.exp(-r * T) : 0, gamma: 0, vega: 0, theta: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(F / K) + (0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const disc = Math.exp(-r * T);
  const price = disc * (F * normCdf(d1) - K * normCdf(d2));

  // Greeks for Black-76
  const nD1 = normPdf(d1);
  const delta = disc * normCdf(d1);
  const gamma = (disc * nD1) / (F * sigma * sqrtT);
  const vega = (F * disc * nD1 * sqrtT) / 100; // per 1% vol move
  const theta = -(
    (F * sigma * disc * nD1) / (2 * sqrtT) +
    r * price
  ) / 365; // per calendar day

  return { price: round4(price), d1, d2, delta: round4(delta), gamma: round4(gamma), vega: round4(vega), theta: round4(theta) };
}

// --- Contract specs ---

// WHY: Always micro contracts (4,200 gal = 100 barrels). Standard NYMEX
// contracts are 42,000 gal (1,000 barrels) — far too large for a startup
// hedging a few hundred members. Micro gives granularity we need.
const CONTRACT_SIZE = 4200;

// WHY: No hedge threshold — buy on the first gallon into each monthly
// bucket. A micro contract costs ~$84-$400. The over-hedge on a single
// contract is at most 4,200 gal × ~$0.50 move ≈ $2,100 upside, and
// the cost of being unhedged during a spike is far worse. The old 75%
// threshold left 30-40% of gallons naked during a slow startup ramp.

// --- Transaction costs ---
// WHY: Real options trading has three cost layers. Ignoring them
// makes the sim look more profitable than reality.

// WHY: Bid/ask spread for micro NYMEX RBOB/HO options. You buy at
// the ask (mid + half spread). Liquid near-ATM strikes are ~$0.002/gal;
// OTM/illiquid strikes can be $0.005+. We use $0.003 as a reasonable avg.
const BID_ASK_SPREAD_PER_GAL = 0.003;

// WHY: Broker commission per contract per side. Interactive Brokers
// charges ~$1.50/contract for micro futures options. Includes exchange
// and clearing fees (~$0.50-$1.00).
const COMMISSION_PER_CONTRACT = 2.00;

// WHY: When selling back, you cross the spread again plus pay commission.
// Sell at mid - half spread. Combined round-trip cost is the full spread.
const SELL_SPREAD_PCT = 0.02; // 2% of MTM on sell-back

/**
 * Total cost to buy options including transaction costs.
 * WHY: Theoretical price is mid-market. Real execution adds half the
 * bid/ask spread per gallon plus broker commission per contract.
 */
function totalBuyCost(optPrice: number, contracts: number): number {
  const theoreticalCost = optPrice * contracts * CONTRACT_SIZE;
  const spreadCost = BID_ASK_SPREAD_PER_GAL * contracts * CONTRACT_SIZE;
  const commissions = COMMISSION_PER_CONTRACT * contracts;
  return round2(theoreticalCost + spreadCost + commissions);
}

// --- Per-day realized vol ---

/**
 * Compute 10-day trailing realized vol from RBOB settlement prices.
 * Annualized by √252 (trading days/year).
 *
 * WHY: Same logic as simulation.ts rollingVol. The hedge engine needs
 * per-day vol to price options realistically — a fixed vol assumption
 * would miss the crisis spike entirely.
 */
function rollingVol(rbobPrices: number[], dayIdx: number): number {
  const window = rbobPrices.slice(Math.max(0, dayIdx - 10), dayIdx + 1);
  if (window.length < 3) return 0.4; // WHY: Fallback before we have enough data
  const logReturns: number[] = [];
  for (let i = 1; i < window.length; i++) {
    logReturns.push(Math.log(window[i] / window[i - 1]));
  }
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
  // WHY: Floor 25% (gas is never zero-vol), cap 120% (avoid absurd spikes from data noise)
  return Math.max(0.25, Math.min(1.2, Math.sqrt(variance) * Math.sqrt(252)));
}

// --- Types ---

export interface HedgePositionRow {
  model: string;
  openDate: Date;
  closeDate: Date | null;
  instrument: string; // "RBOB_CALL" or "HO_CALL"
  direction: string;
  strikePrice: number;
  expiryDate: Date;
  contracts: number;
  contractSize: number;
  premiumPerUnit: number;
  totalPremium: number;
  currentValue: number;
  isOpen: boolean;
}

export interface SnapshotRow {
  date: Date;
  model: string;
  dayNumber: number;
  totalMembers: number;
  newMembersToday: number;
  totalGallonsCovered: number;
  totalPremiumCollected: number;
  totalHedgeCost: number;
  hedgePositionCount: number;
  totalContractsOpen: number;
  hedgeMtmValue: number;
  netPnl: number;
  realizedPnl: number;
  rebatesPaid: number;
  openLiability: number;
  projectedLiability: number;
  rbobPrice: number;
  hoPrice: number;
  portfolioDelta: number;
  portfolioGamma: number;
  portfolioVega: number;
  portfolioTheta: number;
}

interface DayFutures {
  RBOB: number;
  HO: number;
}

export interface HedgeEngineConfig {
  // WHY: Risk-free rate from Treasury API / pricing config.
  // Used for Black-76 discounting. Defaults to 4.5% if not provided.
  riskFreeRate?: number;
}

// --- Hedge strategies ---

/**
 * Run both hedge strategies across the full simulation period.
 *
 * Key behavior:
 * - Always uses micro contracts (4,200 gal)
 * - Vol is computed per-day from the RBOB price series (10-day rolling)
 * - Hedge purchases only trigger when unhedged gallons exceed threshold
 * - Risk-free rate comes from pricing config / Treasury API
 */
export function runHedgeStrategies(
  members: SimMemberRow[],
  futuresPrices: FuturesPriceRow[],
  config: HedgeEngineConfig = {}
): {
  positions: HedgePositionRow[];
  snapshots: SnapshotRow[];
} {
  const riskFreeRate = config.riskFreeRate ?? 0.045;

  // Index futures by date
  const priceByDate = new Map<string, DayFutures>();
  for (const fp of futuresPrices) {
    const key = fp.date.toISOString().slice(0, 10);
    const existing = priceByDate.get(key) || { RBOB: 0, HO: 0 };
    existing[fp.instrument] = fp.settle;
    priceByDate.set(key, existing);
  }

  // WHY: Build ordered RBOB price array for rolling vol computation.
  // Must match the day iteration order exactly.
  const orderedDays = Array.from(priceByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b));
  const rbobPriceArray = orderedDays.map(([, p]) => p.RBOB);

  // Index members by day number
  const membersByDay = new Map<number, SimMemberRow[]>();
  for (const m of members) {
    const arr = membersByDay.get(m.dayNumber) || [];
    arr.push(m);
    membersByDay.set(m.dayNumber, arr);
  }

  const allPositions: HedgePositionRow[] = [];
  const allSnapshots: SnapshotRow[] = [];

  // Run each model
  for (const model of ["MATCHING_CALLS", "DELTA_HEDGE"]) {
    const positions: HedgePositionRow[] = [];
    let cumulativeMembers = 0;
    let cumulativeGallons = 0;
    let cumulativePremium = 0;
    let cumulativeHedgeCost = 0;
    // WHY: Track sell-back proceeds separately so "Hedge Cost" shows
    // total spent and "Realized P&L" shows what we recovered from
    // closing excess positions. Netting them together makes hedge cost
    // look artificially low.
    let cumulativeRealizedPnl = 0;
    // WHY: Accrued liability tracks the total amount owed to members from
    // days when retail exceeded their strike. It only grows — never shrinks
    // from price drops. It decreases only when rebates are paid out.
    let cumulativeAccruedLiability = 0;
    // WHY: Rebates are settled at plan end (30/60/90 days from signup).
    // Between signup and end, accrued liability builds up. At plan end,
    // we cut one check for the total owed. Open Liability = accrued - paid.
    let cumulativeRebatesPaid = 0;
    // WHY: Track per-member accrued rebates so we can settle at their plan end.
    // Key = member index (dayNumber + position), value = accumulated rebate owed.
    const memberAccrued = new Map<string, number>();

    // WHY: Monthly expiry buckets. Member gallons are split by settlement
    // month — each 30-day period of a plan goes into the bucket for the
    // month that settlement falls in. When a bucket hits threshold, we buy
    // options expiring in that month. This aligns hedges with payment dates.
    //
    // Key = "YYYY-MM:RBOB" or "YYYY-MM:HO"
    // Value = { gallons, strikeSum, strikeGal }
    interface ExpiryBucket {
      gallons: number;
      strikeSum: number;
      strikeGal: number;
    }
    const expiryBuckets = new Map<string, ExpiryBucket>();

    function addToBucket(key: string, gallons: number, strike: number) {
      const bucket = expiryBuckets.get(key) || { gallons: 0, strikeSum: 0, strikeGal: 0 };
      bucket.gallons += gallons;
      bucket.strikeSum += strike * gallons;
      bucket.strikeGal += gallons;
      expiryBuckets.set(key, bucket);
    }

    const totalDays = orderedDays.length;

    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      const [dateKey, dayPrices] = orderedDays[dayIdx];
      const date = new Date(dateKey + "T00:00:00Z");
      const day = dayIdx + 1;

      if (!dayPrices.RBOB || !dayPrices.HO) continue;

      const todayMembers = membersByDay.get(day) || [];
      cumulativeMembers += todayMembers.length;

      // WHY: Per-day vol from actual RBOB price movements, not a fixed assumption.
      // During the Iran-war spike, this naturally increases → higher option prices.
      const dayVol = rollingVol(rbobPriceArray, dayIdx);

      // Tally new member gallons into monthly expiry buckets
      for (const m of todayMembers) {
        const totalGallons = m.gallonsPerMonth * (m.termDays / 30);
        cumulativeGallons += totalGallons;
        cumulativePremium += m.upfrontPrice;

        const stateOffset = STATE_RETAIL_OFFSET[m.stateCode] ?? 0;
        const isDiesel = m.fuelType === "Diesel";
        const instrument = isDiesel ? "HO" : "RBOB";
        const spread = isDiesel ? 0.85 : m.fuelType === "Premium" ? 1.3 : 0.95;
        const futuresStrike = m.strikePrice - spread - stateOffset;

        // WHY: Split member gallons into monthly chunks by settlement date.
        // Each 30-day period gets its own bucket keyed by settlement month.
        // A 90-day member at 65 gal/mo creates 3 buckets of 65 gal each.
        const months = m.termDays / 30;
        for (let mo = 0; mo < months; mo++) {
          const settlementDate = new Date(m.signupDate);
          settlementDate.setDate(settlementDate.getDate() + (mo + 1) * 30);
          // WHY: Bucket key is the settlement MONTH — all members settling
          // in the same month share one option contract expiry.
          const bucketKey = `${settlementDate.getFullYear()}-${String(settlementDate.getMonth() + 1).padStart(2, "0")}:${instrument}`;
          addToBucket(bucketKey, m.gallonsPerMonth, futuresStrike);
        }
      }

      // --- Buy options per monthly expiry bucket ---
      // WHY: Both models use the same bucketed purchase logic. Each bucket
      // represents gallons that need hedge coverage through a specific month.
      // Buy on the first gallon — don't wait for a threshold. A micro contract
      // costs ~$84-$400 depending on vol/strike. The membership fee on even
      // a single member (~$20-$80) partially covers it, and leaving gallons
      // unhedged is a worse risk than the over-hedge cost of one contract.
      // The old threshold approach left 30-40% of gallons naked during the
      // slow ramp — unacceptable for an insurance book.
      for (const [bucketKey, bucket] of expiryBuckets) {
        if (bucket.gallons <= 0) continue;

        const [yearMonth] = bucketKey.split(":");
        const [yr, mo] = yearMonth.split("-").map(Number);
        const bucketExpiry = new Date(Date.UTC(yr, mo, 0));
        const daysUntilExpiry = (bucketExpiry.getTime() - date.getTime()) / 86400000;

        // WHY: Skip if expiry is in the past — can't buy expired options
        if (bucketExpiry <= date) {
          bucket.gallons = 0;
          bucket.strikeSum = 0;
          bucket.strikeGal = 0;
          continue;
        }

        const instrument = bucketKey.split(":")[1];
        const isHo = instrument === "HO";
        const F = isHo ? dayPrices.HO : dayPrices.RBOB;
        const instrumentLabel = isHo ? "HO_CALL" : "RBOB_CALL";

        const avgStrike = bucket.strikeGal > 0
          ? round2(bucket.strikeSum / bucket.strikeGal)
          : round2(F * 1.02); // Fallback: slightly OTM

        const daysToExp = Math.max(1, daysUntilExpiry);
        const T = daysToExp / 365;

        const opt = black76Call(F, avgStrike, riskFreeRate, dayVol, T);

        let contracts: number;
        if (model === "DELTA_HEDGE") {
          // WHY: Delta-hedge buys delta-equivalent contracts.
          const deltaEquivGal = bucket.gallons * (opt.delta > 0 ? opt.delta : 0.5);
          contracts = Math.max(1, Math.ceil(deltaEquivGal / CONTRACT_SIZE));
        } else {
          contracts = Math.ceil(bucket.gallons / CONTRACT_SIZE);
        }

        const totalPrem = totalBuyCost(opt.price, contracts);

        positions.push({
          model,
          openDate: date,
          closeDate: null,
          instrument: instrumentLabel,
          direction: "LONG",
          strikePrice: avgStrike,
          expiryDate: bucketExpiry,
          contracts,
          contractSize: CONTRACT_SIZE,
          premiumPerUnit: opt.price,
          totalPremium: totalPrem,
          currentValue: 0,
          isOpen: true,
        });
        cumulativeHedgeCost += totalPrem;

        // Clear the bucket after purchase
        bucket.gallons = model === "DELTA_HEDGE"
          ? 0  // Delta hedge: reset fully (delta-adjusted)
          : bucket.gallons - contracts * CONTRACT_SIZE; // Matching: track over-hedge
        bucket.strikeSum = 0;
        bucket.strikeGal = 0;
      }

      // --- Mark all positions to market and compute Greeks ---
      let hedgeMtm = 0;
      let portDelta = 0;
      let portGamma = 0;
      let portVega = 0;
      let portTheta = 0;
      let openPositionCount = 0;
      let openContracts = 0;

      for (const pos of positions) {
        if (!pos.isOpen) continue;

        // Close expired positions
        if (pos.expiryDate <= date) {
          pos.isOpen = false;
          // WHY: At expiry, value is intrinsic only
          const F = pos.instrument === "HO_CALL" ? dayPrices.HO : dayPrices.RBOB;
          pos.currentValue = round2(Math.max(0, F - pos.strikePrice) * pos.contracts * pos.contractSize);
          pos.closeDate = date;
          hedgeMtm += pos.currentValue;
          continue;
        }

        const daysToExpiry = Math.max(1, (pos.expiryDate.getTime() - date.getTime()) / 86400000);
        const T = daysToExpiry / 365;
        const F = pos.instrument === "HO_CALL" ? dayPrices.HO : dayPrices.RBOB;
        const opt = black76Call(F, pos.strikePrice, riskFreeRate, dayVol, T);

        pos.currentValue = round2(opt.price * pos.contracts * pos.contractSize);
        hedgeMtm += pos.currentValue;

        const posGallons = pos.contracts * pos.contractSize;
        portDelta += opt.delta * posGallons;
        portGamma += opt.gamma * posGallons;
        portVega += opt.vega * posGallons;
        portTheta += opt.theta * posGallons;

        openPositionCount++;
        openContracts += pos.contracts;
      }

      // --- Pre-expiry close: sell positions 3-5 days before expiry ---
      // WHY: Letting options expire means we only get intrinsic value.
      // Selling a few days before expiry captures remaining time value
      // (theta doesn't fully decay until the last few hours). The
      // proceeds replenish the cash pool for rebate payments.
      // WHY 4 days: gives buffer for T+1 settlement while capturing
      // ~90% of remaining time value vs holding to expiry.
      const PRE_EXPIRY_DAYS = 4;
      for (const pos of positions) {
        if (!pos.isOpen) continue;
        const daysToExpiry = (pos.expiryDate.getTime() - date.getTime()) / 86400000;
        if (daysToExpiry > 0 && daysToExpiry <= PRE_EXPIRY_DAYS) {
          pos.isOpen = false;
          pos.closeDate = date;
          // WHY: Sell at current MTM minus spread and commission.
          // Time value is still positive at 3-5 days out.
          const sellBackValue = round2(
            pos.currentValue * (1 - SELL_SPREAD_PCT) - COMMISSION_PER_CONTRACT * pos.contracts
          );
          cumulativeRealizedPnl += Math.max(0, sellBackValue) - pos.totalPremium;

          // Update tracking
          hedgeMtm -= pos.currentValue;
          const posGal = pos.contracts * pos.contractSize;
          const dTE = Math.max(0.001, daysToExpiry / 365);
          const Fp = pos.instrument === "HO_CALL" ? dayPrices.HO : dayPrices.RBOB;
          const optP = black76Call(Fp, pos.strikePrice, riskFreeRate, dayVol, dTE);
          portDelta -= optP.delta * posGal;
          portGamma -= optP.gamma * posGal;
          portVega -= optP.vega * posGal;
          portTheta -= optP.theta * posGal;
          openPositionCount--;
          openContracts -= pos.contracts;
        }
      }

      // --- Position decay: close excess hedge as member coverage runs down ---
      // WHY: As members consume gallons and plans expire, our hedge should
      // shrink to match. Holding excess options is speculative — the default
      // behavior is conservative: sell back when over-hedged by > 1 contract.
      // An experienced trader might hold ITM options longer, but the sim
      // models the insurance-book approach.

      // Compute active member gallons remaining
      let activeMemberGallonsRemaining = 0;
      for (const [, dayMembers] of membersByDay) {
        for (const m of dayMembers) {
          if (m.endDate > date && m.signupDate <= date) {
            const daysElapsed = Math.max(0, (date.getTime() - m.signupDate.getTime()) / 86400000);
            const daysLeft = Math.max(0, m.termDays - daysElapsed);
            activeMemberGallonsRemaining += (m.gallonsPerMonth / 30) * daysLeft;
          }
        }
      }

      // Total open hedged gallons
      let openHedgedGallons = 0;
      for (const pos of positions) {
        if (pos.isOpen) openHedgedGallons += pos.contracts * pos.contractSize;
      }

      // WHY: Close excess positions if we're over-hedged by more than 1 contract.
      // Sell back at current MTM minus 2% bid/ask spread (realistic for liquid
      // NYMEX options). Start with positions nearest to expiry — they have the
      // least time value, so we give up the least by selling early.
      const excessGallons = openHedgedGallons - activeMemberGallonsRemaining;
      if (excessGallons > CONTRACT_SIZE) {
        // Sort open positions by expiry (nearest first) for closing
        const closeCandidates = positions
          .filter(p => p.isOpen)
          .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

        let gallonsToClose = excessGallons - CONTRACT_SIZE; // Keep 1 contract buffer

        for (const pos of closeCandidates) {
          if (gallonsToClose <= 0) break;
          if (!pos.isOpen) continue;

          const posGallons = pos.contracts * pos.contractSize;
          if (posGallons <= gallonsToClose) {
            // Close entire position
            pos.isOpen = false;
            pos.closeDate = date;
            // WHY: Sell-back at MTM minus spread and commission. Realistic
            // for liquid NYMEX options; illiquid strikes would be wider.
            const sellBackValue = round2(
              pos.currentValue * (1 - SELL_SPREAD_PCT) - COMMISSION_PER_CONTRACT * pos.contracts
            );
            // WHY: Realized P&L = what we got back minus what we originally paid.
            // This is tracked separately from hedge cost so the dashboard shows
            // both: total spent on hedging AND what we recovered from sell-backs.
            cumulativeRealizedPnl += Math.max(0, sellBackValue) - pos.totalPremium;
            gallonsToClose -= posGallons;

            // Recompute MTM totals since we closed this position
            hedgeMtm -= pos.currentValue;
            const posGal = pos.contracts * pos.contractSize;
            // Remove from Greeks
            const daysToExp = Math.max(1, (pos.expiryDate.getTime() - date.getTime()) / 86400000);
            const Tc = daysToExp / 365;
            const Fc = pos.instrument === "HO_CALL" ? dayPrices.HO : dayPrices.RBOB;
            const optC = black76Call(Fc, pos.strikePrice, riskFreeRate, dayVol, Tc);
            portDelta -= optC.delta * posGal;
            portGamma -= optC.gamma * posGal;
            portVega -= optC.vega * posGal;
            portTheta -= optC.theta * posGal;
            openPositionCount--;
            openContracts -= pos.contracts;
          }
          // WHY: We don't partially close positions — NYMEX options trade
          // in whole contracts. If this position is too large, skip to the next.
        }
      }

      // --- Calculate daily accrued liability and monthly settlements ---
      // WHY: Liability accrues daily. Each day, for each active member
      // where retail > strike, we owe (retail - strike) × dailyGallons.
      // That accrues regardless of what prices do tomorrow — a spike on
      // day 10 stays booked even if prices drop on day 11.
      //
      // Settlement: monthly checks from each member's signup date.
      // A 90-day member gets 3 checks (day 30, 60, 90 from signup).
      // A 30-day member gets 1 check at plan end.
      // Since members join on different days, after the first month
      // there are settlements going out nearly every day.
      //
      // Open Liability = cumulative accrued - cumulative rebates paid.
      for (const [, dayMembers] of membersByDay) {
        for (const m of dayMembers) {
          if (m.signupDate > date) continue;

          const memberKey = `${m.dayNumber}-${m.zip}-${m.fuelType}-${m.strikePrice}`;

          // Accrue daily if active and retail > strike
          if (m.endDate > date) {
            const currentRetail = retailFromFutures(m.fuelType, dayPrices.RBOB, dayPrices.HO, m.stateCode);
            const rebatePerGallon = Math.max(0, currentRetail - m.strikePrice);
            if (rebatePerGallon > 0) {
              const dailyGallons = m.gallonsPerMonth / 30;
              const todayOwed = rebatePerGallon * dailyGallons;
              cumulativeAccruedLiability += todayOwed;
              memberAccrued.set(memberKey, (memberAccrued.get(memberKey) || 0) + todayOwed);
            }
          }

          // WHY: Settle every 30 days from signup. A 90-day member gets
          // checks at day 30, 60, and 90. We check if today is a settlement
          // day by seeing if the days elapsed is a multiple of 30.
          const daysElapsed = Math.round((date.getTime() - m.signupDate.getTime()) / 86400000);
          if (daysElapsed > 0 && daysElapsed % 30 === 0 && daysElapsed <= m.termDays) {
            const owed = memberAccrued.get(memberKey) || 0;
            if (owed > 0) {
              cumulativeRebatesPaid += owed;
              memberAccrued.set(memberKey, 0);
            }
          }
        }
      }
      const openLiability = round2(cumulativeAccruedLiability - cumulativeRebatesPaid);

      // --- Projected Liability ---
      // WHY: Forward-looking exposure. For each active member where today's
      // retail > strike, project (retail - strike) × remaining gallons for
      // the rest of their plan. This answers "if prices stay here, how much
      // more will we owe?" Helps assess whether hedge positions are adequate.
      let projectedLiability = 0;
      for (const [, dayMembers] of membersByDay) {
        for (const m of dayMembers) {
          if (m.endDate > date && m.signupDate <= date) {
            const currentRetail = retailFromFutures(m.fuelType, dayPrices.RBOB, dayPrices.HO, m.stateCode);
            const overMax = Math.max(0, currentRetail - m.strikePrice);
            if (overMax > 0) {
              const daysElapsed = Math.max(0, (date.getTime() - m.signupDate.getTime()) / 86400000);
              const daysLeft = Math.max(0, m.termDays - daysElapsed);
              const gallonsLeft = (m.gallonsPerMonth / 30) * daysLeft;
              projectedLiability += overMax * gallonsLeft;
            }
          }
        }
      }
      projectedLiability = round2(projectedLiability);

      // WHY: Net P&L tracks actual cash flows only — no unrealized MTM or
      // forward liability. This is the real business P&L an accountant would
      // recognize. Hedge MTM and open liability are shown separately as
      // risk metrics, not mixed into P&L.
      //
      // Net P&L = Fees Collected - Hedge Cost - Rebates Paid + Realized P&L (sell-backs)
      const netPnl = round2(
        cumulativePremium - cumulativeHedgeCost - cumulativeRebatesPaid
        + cumulativeRealizedPnl
      );

      allSnapshots.push({
        date,
        model,
        dayNumber: day,
        totalMembers: cumulativeMembers,
        newMembersToday: todayMembers.length,
        // WHY: Use active member gallons remaining, not cumulative all-time.
        // Hedge ratio = open contracts / active gallons. Using cumulative
        // makes the ratio shrink as expired members accumulate, even though
        // we correctly closed those hedge positions.
        totalGallonsCovered: round2(activeMemberGallonsRemaining),
        totalPremiumCollected: round2(cumulativePremium),
        totalHedgeCost: round2(cumulativeHedgeCost),
        hedgePositionCount: openPositionCount,
        totalContractsOpen: openContracts,
        hedgeMtmValue: round2(hedgeMtm),
        netPnl,
        realizedPnl: round2(cumulativeRealizedPnl),
        rebatesPaid: round2(cumulativeRebatesPaid),
        openLiability,
        projectedLiability,
        rbobPrice: dayPrices.RBOB,
        hoPrice: dayPrices.HO,
        portfolioDelta: round2(portDelta),
        portfolioGamma: round4(portGamma),
        portfolioVega: round2(portVega),
        portfolioTheta: round2(portTheta),
      });
    }

    allPositions.push(...positions);
  }

  return { positions: allPositions, snapshots: allSnapshots };
}
