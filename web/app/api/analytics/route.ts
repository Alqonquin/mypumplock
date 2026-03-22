import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// WHY: Allowed step values are whitelisted to prevent junk data from
// polluting the funnel analytics. Each value maps to a specific point
// in the quote calculator flow.
const VALID_STEPS = [
  "zip_entered",
  "vehicle_selected",
  "vehicle_skipped",
  "usage_set",
  "quote_viewed",
  "waitlist_opened",
  "waitlist_submitted",
] as const;

/**
 * POST /api/analytics — log a funnel step event.
 *
 * WHY: No auth required. These are anonymous visitors on the public
 * quote calculator. We need to track where they drop off.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, step, zip } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400 }
      );
    }

    if (!VALID_STEPS.includes(step)) {
      return NextResponse.json(
        { error: `Invalid step. Must be one of: ${VALID_STEPS.join(", ")}` },
        { status: 400 }
      );
    }

    await prisma.funnelEvent.create({
      data: {
        sessionId,
        step,
        zip: zip || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Analytics event failed:", e.message?.slice(0, 300));
    // WHY: Never block the user experience for analytics failures.
    // Return 200 even on error so the client doesn't retry or show errors.
    return NextResponse.json({ ok: true });
  }
}
