import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

/** GET /api/admin/pricing — get active pricing config + history */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // WHY: Before returning, check if any scheduled config has passed its
  // effectiveAt time and should auto-activate. This runs on every GET so
  // the dashboard always reflects the current state.
  const now = new Date();
  const pendingConfigs = await prisma.pricingConfig.findMany({
    where: {
      isActive: false,
      effectiveAt: { not: null, lte: now },
    },
    orderBy: { effectiveAt: "desc" },
    take: 1,
  });

  if (pendingConfigs.length > 0) {
    // Deactivate current, activate the scheduled one
    await prisma.pricingConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await prisma.pricingConfig.update({
      where: { id: pendingConfigs[0].id },
      data: { isActive: true },
    });
  }

  const configs = await prisma.pricingConfig.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(configs);
}

/** POST /api/admin/pricing — create a new pricing config */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const effectiveAt = body.effectiveAt ? new Date(body.effectiveAt) : null;
    // WHY: If effectiveAt is in the future, create as inactive (scheduled).
    // If effectiveAt is null or in the past, activate immediately.
    const activateNow = !effectiveAt || effectiveAt <= new Date();

    if (activateNow) {
      await prisma.pricingConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const config = await prisma.pricingConfig.create({
      data: {
        label: body.label || null,
        isActive: activateNow,
        effectiveAt,
        volatility: body.volatility ?? 0.40,
        riskFreeRate: body.riskFreeRate ?? 0.045,
        operationalLoad: body.operationalLoad ?? 0.05,
        profitMargin: body.profitMargin ?? 0.03,
        adverseSelectionLoad: body.adverseSelectionLoad ?? 0.10,
        seasonalAdjustments: body.seasonalAdjustments || null,
        createdBy: session.user.email,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to save pricing config" },
      { status: 500 }
    );
  }
}
