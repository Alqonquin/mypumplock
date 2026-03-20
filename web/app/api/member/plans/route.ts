import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/member/plans — list the logged-in user's plans */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plans = await prisma.plan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(plans);
}

/** POST /api/member/plans — create a new plan (purchase) */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const {
      spotPrice,
      strikePrice,
      termDays,
      gallonsPerMonth,
      premiumPerGallon,
      upfrontPrice,
      monthlyEquivalent,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleMpg,
      monthlyMiles,
      fuelType,
      zip,
      cityState,
      stateCode,
    } = body;

    console.log("Plan creation body:", JSON.stringify({
      spotPrice, strikePrice, termDays, gallonsPerMonth,
      premiumPerGallon, upfrontPrice, monthlyEquivalent, zip,
      vehicleYear, fuelType,
    }));

    // Validate required fields
    if (!spotPrice || !strikePrice || !termDays || !gallonsPerMonth || !upfrontPrice || !zip) {
      return NextResponse.json(
        { error: "Missing required plan fields" },
        { status: 400 }
      );
    }

    // Get active pricing config
    const activePricing = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
    });

    const endDate = new Date();
    // WHY: Use exact day count instead of month arithmetic to avoid
    // variable-length month ambiguity.
    endDate.setDate(endDate.getDate() + termDays);

    // WHY: Coerce types to match Prisma schema — JSON body values may
    // arrive as unexpected types (e.g., float where Int is expected).
    const plan = await prisma.plan.create({
      data: {
        userId: session.user.id,
        spotPrice: Number(spotPrice),
        strikePrice: Number(strikePrice),
        termDays: Math.round(Number(termDays)),
        gallonsPerMonth: Number(gallonsPerMonth),
        premiumPerGallon: Number(premiumPerGallon || 0),
        upfrontPrice: Number(upfrontPrice),
        monthlyEquivalent: Number(monthlyEquivalent || 0),
        vehicleYear: vehicleYear ? Math.round(Number(vehicleYear)) : null,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehicleMpg: vehicleMpg ? Number(vehicleMpg) : null,
        monthlyMiles: monthlyMiles ? Math.round(Number(monthlyMiles)) : null,
        fuelType: fuelType || null,
        zip,
        cityState: cityState || null,
        stateCode: stateCode || null,
        endDate,
        pricingConfigId: activePricing?.id || null,
      },
    });

    // Update user's zip if not already set
    await prisma.user.update({
      where: { id: session.user.id },
      data: { zip: zip },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string; meta?: unknown; message?: string };
    console.error("Plan creation failed:", {
      code: prismaErr.code,
      meta: prismaErr.meta,
      message: prismaErr.message?.substring(0, 500),
    });
    return NextResponse.json(
      {
        error: prismaErr.message?.substring(0, 300) || "Failed to create plan",
        code: prismaErr.code,
      },
      { status: 500 }
    );
  }
}
