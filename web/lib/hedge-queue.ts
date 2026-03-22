/**
 * Hedge Queue — Strike Bucket Pooling & Trigger Logic
 *
 * Aggregates member gallons into $0.05 CME strike buckets by instrument
 * and expiry month. When a bucket's accumulated gallons hit the configurable
 * trigger threshold, it transitions to READY status for manual execution.
 *
 * WHY: The smallest exchange-traded RBOB option is 4,200 gallons (micro contract).
 * We can't buy fractional contracts, so we pool member gallons until we have
 * enough to fill a contract at each strike level. Sub-threshold gallons are
 * "self-insured" from collected membership fees.
 */

import { prisma } from "./db";
import { getHedgeStrike } from "./state-spreads";

// WHY: Default contract size for micro NYMEX RBOB/HO options.
// This is CME-defined and cannot change — it's here for reference only.
export const MICRO_CONTRACT_SIZE = 4200;

/**
 * Add a new plan's gallons to the appropriate strike bucket(s).
 *
 * WHY: When a member signs up, their total gallons (gallonsPerMonth × termMonths)
 * are split across monthly expiry buckets, just like the hedge engine does.
 * Each month's gallons go into the bucket for that settlement month at the
 * appropriate hedge strike level.
 */
export async function addPlanToHedgeQueue(plan: {
  strikePrice: number; // Member's retail max price
  stateCode: string;
  fuelType: string;
  gallonsPerMonth: number;
  termDays: number;
  startDate: Date;
}): Promise<{
  bucketsUpdated: number;
  bucketsTriggered: string[]; // Bucket IDs that hit the trigger threshold
}> {
  const { hedgeStrike, instrument } = await getHedgeStrike(
    plan.strikePrice,
    plan.stateCode,
    plan.fuelType
  );

  const settings = await prisma.adminSettings.findFirst();
  const globalThreshold = settings?.hedgeTriggerGallons ?? MICRO_CONTRACT_SIZE;

  const months = plan.termDays / 30;
  let bucketsUpdated = 0;
  const bucketsTriggered: string[] = [];

  for (let mo = 0; mo < months; mo++) {
    const settlementDate = new Date(plan.startDate);
    settlementDate.setDate(settlementDate.getDate() + (mo + 1) * 30);

    // WHY: Bucket key = "YYYY-MM" — aligns with CME monthly option expirations.
    const expiryMonth = `${settlementDate.getFullYear()}-${String(
      settlementDate.getMonth() + 1
    ).padStart(2, "0")}`;

    // Upsert the bucket: create if doesn't exist, add gallons if it does
    const bucket = await prisma.strikeBucket.upsert({
      where: {
        strikePrice_instrument_expiryMonth: {
          strikePrice: hedgeStrike,
          instrument,
          expiryMonth,
        },
      },
      create: {
        strikePrice: hedgeStrike,
        instrument,
        expiryMonth,
        accumulatedGallons: plan.gallonsPerMonth,
        memberCount: 1,
        status: "FILLING",
      },
      update: {
        accumulatedGallons: { increment: plan.gallonsPerMonth },
        memberCount: { increment: 1 },
      },
    });

    bucketsUpdated++;

    // Check if this bucket just hit the trigger threshold
    const threshold = bucket.triggerOverride ?? globalThreshold;
    if (bucket.accumulatedGallons >= threshold && bucket.status === "FILLING") {
      await prisma.strikeBucket.update({
        where: { id: bucket.id },
        data: { status: "READY" },
      });
      bucketsTriggered.push(bucket.id);
    }
  }

  return { bucketsUpdated, bucketsTriggered };
}

/**
 * Get all strike buckets with their current status and fill levels.
 *
 * WHY: Powers the Hedge Queue dashboard. Admin sees each bucket's
 * progress toward the trigger threshold and can execute when ready.
 */
