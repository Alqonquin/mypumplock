-- CreateTable
CREATE TABLE "FuturesPrice" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "instrument" TEXT NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "settle" DOUBLE PRECISION NOT NULL,
    "volume" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FuturesPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimMember" (
    "id" TEXT NOT NULL,
    "signupDate" DATE NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "zip" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "cityState" TEXT,
    "fuelType" TEXT NOT NULL,
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "futuresPrice" DOUBLE PRECISION NOT NULL,
    "strikePrice" DOUBLE PRECISION NOT NULL,
    "termDays" INTEGER NOT NULL,
    "gallonsPerMonth" DOUBLE PRECISION NOT NULL,
    "premiumPerGallon" DOUBLE PRECISION NOT NULL,
    "upfrontPrice" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "endDate" DATE NOT NULL,

    CONSTRAINT "SimMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HedgePosition" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "openDate" DATE NOT NULL,
    "closeDate" DATE,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'LONG',
    "strikePrice" DOUBLE PRECISION NOT NULL,
    "expiryDate" DATE NOT NULL,
    "contracts" DOUBLE PRECISION NOT NULL,
    "contractSize" INTEGER NOT NULL,
    "premiumPerUnit" DOUBLE PRECISION NOT NULL,
    "totalPremium" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HedgePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HedgeBookSnapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "model" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "totalMembers" INTEGER NOT NULL,
    "newMembersToday" INTEGER NOT NULL DEFAULT 0,
    "totalGallonsCovered" DOUBLE PRECISION NOT NULL,
    "totalPremiumCollected" DOUBLE PRECISION NOT NULL,
    "totalHedgeCost" DOUBLE PRECISION NOT NULL,
    "hedgePositionCount" INTEGER NOT NULL,
    "totalContractsOpen" DOUBLE PRECISION NOT NULL,
    "hedgeMtmValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPnl" DOUBLE PRECISION NOT NULL,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openLiability" DOUBLE PRECISION NOT NULL,
    "rbobPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portfolioDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portfolioGamma" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portfolioVega" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portfolioTheta" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "HedgeBookSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimConfig" (
    "id" TEXT NOT NULL,
    "marginMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    "microContracts" BOOLEAN NOT NULL DEFAULT true,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuturesPrice_date_instrument_key" ON "FuturesPrice"("date", "instrument");
CREATE INDEX "FuturesPrice_instrument_idx" ON "FuturesPrice"("instrument");

CREATE INDEX "SimMember_signupDate_idx" ON "SimMember"("signupDate");
CREATE INDEX "SimMember_status_idx" ON "SimMember"("status");

CREATE INDEX "HedgePosition_model_idx" ON "HedgePosition"("model");
CREATE INDEX "HedgePosition_openDate_idx" ON "HedgePosition"("openDate");
CREATE INDEX "HedgePosition_isOpen_idx" ON "HedgePosition"("isOpen");

CREATE UNIQUE INDEX "HedgeBookSnapshot_date_model_key" ON "HedgeBookSnapshot"("date", "model");
CREATE INDEX "HedgeBookSnapshot_model_idx" ON "HedgeBookSnapshot"("model");
