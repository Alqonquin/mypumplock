import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/waitlist — list all waitlist entries for the admin dashboard.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Summary stats
  const total = entries.length;
  const uniqueEmails = new Set(entries.map((e) => e.email)).size;
  const uniqueZips = new Set(entries.filter((e) => e.zip).map((e) => e.zip)).size;
  const avgUpfront = entries.filter((e) => e.upfrontPrice).length > 0
    ? entries.filter((e) => e.upfrontPrice).reduce((sum, e) => sum + (e.upfrontPrice ?? 0), 0)
      / entries.filter((e) => e.upfrontPrice).length
    : 0;

  // Signups by day (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentEntries = entries.filter((e) => new Date(e.createdAt) >= thirtyDaysAgo);
  const byDay: Record<string, number> = {};
  for (const e of recentEntries) {
    const day = new Date(e.createdAt).toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }

  return NextResponse.json({
    entries,
    summary: {
      total,
      uniqueEmails,
      uniqueZips,
      avgUpfront: Math.round(avgUpfront * 100) / 100,
      last7Days: recentEntries.filter(
        (e) => new Date(e.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length,
      last24Hours: recentEntries.filter(
        (e) => new Date(e.createdAt) >= new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
    },
    byDay,
  });
}
