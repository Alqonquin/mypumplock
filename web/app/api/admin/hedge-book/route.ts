import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/admin/hedge-book — Dashboard data for the hedge book */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const model = request.nextUrl.searchParams.get("model") || "MATCHING_CALLS";

  // Latest snapshot for the requested model
  const latestSnapshot = await prisma.hedgeBookSnapshot.findFirst({
    where: { model },
    orderBy: { dayNumber: "desc" },
  });

  // All snapshots for the chart (both models for comparison)
  const snapshots = await prisma.hedgeBookSnapshot.findMany({
    orderBy: { dayNumber: "asc" },
  });

  // Futures prices for the chart
  const futuresPrices = await prisma.futuresPrice.findMany({
    orderBy: { date: "asc" },
  });

  // Open positions for the selected model
  const openPositions = await prisma.hedgePosition.findMany({
    where: { model, isOpen: true },
    orderBy: { openDate: "desc" },
  });

  // All positions for position history
  const allPositions = await prisma.hedgePosition.findMany({
    where: { model },
    orderBy: { openDate: "desc" },
  });

  // Member breakdown
  const memberStats = await prisma.simMember.groupBy({
    by: ["fuelType"],
    _count: true,
    _sum: { upfrontPrice: true, gallonsPerMonth: true },
  });

  const totalMembers = await prisma.simMember.count();
  const activeMembers = await prisma.simMember.count({ where: { status: "ACTIVE" } });

  // Config
  const config = await prisma.simConfig.findFirst({ where: { isActive: true } });

  // Member signup by day
  const membersByDay = await prisma.simMember.groupBy({
    by: ["dayNumber"],
    _count: true,
    _sum: { upfrontPrice: true },
    orderBy: { dayNumber: "asc" },
  });

  return NextResponse.json({
    latestSnapshot,
    snapshots,
    futuresPrices,
    openPositions,
    allPositions,
    memberStats,
    totalMembers,
    activeMembers,
    membersByDay,
    config,
  });
}