export async function getHedgeQueueStatus(): Promise<{
  buckets: Array<{
    id: string;
    strikePrice: number;
    instrument: string;
    expiryMonth: string;
    accumulatedGallons: number;
    memberCount: number;
    triggerThreshold: number;
    triggerOverride: number | null;
    fillPercent: number;
    gallonsToTrigger: number;
    contractsNeeded: number;
    status: string;
  }>;
  summary: {
    totalBuckets: number;
    fillingBuckets: number;
    readyBuckets: number;
    executedBuckets: number;
    totalUnhedgedGallons: number;
    totalHedgedGallons: number;
  };
}> {
  const settings = await prisma.adminSettings.findFirst();
  const globalThreshold = settings?.hedgeTriggerGallons ?? MICRO_CONTRACT_SIZE;

  const rawBuckets = await prisma.strikeBucket.findMany({
    orderBy: [
      { status: "asc" }, // FILLING first, then READY, then EXECUTED
      { expiryMonth: "asc" },
      { strikePrice: "asc" },
    ],
  });

  const buckets = rawBuckets.map((b) => {
    const threshold = b.triggerOverride ?? globalThreshold;
    const fillPercent = threshold > 0 ? (b.accumulatedGallons / threshold) * 100 : 0;
    const gallonsToTrigger = Math.max(0, threshold - b.accumulatedGallons);
    const contractsNeeded = Math.ceil(b.accumulatedGallons / MICRO_CONTRACT_SIZE);

    return {
      id: b.id,
      strikePrice: b.strikePrice,
      instrument: b.instrument,
      expiryMonth: b.expiryMonth,
      accumulatedGallons: b.accumulatedGallons,
      memberCount: b.memberCount,
      triggerThreshold: threshold,
      triggerOverride: b.triggerOverride,
      fillPercent: Math.min(100, Math.round(fillPercent * 10) / 10),
      gallonsToTrigger,
      contractsNeeded,
      status: b.status,
    };
  });

  const fillingBuckets = buckets.filter((b) => b.status === "FILLING");
  const readyBuckets = buckets.filter((b) => b.status === "READY");
  const executedBuckets = buckets.filter((b) => b.status === "EXECUTED");

  return {
    buckets,
    summary: {
      totalBuckets: buckets.length,
      fillingBuckets: fillingBuckets.length,
      readyBuckets: readyBuckets.length,
      executedBuckets: executedBuckets.length,
      totalUnhedgedGallons: [...fillingBuckets, ...readyBuckets].reduce(
        (sum, b) => sum + b.accumulatedGallons,
        0
      ),
      totalHedgedGallons: executedBuckets.reduce(
        (sum, b) => sum + b.accumulatedGallons,
        0
      ),
    },
  };
}

/**
 * Mark a bucket as executed after the admin manually purchases the hedge.
 *
 * WHY: v1 uses manual execution — admin reviews the bucket, checks the
 * estimated premium, and clicks "Execute" on the dashboard. The system
 * records the execution but doesn't auto-submit to a brokerage API.
 */
export async function markBucketExecuted(bucketId: string): Promise<void> {
  await prisma.strikeBucket.update({
    where: { id: bucketId },
    data: { status: "EXECUTED" },
  });
}

/**
 * Update the trigger threshold override for a specific bucket.
 *
 * WHY: Admin can set a tighter threshold on fast-filling buckets
 * (e.g., 3,500 instead of 4,200) to get ahead of demand, or remove
 * the override (set to null) to use the global default.
 */
export async function setBucketTriggerOverride(
  bucketId: string,
  threshold: number | null
): Promise<void> {
  await prisma.strikeBucket.update({
    where: { id: bucketId },
    data: { triggerOverride: threshold },
  });

  // Re-evaluate status after threshold change
  if (threshold !== null) {
    const bucket = await prisma.strikeBucket.findUnique({ where: { id: bucketId } });
    if (bucket && bucket.status === "FILLING" && bucket.accumulatedGallons >= threshold) {
      await prisma.strikeBucket.update({
        where: { id: bucketId },
        data: { status: "READY" },
      });
    }
  }
}

/**
 * Get buckets that are at or above the near-threshold alert percentage.
 *
 * WHY: Gives the admin a heads-up that a bucket is about to trigger,
 * so they can plan capital for the upcoming contract purchase.
 */
export async function getNearThresholdBuckets(): Promise<
  Array<{ id: string; strikePrice: number; instrument: string; expiryMonth: string; fillPercent: number }>
> {
  const settings = await prisma.adminSettings.findFirst();
  const globalThreshold = settings?.hedgeTriggerGallons ?? MICRO_CONTRACT_SIZE;
  const alertPct = settings?.nearThresholdAlertPct ?? 0.80;

  const buckets = await prisma.strikeBucket.findMany({
    where: { status: "FILLING" },
  });

  return buckets
    .map((b) => {
      const threshold = b.triggerOverride ?? globalThreshold;
      const fillPercent = threshold > 0 ? b.accumulatedGallons / threshold : 0;
      return {
        id: b.id,
        strikePrice: b.strikePrice,
        instrument: b.instrument,
        expiryMonth: b.expiryMonth,
        fillPercent,
      };
    })
    .filter((b) => b.fillPercent >= alertPct)
    .sort((a, b) => b.fillPercent - a.fillPercent);
}
