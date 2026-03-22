import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// WHY: GasBuddy gives us today's real retail price per zip/fuel combo.
// This is the same source the daily-prices cron uses.
const GASBUDDY_URL = "https://www.gasbuddy.com/graphql";
const GASBUDDY_QUERY = `
  query LocationBySearchTerm($search: String) {
    locationBySearchTerm(search: $search) {
      trends {
        areaName
        country
        today
        todayLow
      }
    }
  }
`;
const FUEL_TYPE_MAP: Record<string, number> = {
  "Regular Gasoline": 1,
  "Premium Gasoline": 3,
  "Diesel": 4,
};

async function fetchGasBuddyPrice(zip: string, fuelTypeId: number): Promise<number | null> {
  try {
    const res = await fetch(GASBUDDY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: GASBUDDY_QUERY,
        variables: { fuel: fuelTypeId, maxAge: 0, search: zip },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const trends = data?.data?.locationBySearchTerm?.trends;
    if (!trends || trends.length === 0) return null;
    const price = parseFloat(trends[0].today);
    return isNaN(price) ? null : price;
  } catch {
    return null;
  }
}

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

  // WHY: Exposure = for each active plan, the amount we'd owe based on
  // today's actual retail price vs the member's strike. This is real
  // market-based liability, not a theoretical spike assumption.
  let totalMaxExposure = 0;
  let totalPremiumCollected = 0;
  let totalGallonsCovered = 0;
  let totalActivePlans = 0;

  const byState: Record<string, { plans: number; exposure: number; premium: number }> = {};
  const byTerm: Record<number, { plans: number; exposure: number; premium: number }> = {};

  // WHY: Cache GasBuddy lookups by zip:fuelType to avoid duplicate
  // requests for plans in the same location with the same fuel type.
  const priceCache: Record<string, number | null> = {};

  const planDetails = await Promise.all(
    activePlans.map(async (plan) => {
      const daysElapsed = Math.max(
        0,
        (now.getTime() - plan.startDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      const daysRemaining = Math.max(0, plan.termDays - daysElapsed);
      const gallonsRemaining = (plan.gallonsPerMonth / 30) * daysRemaining;

      // Fetch today's real retail price for this plan's zip/fuel
      const fuelTypeId = FUEL_TYPE_MAP[plan.fuelType || "Regular Gasoline"] ?? 1;
      const cacheKey = `${plan.zip}:${fuelTypeId}`;
      if (!(cacheKey in priceCache)) {
        priceCache[cacheKey] = await fetchGasBuddyPrice(plan.zip, fuelTypeId);
      }
      const currentRetailPrice = priceCache[cacheKey];

      // WHY: Exposure = max(0, currentPrice - strike) × gallonsRemaining.
      // If current price is below strike, exposure is $0 — member has no rebate.
      const priceAboveStrike =
        currentRetailPrice !== null
          ? Math.max(0, currentRetailPrice - plan.strikePrice)
          : 0;
      const maxExposure = priceAboveStrike * gallonsRemaining;

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
        currentRetailPrice,
        priceAboveStrike: Math.round(priceAboveStrike * 1000) / 1000,
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
    })
  );

  return NextResponse.json({
    summary: {
      totalActivePlans,
      totalMaxExposure: Math.round(totalMaxExposure * 100) / 100,
      totalPremiumCollected: Math.round(totalPremiumCollected * 100) / 100,
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
