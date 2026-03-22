-- CreateEnum
CREATE TYPE "HedgeStatus" AS ENUM ('HEDGED', 'PENDING_HEDGE');

-- AlterTable: Add hedgeStatus to Plan
ALTER TABLE "Plan" ADD COLUMN "hedgeStatus" "HedgeStatus" NOT NULL DEFAULT 'HEDGED';

-- CreateTable: AdminSettings
CREATE TABLE "AdminSettings" (
    "id" TEXT NOT NULL,
    "afterHoursBufferRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "signupsPaused" BOOLEAN NOT NULL DEFAULT false,
    "maxActivePlansPerUser" INTEGER NOT NULL DEFAULT 2,
    "maxPurchasesPerDay" INTEGER NOT NULL DEFAULT 1,
    "afterHoursVolumeCap" INTEGER NOT NULL DEFAULT 20,
    "hedgeTriggerGallons" INTEGER NOT NULL DEFAULT 4200,
    "nearThresholdAlertPct" DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StateSpread
CREATE TABLE "StateSpread" (
    "id" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "regularSpread" DOUBLE PRECISION NOT NULL,
    "premiumSpread" DOUBLE PRECISION NOT NULL,
    "dieselSpread" DOUBLE PRECISION NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'API Motor Fuel Tax Report',

    CONSTRAINT "StateSpread_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StrikeBucket
CREATE TABLE "StrikeBucket" (
    "id" TEXT NOT NULL,
    "strikePrice" DOUBLE PRECISION NOT NULL,
    "instrument" TEXT NOT NULL DEFAULT 'RBOB',
    "expiryMonth" TEXT NOT NULL,
    "accumulatedGallons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "triggerOverride" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'FILLING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrikeBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StateSpread_stateCode_key" ON "StateSpread"("stateCode");
CREATE INDEX "StateSpread_stateCode_idx" ON "StateSpread"("stateCode");

CREATE UNIQUE INDEX "StrikeBucket_strikePrice_instrument_expiryMonth_key" ON "StrikeBucket"("strikePrice", "instrument", "expiryMonth");
CREATE INDEX "StrikeBucket_status_idx" ON "StrikeBucket"("status");
CREATE INDEX "StrikeBucket_instrument_expiryMonth_idx" ON "StrikeBucket"("instrument", "expiryMonth");

-- Seed: Create default AdminSettings row
INSERT INTO "AdminSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
