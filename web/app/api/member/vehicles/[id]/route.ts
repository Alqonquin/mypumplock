import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** DELETE /api/member/vehicles/[id] — remove a saved vehicle */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // WHY: Verify ownership before deleting — users should only
  // be able to delete their own vehicles.
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  await prisma.vehicle.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
