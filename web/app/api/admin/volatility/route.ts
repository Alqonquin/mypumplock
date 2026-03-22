import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveVolatility, volImpactPreview, clearVolCache } from "@/lib/vol-monitor";
import { fetchRBOB, fetchHO } from "@/lib/yahoo-finance";

/** GET /api/admin/volatility — Real-time vol dashboard data */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const volData = await getEffectiveVolatility();

    // Fetch RBOB and HO price history for charts
    let priceHistory: { date: string; close: number }[] = [];
    let hoPriceHistory: { date: string; close: number }[] = [];
    try {
      const [rbob, ho] = await Promise.all([fetchRBOB("3mo"), fetchHO("3mo")]);
      priceHistory = rbob.days.map((d) => ({
        date: d.dateStr,
        close: d.close,
      }));
      hoPriceHistory = ho.days.map((d) => ({
        date: d.dateStr,
        close: d.close,
      }));
    } catch {
      // Price history is optional for the dashboard
    }

    // Compute impact preview: what happens if vol moves to various levels
    // WHY: Helps admin understand the dollar impact of vol changes
    // on a typical membership before deciding to override.
    const latestPrice = priceHistory.length > 0
      ? priceHistory[priceHistory.length - 1].close + 0.95 // RBOB + rack spread ≈ retail
      : 3.50; // fallback

    const impactLevels = [0.25, 0.40, 0.55, 0.70, 0.85, 1.00];
    const impacts = impactLevels.map((toVol) => ({
      vol: toVol,
      ...volImpactPreview(latestPrice, volData.configVol, toVol),
    }));

    return NextResponse.json({
      ...volData,
      priceHistory,
      hoPriceHistory,
      impacts,
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { error: e.message || "Failed to fetch volatility data" },
      { status: 500 }
    );
  }
}

/** POST /api/admin/volatility — Force refresh vol cache */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearVolCache();
  const volData = await getEffectiveVolatility();
  return NextResponse.json(volData);
}
