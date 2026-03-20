import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// WHY: Cap saved vehicles per user to prevent abuse.
// 10 covers most households with multiple drivers.
const MAX_VEHICLES_PER_USER = 10;

/** GET /api/member/vehicles — list the logged-in user's saved vehicles */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(vehicles);
}

/** POST /api/member/vehicles — save a new vehicle */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { year: number; make: string; model: string; mpg: number; fuelType: string; nickname?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { year, make, model, mpg, fuelType, nickname } = body;

  if (!year || !make || !model || !mpg || !fuelType) {
    return NextResponse.json(
      { error: "Missing required vehicle fields" },
      { status: 400 }
    );
  }

  try {
    // Check vehicle count limit
    const count = await prisma.vehicle.count({
      where: { userId: session.user.id },
    });
    if (count >= MAX_VEHICLES_PER_USER) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_VEHICLES_PER_USER} saved vehicles reached` },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        userId: session.user.id,
        year,
        make,
        model,
        mpg,
        fuelType,
        nickname: nickname || null,
      },
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    // WHY: Unique constraint violation means the user already saved
    // this exact year/make/model. Return the existing one instead of failing.
    if ((err as Record<string, unknown>)?.code === "P2002") {
      const existing = await prisma.vehicle.findFirst({
        where: { userId: session.user.id, year, make, model },
      });
      if (existing) return NextResponse.json(existing);
    }
    console.error("Save vehicle error:", err);
    return NextResponse.json(
      { error: "Failed to save vehicle" },
      { status: 500 }
    );
  }
}
