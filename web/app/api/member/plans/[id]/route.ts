import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/member/plans/[id] — single plan with daily rebate breakdown */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      // WHY: Fetch actual daily price records populated by the cron job.
      dailyPrices: {
        orderBy: { day: "asc" },
      },
    },
  });

  if (!plan || plan.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const startDate = new Date(plan.startDate);
  const endDate = new Date(plan.endDate);
  const now = new Date();
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
  );

  const dailyGallons = Math.round((plan.gallonsPerMonth / 30) * 100) / 100;

  // WHY: Map DailyPrice records to the response format.
  // The cron job populates these daily — only recorded days appear.
  const days = plan.dailyPrices.map((dp) => ({
    day: dp.day,
    date: new Date(dp.date).toISOString().slice(0, 10),
    dailyGallons: dp.dailyGallons,
    dailyAvgPrice: dp.avgPrice,
    maxMemberPrice: dp.memberMaxPrice,
    dailyRebate: dp.dailyRebate,
    totalRebate: dp.totalRebate,
  }));

  // Strip the included dailyPrices from the plan object to keep the response clean
  const { dailyPrices: _, ...planData } = plan;

  return NextResponse.json({
    plan: planData,
    totalDays,
    elapsedDays,
    dailyGallons,
    days,
  });
}
