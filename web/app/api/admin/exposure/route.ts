import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/admin/exposure — calculate total open exposure across active plans */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activePlans = await prisma.plan.findMany({
    where: { status: "ACTIVE" },
    include: { user: { select: { email: true, name: true } } },
  });

  const now = new Date();

  // WHY: Exposure = for each active plan, the max we could owe if gas
  // hits an extreme price. We calculate remaining months × gallons × buffer
  // above strike as the theoretical max payout.
  let totalMaxExposure = 0;
  let totalPremiumCollected = 0;
  let totalGallonsCovered = 0;
  let totalActivePlans = 0;

  const byState: Record<string, { plans: number; exposure: number; premium: number }> = {};
  const byTerm: Record<number, { plans: number; exposure: number; premium: number }> = {};

  const planDetails = activePlans.map((plan) => {
    const daysElapsed = Math.max(
      0,
      (now.getTime() - plan.startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const daysRemaining = Math.max(0, plan.termDays - daysElapsed);
    // WHY: gallonsPerMonth / 30 = daily gallons, × daysRemaining = gallons left.
    const gallonsRemaining = (plan.gallonsPerMonth / 30) * daysRemaining;

    // WHY: Max exposure assumes gas could spike $3/gal above strike.
    // This is a conservative estimate — actual exposure depends on real prices.
    const maxSpikeAboveStrike = 3.0;
    const maxExposure = gallonsRemaining * maxSpikeAboveStrike;

    totalMaxExposure += maxExposure;
    totalPremiumCollected += plan.upfrontPrice;
    totalGallonsCovered += (plan.gallonsPerMonth / 30) * plan.termDays;
    totalActivePlans++;

    const state = plan.stateCode || "??";
    if (!byState[state]) byState[state] = { plans: 0, exposure: 0, premium: 0 };
    byState[state].plans++;
    byState[state].exposure += maxExposure;
    byState[state].premium += plan.upfrontPrice;

    if (!byTerm[plan.termDays]) byTerm[plan.termDays] = { plans: 0, exposure: 0, premium: 0 };
    byTerm[plan.termDays].plans++;
    byTerm[plan.termDays].exposure += maxExposure;
    byTerm[plan.termDays].premium += plan.upfrontPrice;

    return {
      id: plan.id,
      userEmail: plan.user.email,
      userName: plan.user.name,
      strikePrice: plan.strikePrice,
      spotAtPurchase: plan.spotPrice,
      termDays: plan.termDays,
      gallonsPerMonth: plan.gallonsPerMonth,
      daysRemaining: Math.round(daysRemaining),
      gallonsRemaining: Math.round(gallonsRemaining),
      maxExposure: Math.round(maxExposure * 100) / 100,
      premiumPaid: plan.upfrontPrice,
      stateCode: plan.stateCode,
      startDate: plan.startDate,
      endDate: plan.endDate,
    };
  });

  return NextResponse.json({
    summary: {
      totalActivePlans,
      totalMaxExposure: Math.round(totalMaxExposure * 100) / 100,
      totalPremiumCollected: Math.round(totalPremiumCollected * 100) / 100,
      // WHY: Premium-to-exposure ratio > 1 means we've collected more than we could owe.
      // In practice this will always be < 1 since max exposure is theoretical.
      premiumToExposureRatio:
        totalMaxExposure > 0
          ? Math.round((totalPremiumCollected / totalMaxExposure) * 1000) / 1000
          : 0,
      totalGallonsCovered: Math.round(totalGallonsCovered),
    },
    byState,
    byTerm,
    plans: planDetails,
  });
}
