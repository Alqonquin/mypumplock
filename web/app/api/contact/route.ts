import { NextRequest, NextResponse } from "next/server";

/** POST /api/contact — receive contact form submissions.
 * WHY: For now, just logs to console. Wire up to email (SendGrid, Resend)
 * or a CRM (HubSpot, etc.) when ready. */
export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    // TODO: Forward to email service (Resend, SendGrid) or CRM
    console.log("[Contact Form]", { name, email, subject, message, at: new Date().toISOString() });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
