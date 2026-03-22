-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "zip" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "strikePrice" DOUBLE PRECISION NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "gallonsPerMonth" DOUBLE PRECISION NOT NULL,
    "premiumPerGallon" DOUBLE PRECISION NOT NULL,
    "upfrontPrice" DOUBLE PRECISION NOT NULL,
    "monthlyEquivalent" DOUBLE PRECISION NOT NULL,
    "vehicleYear" INTEGER,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "vehicleMpg" DOUBLE PRECISION,
    "monthlyMiles" INTEGER,
    "fuelType" TEXT,
    "zip" TEXT NOT NULL,
    "cityState" TEXT,
    "stateCode" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "pricingConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "riskFreeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.045,
    "operationalLoad" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "profitMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "adverseSelectionLoad" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "seasonalAdjustments" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Plan_userId_idx" ON "Plan"("userId");

-- CreateIndex
CREATE INDEX "Plan_status_idx" ON "Plan"("status");

-- CreateIndex
CREATE INDEX "Plan_endDate_idx" ON "Plan"("endDate");

-- CreateIndex
CREATE INDEX "PricingConfig_isActive_idx" ON "PricingConfig"("isActive");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_pricingConfigId_fkey" FOREIGN KEY ("pricingConfigId") REFERENCES "PricingConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
