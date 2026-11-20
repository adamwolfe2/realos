-- Multi-property groundwork, part 1 of 2: additive only.
--
-- Every change is a NULLABLE column, a nullable FK to Property, a plain
-- index, or (User.propertyAccessRestricted only) a NOT NULL boolean with a
-- constant DEFAULT false. No row is rewritten, no default is backfilled, no constraint the
-- running app depends on changes, so the currently deployed code keeps
-- working unchanged against this schema.
--
-- Pattern follows 20260801_add_seo_metrics_property_dimension:
--   * ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS (idempotent).
--   * FKs added NOT VALID inside a duplicate_object guard, then VALIDATEd
--     separately: NOT VALID skips the full-table scan under the stronger
--     lock; VALIDATE scans under SHARE UPDATE EXCLUSIVE, which does not
--     block writes. Every new column is NULL on every existing row,
--     so validation is trivially satisfied.
--   * ADD COLUMN of a nullable column without a default is a catalog-only
--     change in Postgres 11+ (no table rewrite).
--   * Plain CREATE INDEX (not CONCURRENTLY): migrate deploy runs the file as
--     one transaction, where CONCURRENTLY is rejected (same note as
--     20260506_perf_indexes). Each index is on a column that is NULL in
--     every existing row, so builds are a single sequential scan per table.
--
-- Already present, deliberately not touched here:
--   * AeoOpportunityScore."propertyId" (+ FK, ON DELETE SET NULL) exists
--     since the AEO v2 migration. Its uniqueness change is in part 2.
--   * AdLibraryAdvertiser."propertyId" exists. Its uniqueness change is in
--     part 2.

-- ============================================================
-- 1) Plain nullable timestamps / ints (no FK)
-- ============================================================

-- Organization: last AEO scan ATTEMPT (aeo-scan cron rotation key).
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lastAeoScanAttemptedAt" TIMESTAMP(3);

-- Property: last SEO/DataForSEO scan ATTEMPT (rotation key even on failure).
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "lastSeoScanAttemptedAt" TIMESTAMP(3);

-- Property: per-property Funnel group id (same type as FunnelIntegration.groupId).
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "funnelGroupId" INTEGER;

-- AdCampaign: set when the operator picks the property by hand.
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "propertyManuallySetAt" TIMESTAMP(3);

-- User: explicit "restricted to my grants" flag so zero grants can mean
-- "no properties" instead of "org-wide". NOT NULL DEFAULT false with a
-- constant default is catalog-only in Postgres 11+ (no rewrite) and keeps
-- every existing user on today's behaviour. No backfill.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "propertyAccessRestricted" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2) propertyId columns + index + FK (ON DELETE SET NULL unless noted)
-- ============================================================

-- DomainBinding
ALTER TABLE "DomainBinding" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "DomainBinding_propertyId_idx" ON "DomainBinding"("propertyId");
DO $$ BEGIN
  ALTER TABLE "DomainBinding" ADD CONSTRAINT "DomainBinding_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "DomainBinding" VALIDATE CONSTRAINT "DomainBinding_propertyId_fkey";

-- AdAccount
ALTER TABLE "AdAccount" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "AdAccount_propertyId_idx" ON "AdAccount"("propertyId");
DO $$ BEGIN
  ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "AdAccount" VALIDATE CONSTRAINT "AdAccount_propertyId_fkey";

-- PopupEvent
ALTER TABLE "PopupEvent" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "PopupEvent_propertyId_idx" ON "PopupEvent"("propertyId");
DO $$ BEGIN
  ALTER TABLE "PopupEvent" ADD CONSTRAINT "PopupEvent_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "PopupEvent" VALIDATE CONSTRAINT "PopupEvent_propertyId_fkey";

-- Notification
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_propertyId_idx" ON "Notification"("propertyId");
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "Notification" VALIDATE CONSTRAINT "Notification_propertyId_fkey";

-- AeoOverviewSnapshot
ALTER TABLE "AeoOverviewSnapshot" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "AeoOverviewSnapshot_propertyId_idx" ON "AeoOverviewSnapshot"("propertyId");
DO $$ BEGIN
  ALTER TABLE "AeoOverviewSnapshot" ADD CONSTRAINT "AeoOverviewSnapshot_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "AeoOverviewSnapshot" VALIDATE CONSTRAINT "AeoOverviewSnapshot_propertyId_fkey";

-- SiteIntelligence: ON DELETE CASCADE (not SET NULL). Once part 2 lets
-- per-property rows coexist with the org-level row, nulling a property row
-- on delete would collide with the org-level partial unique (same reasoning
-- as SeoSnapshot in 20260801). The row is a regenerable crawl cache. While
-- orgId is still UNIQUE (until part 2) no code writes propertyId, so this
-- has no effect yet.
ALTER TABLE "SiteIntelligence" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "SiteIntelligence_propertyId_idx" ON "SiteIntelligence"("propertyId");
DO $$ BEGIN
  ALTER TABLE "SiteIntelligence" ADD CONSTRAINT "SiteIntelligence_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "SiteIntelligence" VALIDATE CONSTRAINT "SiteIntelligence_propertyId_fkey";
