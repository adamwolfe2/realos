-- ============================================================================
-- API usage / cost tracking — 2026-05-29
--
-- One row per billable upstream API call. Backs /admin/costs and the
-- monthly-cap guard on the daily-signals cron.
--
-- Cost stored as Int microcents (100 = 1 cent) so we never deal with
-- floating-point sum drift across millions of rows.
--
-- Provider is a free string instead of an enum so adding a new provider
-- doesn't require another migration.
-- ============================================================================

-- CreateEnum
CREATE TYPE "ApiUsageStatus" AS ENUM (
    'SUCCESS',
    'ERROR',
    'SKIPPED_CAP'
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" "ApiUsageStatus" NOT NULL,
    "costMicroCents" INTEGER NOT NULL DEFAULT 0,
    "orgId" TEXT,
    "propertyId" TEXT,
    "prospectAuditId" TEXT,
    "meta" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiUsage_provider_createdAt_idx"
    ON "ApiUsage"("provider", "createdAt");

CREATE INDEX "ApiUsage_orgId_createdAt_idx"
    ON "ApiUsage"("orgId", "createdAt" DESC);

CREATE INDEX "ApiUsage_propertyId_createdAt_idx"
    ON "ApiUsage"("propertyId", "createdAt" DESC);

CREATE INDEX "ApiUsage_prospectAuditId_idx"
    ON "ApiUsage"("prospectAuditId");

CREATE INDEX "ApiUsage_createdAt_idx"
    ON "ApiUsage"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ApiUsage"
    ADD CONSTRAINT "ApiUsage_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
