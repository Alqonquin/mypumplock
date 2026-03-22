-- Drop the Vehicle table (model was removed from schema)
DROP TABLE IF EXISTS "Vehicle";

-- Rename termMonths to termDays on Plan table
ALTER TABLE "Plan" RENAME COLUMN "termMonths" TO "termDays";

-- Create DailyPrice table
CREATE TABLE "DailyPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "dailyGallons" DOUBLE PRECISION NOT NULL,
    "avgPrice" DOUBLE PRECISION NOT NULL,
    "memberMaxPrice" DOUBLE PRECISION NOT NULL,
    "dailyRebate" DOUBLE PRECISION NOT NULL,
    "totalRebate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPrice_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one record per plan per day
CREATE UNIQUE INDEX "DailyPrice_planId_day_key" ON "DailyPrice"("planId", "day");

-- Indexes for querying
CREATE INDEX "DailyPrice_planId_idx" ON "DailyPrice"("planId");
CREATE INDEX "DailyPrice_date_idx" ON "DailyPrice"("date");

-- Foreign key
ALTER TABLE "DailyPrice" ADD CONSTRAINT "DailyPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
