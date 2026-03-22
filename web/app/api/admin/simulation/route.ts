import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRealFuturesPrices, generateSimMembers } from "@/lib/simulation";
import { runHedgeStrategies } from "@/lib/hedge-engine";

// WHY: Simulation generates thousands of members and runs hedge strategies
// across ~60 trading days. Default 60s timeout is tight with Yahoo Finance
// fetch + hedge engine + DB writes.
export const maxDuration = 120;

/** POST /api/admin/simulation — Run (or re-run) the full hedge book simulation.
 *
 * WHY: No manual parameters. The simulation uses:
 * - Vol: computed per-day from actual RBOB price series (10-day rolling)
 * - Margin: operationalLoad + profitMargin + adverseSelectionLoad from PricingConfig
 * - Risk-free rate: from PricingConfig (which auto-updates from Treasury API)
 * - Contract size: always micro (4,200 gal)
 * - Hedge threshold: 75% of contract (3,150 gal) before first purchase
 *
 * This ensures the simulation replays reality — same pricing engine, same
 * parameters, same logic as real member quotes.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // --- Fetch active pricing config ---
    // WHY: Simulation uses the same pricing parameters as real member quotes.
    const pricingConfig = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
      select: {
        operationalLoad: true,
        profitMargin: true,
        adverseSelectionLoad: true,
        riskFreeRate: true,
      },
    });

    const simPricingConfig = {
      operationalLoad: pricingConfig?.operationalLoad ?? 0.05,
      profitMargin: pricingConfig?.profitMargin ?? 0.03,
      adverseSelectionLoad: pricingConfig?.adverseSelectionLoad ?? 0.10,
      riskFreeRate: pricingConfig?.riskFreeRate ?? 0.045,
    };

    // --- Clear previous simulation data ---
    // WHY: Full wipe ensures no stale data from prior runs.
    // Order matters for any future FK constraints.
    await prisma.hedgeBookSnapshot.deleteMany();
    await prisma.hedgePosition.deleteMany();
    await prisma.simMember.deleteMany();
    await prisma.futuresPrice.deleteMany();

    // --- Step 1: Fetch real futures prices from Yahoo Finance ---
    console.log("[Simulation] Fetching futures prices from Yahoo Finance...");
    const futuresPrices = await fetchRealFuturesPrices();
    console.log(`[Simulation] Got ${futuresPrices.length} price rows`);
    await prisma.futuresPrice.createMany({
      data: futuresPrices.map((fp) => ({
        date: fp.date,
        instrument: fp.instrument,
        open: fp.open,
        high: fp.high,
        low: fp.low,
        settle: fp.settle,
        volume: fp.volume,
      })),
      // WHY: Safety net in case Yahoo Finance returns timestamps that
      // deduplicate to the same (date, instrument) pair.
      skipDuplicates: true,
    });

    // --- Step 2: Generate simulated members ---
    console.log("[Simulation] Generating simulated members...");
    const simMembers = generateSimMembers(futuresPrices, simPricingConfig);
    console.log(`[Simulation] Generated ${simMembers.length} members`);
    // WHY: Prisma createMany has a 32k param limit. Batch in chunks of 500.
    const BATCH = 500;
    for (let i = 0; i < simMembers.length; i += BATCH) {
      const batch = simMembers.slice(i, i + BATCH);
      await prisma.simMember.createMany({
        data: batch.map((m) => ({
          signupDate: m.signupDate,
          dayNumber: m.dayNumber,
          zip: m.zip,
          stateCode: m.stateCode,
          cityState: m.cityState,
          fuelType: m.fuelType,
          spotPrice: m.spotPrice,
          futuresPrice: m.futuresPrice,
          strikePrice: m.strikePrice,
          termDays: m.termDays,
          gallonsPerMonth: m.gallonsPerMonth,
          premiumPerGallon: m.premiumPerGallon,
          upfrontPrice: m.upfrontPrice,
          status: m.status,
          endDate: m.endDate,
        })),
      });
    }

    // --- Step 3: Run hedge strategies ---
    // WHY: Hedge engine computes per-day vol from RBOB prices and uses
    // risk-free rate from pricing config. No manual vol/margin overrides.
    console.log("[Simulation] Running hedge strategies...");
    const { positions, snapshots } = runHedgeStrategies(simMembers, futuresPrices, {
      riskFreeRate: simPricingConfig.riskFreeRate,
    });
    console.log(`[Simulation] Done — ${positions.length} positions, ${snapshots.length} snapshots`);

    // Save positions in batches
    for (let i = 0; i < positions.length; i += BATCH) {
      const batch = positions.slice(i, i + BATCH);
      await prisma.hedgePosition.createMany({
        data: batch.map((p) => ({
          model: p.model,
          openDate: p.openDate,
          closeDate: p.closeDate,
          instrument: p.instrument,
          direction: p.direction,
          strikePrice: p.strikePrice,
          expiryDate: p.expiryDate,
          contracts: p.contracts,
          contractSize: p.contractSize,
          premiumPerUnit: p.premiumPerUnit,
          totalPremium: p.totalPremium,
          currentValue: p.currentValue,
          isOpen: p.isOpen,
        })),
      });
    }

    // Save snapshots
    for (let i = 0; i < snapshots.length; i += BATCH) {
      const batch = snapshots.slice(i, i + BATCH);
      await prisma.hedgeBookSnapshot.createMany({
        data: batch.map((s) => ({
          date: s.date,
          model: s.model,
          dayNumber: s.dayNumber,
          totalMembers: s.totalMembers,
          newMembersToday: s.newMembersToday,
          totalGallonsCovered: s.totalGallonsCovered,
          totalPremiumCollected: s.totalPremiumCollected,
          totalHedgeCost: s.totalHedgeCost,
          hedgePositionCount: s.hedgePositionCount,
          totalContractsOpen: s.totalContractsOpen,
          hedgeMtmValue: s.hedgeMtmValue,
          netPnl: s.netPnl,
          realizedPnl: s.realizedPnl,
          rebatesPaid: s.rebatesPaid,
          openLiability: s.openLiability,
          projectedLiability: s.projectedLiability,
          rbobPrice: s.rbobPrice,
          hoPrice: s.hoPrice,
          portfolioDelta: s.portfolioDelta,
          portfolioGamma: s.portfolioGamma,
          portfolioVega: s.portfolioVega,
          portfolioTheta: s.portfolioTheta,
        })),
      });
    }

    // --- Update sim config ---
    // WHY: Store the config that was actually used for this run,
    // so the dashboard can display what parameters drove the results.
    await prisma.simConfig.deleteMany();
    await prisma.simConfig.create({
      data: {
        marginMultiplier: 1 + simPricingConfig.operationalLoad + simPricingConfig.profitMargin,
        microContracts: true,
        volatility: 0, // WHY: 0 signals "computed from market data, not fixed"
        lastRunAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      totalMembers: simMembers.length,
      totalPositions: positions.length,
      totalSnapshots: snapshots.length,
      futuresPriceDays: futuresPrices.length / 2,
      pricingConfig: simPricingConfig,
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[Simulation] FAILED:", e.message, (err as Error)?.stack);
    return NextResponse.json(
      { error: e.message?.substring(0, 500) || "Simulation failed" },
      { status: 500 }
    );
  }
}

/** GET /api/admin/simulation — Get simulation status/config */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.simConfig.findFirst({ where: { isActive: true } });
  const memberCount = await prisma.simMember.count();
  const positionCount = await prisma.hedgePosition.count();
  const snapshotCount = await prisma.hedgeBookSnapshot.count();

  return NextResponse.json({
    config,
    hasData: memberCount > 0,
    memberCount,
    positionCount,
    snapshotCount,
  });
}
