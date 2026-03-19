import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** GET /api/pricing — public endpoint for the active pricing config.
 * WHY: Consumer-facing quotes need the admin-set parameters but
 * should not require admin auth to read them. Only exposes the
 * pricing fields, not metadata like createdBy. */
export async function GET() {
  try {
    const config = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
      select: {
        volatility: true,
        riskFreeRate: true,
        operationalLoad: true,
        profitMargin: true,
        adverseSelectionLoad: true,
      },
    });

    if (!config) {
      // Return defaults if no config exists yet
      return NextResponse.json({
        volatility: 0.40,
        riskFreeRate: 0.045,
        operationalLoad: 0.05,
        profitMargin: 0.03,
        adverseSelectionLoad: 0.10,
      });
    }

    return NextResponse.json(config);
  } catch {
    // Return defaults on DB error so quotes still work
    return NextResponse.json({
      volatility: 0.40,
      riskFreeRate: 0.045,
      operationalLoad: 0.05,
      profitMargin: 0.03,
      adverseSelectionLoad: 0.10,
    });
  }
}
