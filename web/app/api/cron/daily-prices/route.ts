import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// WHY: Map our fuel type strings to GasBuddy's numeric fuel IDs.
const FUEL_TYPE_MAP: Record<string, number> = {
  "Regular Gasoline": 1,
  "Premium Gasoline": 3,
  "Diesel": 4,
};

// WHY: GasBuddy's GraphQL endpoint gives us real-time average prices by zip.
// This is our v1 data source — OPIS would be the production upgrade.
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

/**
 * POST /api/cron/daily-prices
 *
 * Daily cron job that fetches current gas prices for each active membership
 * and records them in the DailyPrice table. Should be called once per day.
 *
 * Protected by a CRON_SECRET header to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
  // WHY: Simple shared-secret auth so only our scheduler can trigger this.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activePlans = await prisma.plan.findMany({
    where: { status: "ACTIVE" },
    include: {
      dailyPrices: {
        orderBy: { day: "desc" },
        take: 1,
      },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // WHY: Group plans by zip+fuelType so we don't hammer GasBuddy
  // with duplicate requests for the same location/fuel combo.
  const priceCache: Record<string, number | null> = {};

  for (const plan of activePlans) {
    const startDate = new Date(plan.startDate);
    startDate.setHours(0, 0, 0, 0);

    const dayNumber = Math.ceil(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Skip if day hasn't started yet or is past the term
    if (dayNumber < 1 || dayNumber > plan.termDays) {
      skipped++;
      continue;
    }

    // Skip if we already have a record for this day
    const lastRecord = plan.dailyPrices[0];
    if (lastRecord && lastRecord.day >= dayNumber) {
      skipped++;
      continue;
    }

    const fuelTypeId = FUEL_TYPE_MAP[plan.fuelType || "Regular Gasoline"] ?? 1;
    const cacheKey = `${plan.zip}:${fuelTypeId}`;

    if (!(cacheKey in priceCache)) {
      priceCache[cacheKey] = await fetchGasBuddyPrice(plan.zip, fuelTypeId);
    }

    const avgPrice = priceCache[cacheKey];
    if (avgPrice === null) {
      errors++;
      continue;
    }

    const dailyGallons = plan.gallonsPerMonth / 30;
    const dailyRebate =
      avgPrice > plan.strikePrice
        ? Math.round((avgPrice - plan.strikePrice) * dailyGallons * 100) / 100
        : 0;

    // WHY: Get the running total from the previous day's record.
    // If no previous record exists, this is the first day.
    const prevTotal = lastRecord ? lastRecord.totalRebate : 0;
    const totalRebate = Math.round((prevTotal + dailyRebate) * 100) / 100;

    try {
      await prisma.dailyPrice.create({
        data: {
          planId: plan.id,
          day: dayNumber,
          date: today,
          dailyGallons: Math.round(dailyGallons * 100) / 100,
          avgPrice,
          memberMaxPrice: plan.strikePrice,
          dailyRebate,
          totalRebate,
        },
      });
      processed++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    processed,
    skipped,
    errors,
    totalActivePlans: activePlans.length,
    date: today.toISOString().slice(0, 10),
  });
}
