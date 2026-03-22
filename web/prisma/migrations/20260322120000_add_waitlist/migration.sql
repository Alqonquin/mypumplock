-- CreateTable: WaitlistEntry
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "zip" TEXT,
    "cityState" TEXT,
    "stateCode" TEXT,
    "spotPrice" DOUBLE PRECISION,
    "strikePrice" DOUBLE PRECISION,
    "upfrontPrice" DOUBLE PRECISION,
    "monthlyGallons" DOUBLE PRECISION,
    "termDays" INTEGER,
    "fuelType" TEXT,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_email_idx" ON "WaitlistEntry"("email");
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");
