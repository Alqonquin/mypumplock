import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PlanStatus } from "@/lib/generated/prisma/client";

/** GET /api/admin/members — list all members with their plans */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  // WHY: 50 per page balances load time against admin usability.
  const perPage = 50;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { role: "MEMBER" };
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { zip: { contains: search } },
    ];
  }

  const planWhere = statusFilter
    ? { status: statusFilter as PlanStatus }
    : undefined;

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        plans: {
          where: planWhere,
          orderBy: { createdAt: "desc" as const },
        },
      },
      orderBy: { createdAt: "desc" as const },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      zip: m.zip,
      createdAt: m.createdAt,
      plans: m.plans,
      activePlans: m.plans.filter((p) => p.status === "ACTIVE").length,
    })),
    total,
    page,
    pages: Math.ceil(total / perPage),
  });
}
