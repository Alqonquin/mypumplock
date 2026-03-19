import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

// WHY: Strip ?schema=public — it's a Prisma CLI param, not a pg param.
const url = (process.env.DATABASE_URL ?? "").replace(/\?schema=\w+/, "");
const adapter = new PrismaPg({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create admin user
  const adminEmail = "admin@pumplock.com";
  const adminPassword = "admin123!";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hash,
        name: "PumpLock Admin",
        role: "ADMIN",
      },
    });
    console.log(`Created admin user: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // Create default pricing config
  const activeConfig = await prisma.pricingConfig.findFirst({ where: { isActive: true } });
  if (!activeConfig) {
    await prisma.pricingConfig.create({
      data: {
        label: "Launch defaults",
        isActive: true,
        volatility: 0.40,
        riskFreeRate: 0.045,
        operationalLoad: 0.05,
        profitMargin: 0.03,
        adverseSelectionLoad: 0.10,
        seasonalAdjustments: {
          "1": 0.0, "2": -0.01, "3": -0.02, "4": -0.04,
          "5": -0.05, "6": -0.05, "7": -0.04, "8": -0.03,
          "9": -0.01, "10": 0.0, "11": 0.01, "12": 0.01,
        },
        createdBy: adminEmail,
      },
    });
    console.log("Created default pricing config");
  } else {
    console.log("Active pricing config already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
