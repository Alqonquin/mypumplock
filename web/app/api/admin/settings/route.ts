import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { seedStateSpreads } from "@/lib/state-spreads";
import { getMarketStatus } from "@/lib/market-hours";

/**
 * GET /api/admin/settings — fetch admin settings, state spreads, and market status
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure default settings row exists
  let settings = await prisma.adminSettings.findFirst();
  if (!settings) {
    settings = await prisma.adminSettings.create({
      data: { id: "default" },
    });
  }

  const stateSpreads = await prisma.stateSpread.findMany({
    orderBy: { stateCode: "asc" },
  });

  const marketStatus = getMarketStatus();

  return NextResponse.json({
    settings,
    stateSpreads,
    marketStatus,
  });
}

/**
 * PUT /api/admin/settings — update admin settings
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // WHY: Handle different update targets via an "action" field.
    // This keeps a single endpoint for all settings operations.
    const { action } = body;

    if (action === "updateSettings") {
      const {
        afterHoursBufferRate,
        signupsPaused,
        maxActivePlansPerUser,
        maxPurchasesPerDay,
        afterHoursVolumeCap,
        hedgeTriggerGallons,
        nearThresholdAlertPct,
      } = body;

      const settings = await prisma.adminSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          afterHoursBufferRate: Number(afterHoursBufferRate ?? 0.03),
          signupsPaused: Boolean(signupsPaused),
          maxActivePlansPerUser: Math.round(Number(maxActivePlansPerUser ?? 2)),
          maxPurchasesPerDay: Math.round(Number(maxPurchasesPerDay ?? 1)),
          afterHoursVolumeCap: Math.round(Number(afterHoursVolumeCap ?? 20)),
          hedgeTriggerGallons: Math.round(Number(hedgeTriggerGallons ?? 4200)),
          nearThresholdAlertPct: Number(nearThresholdAlertPct ?? 0.80),
        },
        update: {
          ...(afterHoursBufferRate !== undefined && { afterHoursBufferRate: Number(afterHoursBufferRate) }),
          ...(signupsPaused !== undefined && { signupsPaused: Boolean(signupsPaused) }),
          ...(maxActivePlansPerUser !== undefined && { maxActivePlansPerUser: Math.round(Number(maxActivePlansPerUser)) }),
          ...(maxPurchasesPerDay !== undefined && { maxPurchasesPerDay: Math.round(Number(maxPurchasesPerDay)) }),
          ...(afterHoursVolumeCap !== undefined && { afterHoursVolumeCap: Math.round(Number(afterHoursVolumeCap)) }),
          ...(hedgeTriggerGallons !== undefined && { hedgeTriggerGallons: Math.round(Number(hedgeTriggerGallons)) }),
          ...(nearThresholdAlertPct !== undefined && { nearThresholdAlertPct: Number(nearThresholdAlertPct) }),
        },
      });

      return NextResponse.json({ settings });
    }

    if (action === "updateStateSpread") {
      const { stateCode, regularSpread, premiumSpread, dieselSpread } = body;

      if (!stateCode) {
        return NextResponse.json({ error: "stateCode required" }, { status: 400 });
      }

      const spread = await prisma.stateSpread.upsert({
        where: { stateCode },
        create: {
          stateCode,
          stateName: body.stateName || stateCode,
          regularSpread: Number(regularSpread),
          premiumSpread: Number(premiumSpread),
          dieselSpread: Number(dieselSpread),
          lastUpdated: new Date(),
        },
        update: {
          ...(regularSpread !== undefined && { regularSpread: Number(regularSpread) }),
          ...(premiumSpread !== undefined && { premiumSpread: Number(premiumSpread) }),
          ...(dieselSpread !== undefined && { dieselSpread: Number(dieselSpread) }),
          lastUpdated: new Date(),
        },
      });

      return NextResponse.json({ spread });
    }

    if (action === "seedStateSpreads") {
      const inserted = await seedStateSpreads();
      return NextResponse.json({ inserted, message: `Seeded ${inserted} state spreads` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Settings update failed:", e.message);
    return NextResponse.json(
      { error: e.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
