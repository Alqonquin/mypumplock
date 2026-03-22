import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHedgeQueueStatus, markBucketExecuted, setBucketTriggerOverride, getNearThresholdBuckets } from "@/lib/hedge-queue";
import { getMarketStatus } from "@/lib/market-hours";

/**
 * GET /api/admin/hedge-queue — get all strike buckets and their fill status
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queueStatus = await getHedgeQueueStatus();
  const nearThreshold = await getNearThresholdBuckets();
  const marketStatus = getMarketStatus();

  return NextResponse.json({
    ...queueStatus,
    nearThreshold,
    marketStatus,
  });
}

/**
 * PUT /api/admin/hedge-queue — execute a bucket or update its trigger override
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, bucketId } = body;

    if (!bucketId) {
      return NextResponse.json({ error: "bucketId required" }, { status: 400 });
    }

    if (action === "execute") {
      await markBucketExecuted(bucketId);
      return NextResponse.json({ success: true, message: "Bucket marked as executed" });
    }

    if (action === "setTrigger") {
      const { threshold } = body;
      // WHY: null removes the override, falling back to global default
      await setBucketTriggerOverride(
        bucketId,
        threshold === null || threshold === undefined ? null : Math.round(Number(threshold))
      );
      return NextResponse.json({ success: true, message: "Trigger threshold updated" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Hedge queue update failed:", e.message);
    return NextResponse.json(
      { error: e.message || "Failed to update hedge queue" },
      { status: 500 }
    );
  }
}
