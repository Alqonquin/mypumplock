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

  const configs = await prisma.pricingConfig.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(configs);
}

/** POST /api/admin/pricing — create a new pricing config (deactivates previous) */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // WHY: Deactivate all existing configs, then create the new one as active.
    // This ensures exactly one active config at all times.
    await prisma.pricingConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const config = await prisma.pricingConfig.create({
      data: {
        label: body.label || null,
        isActive: true,
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
