import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// WHY: In development, Next.js hot-reloads clear the module cache,
// which would create a new PrismaClient on every reload and exhaust
// database connections. Global singleton prevents this.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // WHY: Strip ?schema=public — it's a Prisma CLI param, not a pg param.
  // Passing it through to pg can cause connection issues.
  const url = (process.env.DATABASE_URL ?? "").replace(/\?schema=\w+/, "");
  const adapter = new PrismaPg({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
