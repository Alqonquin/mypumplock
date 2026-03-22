import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/waitlist — add someone to the pre-launch waitlist.
 *
 * WHY: No auth required. This is a public-facing interest capture.
 * We store the quote snapshot alongside name/email so we can segment
 * demand by price point, geography, and vehicle type.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, email } = body;

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    // WHY: Basic email format validation. Not exhaustive — we're capturing
    // interest, not verifying deliverability.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        zip: body.zip || null,
        cityState: body.cityState || null,
        stateCode: body.stateCode || null,
        spotPrice: body.spotPrice ? Number(body.spotPrice) : null,
        strikePrice: body.strikePrice ? Number(body.strikePrice) : null,
        upfrontPrice: body.upfrontPrice ? Number(body.upfrontPrice) : null,
        monthlyGallons: body.monthlyGallons ? Number(body.monthlyGallons) : null,
        termDays: body.termDays ? Math.round(Number(body.termDays)) : null,
        fuelType: body.fuelType || null,
        vehicleMake: body.vehicleMake || null,
        vehicleModel: body.vehicleModel || null,
      },
    });

    return NextResponse.json(
      { success: true, id: entry.id },
      { status: 201 }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Waitlist signup failed:", e.message);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
