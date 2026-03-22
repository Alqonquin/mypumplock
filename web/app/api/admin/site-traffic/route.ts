import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// WHY: Ordered to match the user journey through the quote calculator.
// This ordering drives the funnel visualization in the admin dashboard.
const STEP_ORDER = [
  "zip_entered",
  "vehicle_selected",
  "vehicle_skipped",
  "usage_set",
  "quote_viewed",
  "waitlist_opened",
  "waitlist_submitted",
] as const;

/**
 * GET /api/admin/site-traffic — aggregate funnel event data for the admin dashboard.
 *
 * Query params:
 *   days — number of days to look back (default 7, 0 = all time)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(request.nextUrl.searchParams.get("days") ?? "7");

  // WHY: days=0 means "all time" — no date filter applied.
  const dateFilter =
    days > 0
      ? { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
      : {};

  // Count distinct sessions that reached each step
  const stepCounts = await Promise.all(
    STEP_ORDER.map(async (step) => {
      // WHY: We use raw groupBy to get distinct session counts rather than
      // total event counts, so refreshing a page doesn't inflate numbers.
      const results = await prisma.funnelEvent.findMany({
        where: { step, ...dateFilter },
        select: { sessionId: true },
        distinct: ["sessionId"],
      });
      return { step, sessions: results.length };
    })
  );

  // WHY: Merge vehicle_selected + vehicle_skipped into one funnel row
  // for the "Vehicle step" since both represent completing step 2.
  const vehicleSelected =
    stepCounts.find((s) => s.step === "vehicle_selected")?.sessions ?? 0;
  const vehicleSkipped =
    stepCounts.find((s) => s.step === "vehicle_skipped")?.sessions ?? 0;

  const funnel = [
    { step: "zip_entered", label: "Entered Zip Code", sessions: stepCounts.find((s) => s.step === "zip_entered")?.sessions ?? 0 },
    { step: "vehicle_step", label: "Completed Vehicle Step", sessions: vehicleSelected + vehicleSkipped, detail: { selected: vehicleSelected, skipped: vehicleSkipped } },
    { step: "usage_set", label: "Set Monthly Usage", sessions: stepCounts.find((s) => s.step === "usage_set")?.sessions ?? 0 },
    { step: "quote_viewed", label: "Viewed Quote", sessions: stepCounts.find((s) => s.step === "quote_viewed")?.sessions ?? 0 },
    { step: "waitlist_opened", label: "Opened Waitlist", sessions: stepCounts.find((s) => s.step === "waitlist_opened")?.sessions ?? 0 },
    { step: "waitlist_submitted", label: "Joined Waitlist", sessions: stepCounts.find((s) => s.step === "waitlist_submitted")?.sessions ?? 0 },
  ];

  // Daily trend — total unique sessions per day (any step)
  const dailyRaw = await prisma.funnelEvent.findMany({
    where: dateFilter,
    select: { sessionId: true, createdAt: true },
    distinct: ["sessionId"],
    orderBy: { createdAt: "asc" },
  });

  // WHY: Group by calendar date string to get sessions-per-day for a trend line.
  const dailyMap = new Map<string, Set<string>>();
  for (const row of dailyRaw) {
    const dateKey = row.createdAt.toISOString().slice(0, 10);
    if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, new Set());
    dailyMap.get(dateKey)!.add(row.sessionId);
  }
  const daily = Array.from(dailyMap.entries()).map(([date, set]) => ({
    date,
    sessions: set.size,
  }));

  return NextResponse.json({ funnel, daily });
}
