-- ---------------------------------------------------------------------------
-- Adds the SeoScanJob queue + per-engine mention/position columns on
-- AeoCitationCheck. Backfills `mentioned` from existing status values so
-- Searchable-style "Mentioned? Yes/No" surfaces don't go dark for rows
-- written before the column existed.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "SeoScanJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "AeoCitationCheck"
  ADD COLUMN "mentioned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "position" INTEGER;

-- Backfill: any row already marked CITED or COMPETITOR_CITED implies the
-- property/brand was at least mentioned. Idempotent — safe to re-run.
UPDATE "AeoCitationCheck"
  SET "mentioned" = TRUE
  WHERE "status" IN ('CITED', 'COMPETITOR_CITED')
    AND "mentioned" = FALSE;

-- CreateTable
CREATE TABLE "SeoScanJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "status" "SeoScanJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progressStage" TEXT,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoScanJob_orgId_status_idx" ON "SeoScanJob"("orgId", "status");

-- CreateIndex
CREATE INDEX "SeoScanJob_propertyId_createdAt_idx" ON "SeoScanJob"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoScanJob_status_createdAt_idx" ON "SeoScanJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AeoCitationCheck_orgId_mentioned_queryRunAt_idx" ON "AeoCitationCheck"("orgId", "mentioned", "queryRunAt");

-- AddForeignKey
ALTER TABLE "SeoScanJob" ADD CONSTRAINT "SeoScanJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoScanJob" ADD CONSTRAINT "SeoScanJob_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
