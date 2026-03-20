import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/member/plans/[id] — single plan with daily rebate breakdown */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const plan = await prisma.plan.findUnique({
    where: { id },
  });

  if (!plan || plan.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // WHY: Generate simulated daily price data for the plan's term.
  // Uses a seeded PRNG so the same plan always shows the same prices —
  // keeps the table stable across page reloads. In production this would
  // be replaced by actual daily price tracking from a market data feed.
  const startDate = new Date(plan.startDate);
  const endDate = new Date(plan.endDate);
  const now = new Date();
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
  );

  const dailyGallons = plan.gallonsPerMonth / 30;

  // WHY: Simple seeded PRNG from the plan ID so each plan gets
  // a unique but reproducible price series.
  let seed = 0;
  for (let i = 0; i < plan.id.length; i++) {
    seed = ((seed << 5) - seed + plan.id.charCodeAt(i)) | 0;
  }
  function seededRandom() {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 0xffffffff);
  }

  const days = [];
  let price = plan.spotPrice;
  let totalRebate = 0;

  // WHY: Volatility of $0.03/day with slight upward drift creates
  // a realistic-looking price series that trends above the strike.
  const dailyVol = 0.03;
  const drift = 0.002;

  // WHY: Generate prices for all days so the member can see the full
  // term at a glance. Future days are marked as projections.
  for (let d = 1; d <= totalDays; d++) {
    // Random walk: drift up + noise, mean-revert gently toward spot
    const noise = (seededRandom() - 0.48) * dailyVol;
    const revert = (plan.spotPrice - price) * 0.01;
    price = Math.max(
      plan.spotPrice * 0.85,
      price + drift + revert + noise
    );

    const dailyAvgPrice = Math.round(price * 1000) / 1000;
    const dailyRebate =
      dailyAvgPrice > plan.strikePrice
        ? Math.round((dailyAvgPrice - plan.strikePrice) * dailyGallons * 100) / 100
        : 0;
    totalRebate = Math.round((totalRebate + dailyRebate) * 100) / 100;

    days.push({
      day: d,
      date: new Date(startDate.getTime() + (d - 1) * 86400000)
        .toISOString()
        .slice(0, 10),
      // WHY: Future days are projections, not actuals — the frontend
      // can dim or label them differently.
      elapsed: d <= elapsedDays,
      dailyGallons: Math.round(dailyGallons * 100) / 100,
      dailyAvgPrice,
      maxMemberPrice: plan.strikePrice,
      dailyRebate,
      totalRebate,
    });
  }

  return NextResponse.json({
    plan,
    totalDays,
    elapsedDays,
    dailyGallons: Math.round(dailyGallons * 100) / 100,
    days,
  });
}
