import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMarketOpen } from "@/lib/market-hours";
import { addPlanToHedgeQueue } from "@/lib/hedge-queue";

/** GET /api/member/plans — list the logged-in user's plans */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plans = await prisma.plan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(plans);
}

/**
 * Load admin settings, returning defaults if no row exists yet.
 * WHY: Single-row pattern — we always have exactly one AdminSettings record.
 */
async function getAdminSettings() {
  const settings = await prisma.adminSettings.findFirst();
  return settings ?? {
    signupsPaused: false,
    maxActivePlansPerUser: 2,
    maxPurchasesPerDay: 1,
    afterHoursVolumeCap: 20,
  };
}

/** POST /api/member/plans — create a new plan (purchase) */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getAdminSettings();

    // --- Kill switch ---
    // WHY: Admin can pause all new signups during black swan events
    // when the after-hours buffer is insufficient protection.
    if (settings.signupsPaused) {
      return NextResponse.json(
        { error: "Gas price protection is temporarily unavailable. Please check back soon." },
        { status: 503 }
      );
    }

    // --- Per-user rate limits ---
    const userId = session.user.id;

    // Check max active plans per user
    // WHY: Prevents individual arb — no one can buy unlimited protection.
    // Default 2 covers a two-car household.
    const activePlanCount = await prisma.plan.count({
      where: { userId, status: "ACTIVE" },
    });
    if (activePlanCount >= settings.maxActivePlansPerUser) {
      return NextResponse.json(
        { error: `You can have at most ${settings.maxActivePlansPerUser} active plans.` },
        { status: 429 }
      );
    }

    // Check purchases in last 24 hours
    // WHY: Rate limit — prevents rapid-fire purchases from bots or
    // sophisticated actors trying to front-run a known price move.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPurchases = await prisma.plan.count({
      where: { userId, createdAt: { gte: oneDayAgo } },
    });
    if (recentPurchases >= settings.maxPurchasesPerDay) {
      return NextResponse.json(
        { error: "You can only purchase one plan per day. Please try again tomorrow." },
        { status: 429 }
      );
    }

    // --- After-hours volume cap ---
    // WHY: When CME is closed, cap total new signups system-wide to
    // bound maximum unhedged exposure. Even if many users try, the
    // company's worst-case gap risk is limited to a known amount.
    const marketOpen = isMarketOpen();
    if (!marketOpen) {
      // Count plans created since market last closed.
      // WHY: We approximate "current closed window" by counting plans
      // created in the last 72 hours with PENDING_HEDGE status.
      // This covers weekends (max ~49 hours) and holidays (up to 72 hours).
      const windowStart = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const afterHoursPlanCount = await prisma.plan.count({
        where: {
          hedgeStatus: "PENDING_HEDGE",
          createdAt: { gte: windowStart },
        },
      });
      if (afterHoursPlanCount >= settings.afterHoursVolumeCap) {
        return NextResponse.json(
          { error: "We're processing a high volume of requests. Please try again when markets open." },
          { status: 503 }
        );
      }
    }

    const body = await request.json();

    const {
      spotPrice,
      strikePrice,
      termDays,
      gallonsPerMonth,
      premiumPerGallon,
      upfrontPrice,
      monthlyEquivalent,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleMpg,
      monthlyMiles,
      fuelType,
      zip,
      cityState,
      stateCode,
    } = body;

    console.log("Plan creation body:", JSON.stringify({
      spotPrice, strikePrice, termDays, gallonsPerMonth,
      premiumPerGallon, upfrontPrice, monthlyEquivalent, zip,
      vehicleYear, fuelType, marketOpen,
    }));

    // Validate required fields
    if (!spotPrice || !strikePrice || !termDays || !gallonsPerMonth || !upfrontPrice || !zip) {
      return NextResponse.json(
        { error: "Missing required plan fields" },
        { status: 400 }
      );
    }

    // Get active pricing config
    const activePricing = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
    });

    const endDate = new Date();
    // WHY: Use exact day count instead of month arithmetic to avoid
    // variable-length month ambiguity.
    endDate.setDate(endDate.getDate() + termDays);

    // WHY: After-hours signups get PENDING_HEDGE status. The hedge
    // executes when the market opens via batch queue processing.
    const hedgeStatus = marketOpen ? "HEDGED" : "PENDING_HEDGE";

    // WHY: Coerce types to match Prisma schema — JSON body values may
    // arrive as unexpected types (e.g., float where Int is expected).
    const plan = await prisma.plan.create({
      data: {
        userId,
        spotPrice: Number(spotPrice),
        strikePrice: Number(strikePrice),
        termDays: Math.round(Number(termDays)),
        gallonsPerMonth: Number(gallonsPerMonth),
        premiumPerGallon: Number(premiumPerGallon || 0),
        upfrontPrice: Number(upfrontPrice),
        monthlyEquivalent: Number(monthlyEquivalent || 0),
        hedgeStatus: hedgeStatus as "HEDGED" | "PENDING_HEDGE",
        vehicleYear: vehicleYear ? Math.round(Number(vehicleYear)) : null,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehicleMpg: vehicleMpg ? Number(vehicleMpg) : null,
        monthlyMiles: monthlyMiles ? Math.round(Number(monthlyMiles)) : null,
        fuelType: fuelType || null,
        zip,
        cityState: cityState || null,
        stateCode: stateCode || null,
        endDate,
        pricingConfigId: activePricing?.id || null,
      },
    });

    // Update user's zip if not already set
    await prisma.user.update({
      where: { id: userId },
      data: { zip: zip },
    });

    // WHY: Add this plan's gallons to the appropriate strike bucket(s).
    // This feeds the hedge queue dashboard so the admin knows when to
    // execute CME option purchases.
    if (stateCode && fuelType) {
      try {
        const queueResult = await addPlanToHedgeQueue({
          strikePrice: Number(strikePrice),
          stateCode,
          fuelType,
          gallonsPerMonth: Number(gallonsPerMonth),
          termDays: Math.round(Number(termDays)),
          startDate: new Date(),
        });
        console.log("Hedge queue updated:", JSON.stringify(queueResult));
      } catch (queueErr) {
        // WHY: Don't fail the plan creation if hedge queue update fails.
        // The plan is already created and paid for. Log the error so
        // the admin can manually reconcile.
        console.error("Hedge queue update failed (plan still created):", queueErr);
      }
    }

    return NextResponse.json(plan, { status: 201 });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string; meta?: unknown; message?: string };
    console.error("Plan creation failed:", {
      code: prismaErr.code,
      meta: prismaErr.meta,
      message: prismaErr.message?.substring(0, 500),
    });
    return NextResponse.json(
      {
        error: prismaErr.message?.substring(0, 300) || "Failed to create plan",
        code: prismaErr.code,
      },
      { status: 500 }
    );
  }
}
