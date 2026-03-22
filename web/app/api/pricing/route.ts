import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveVolatility } from "@/lib/vol-monitor";
import { getRiskFreeRate } from "@/lib/treasury-rate";

/** GET /api/pricing — public endpoint for the active pricing config.
 * WHY: Consumer-facing quotes need the admin-set parameters but
 * should not require admin auth to read them. The volatility returned
 * is max(configVol, realtimeVol) so we never quote below market. */
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

    const defaults = {
      volatility: 0.40,
      riskFreeRate: 0.045,
      operationalLoad: 0.05,
      profitMargin: 0.03,
      adverseSelectionLoad: 0.10,
    };

    const base = config || defaults;

    // WHY: Override volatility and risk-free rate with real-time market
    // data. Vol comes from RBOB futures, rate from Treasury T-Bills.
    // This keeps pricing aligned with actual market conditions.
    try {
      const [volData, rateData] = await Promise.all([
        getEffectiveVolatility().catch(() => null),
        getRiskFreeRate().catch(() => null),
      ]);
      return NextResponse.json({
        ...base,
        volatility: volData?.effectiveVol ?? base.volatility,
        riskFreeRate: rateData?.rate ?? base.riskFreeRate,
      });
    } catch {
      return NextResponse.json(base);
    }
  } catch {
    return NextResponse.json({
      volatility: 0.40,
      riskFreeRate: 0.045,
      operationalLoad: 0.05,
      profitMargin: 0.03,
      adverseSelectionLoad: 0.10,
    });
  }
}
