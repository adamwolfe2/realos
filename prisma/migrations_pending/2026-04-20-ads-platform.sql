-- ============================================================================
-- Migration: Google Ads + Meta Ads platform
-- Generated 2026-04-20
--
-- Additive only:
--   - Adds new columns to AdAccount (displayName, currency, credentialsEncrypted,
--     lastSyncError, autoSyncEnabled)
--   - Adds new columns to AdCampaign (objective, dailyBudgetCents, startDate,
--     endDate)
--   - Adds unique constraint on AdCampaign (adAccountId, externalCampaignId)
--   - Creates AdMetricDaily table
--
-- All operations are guarded with IF NOT EXISTS so re-running is safe.
-- ============================================================================

-- 1. AdAccount additions ----------------------------------------------------
ALTER TABLE "AdAccount"
  ADD COLUMN IF NOT EXISTS "displayName"          TEXT,
  ADD COLUMN IF NOT EXISTS "currency"             TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "credentialsEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "lastSyncError"        TEXT,
  ADD COLUMN IF NOT EXISTS "autoSyncEnabled"      BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. AdCampaign additions ---------------------------------------------------
ALTER TABLE "AdCampaign"
  ADD COLUMN IF NOT EXISTS "objective"        TEXT,
  ADD COLUMN IF NOT EXISTS "dailyBudgetCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "startDate"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate"          TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "AdCampaign_adAccountId_externalCampaignId_key"
  ON "AdCampaign"("adAccountId", "externalCampaignId");

-- 3. AdMetricDaily ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AdMetricDaily" (
  "id"                     TEXT PRIMARY KEY,
  "orgId"                  TEXT NOT NULL,
  "adAccountId"            TEXT NOT NULL,
  "campaignId"             TEXT NOT NULL,
  "date"                   DATE NOT NULL,
  "impressions"            INTEGER NOT NULL DEFAULT 0,
  "clicks"                 INTEGER NOT NULL DEFAULT 0,
  "spendCents"             INTEGER NOT NULL DEFAULT 0,
  "conversions"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "conversionValueCents"   INTEGER NOT NULL DEFAULT 0,
  "ctr"                    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cpcCents"               INTEGER NOT NULL DEFAULT 0,
  "costPerConversionCents" INTEGER NOT NULL DEFAULT 0,
  "raw"                    JSONB,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdMetricDaily_adAccountId_fkey"
    FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdMetricDaily_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdMetricDaily_campaignId_date_key"
  ON "AdMetricDaily"("campaignId", "date");
CREATE INDEX IF NOT EXISTS "AdMetricDaily_orgId_date_idx"
  ON "AdMetricDaily"("orgId", "date");
CREATE INDEX IF NOT EXISTS "AdMetricDaily_adAccountId_date_idx"
  ON "AdMetricDaily"("adAccountId", "date");
