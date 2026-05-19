-- Tier-based historical retention for paid ads metrics.
--
-- Foundation -> 1 month of daily granularity, no monthly aggregates
-- Growth     -> 12 months of daily granularity, monthly aggregates beyond
-- Scale      -> 24 months of daily granularity, monthly aggregates beyond
-- CUSTOM     -> defaults to Scale, override via Organization.adDataRetentionMonths
--
-- Touched by:
--   * lib/billing/retention.ts          (policy resolver)
--   * lib/billing/ad-retention-job.ts   (per-org rollup + delete)
--   * app/api/cron/ad-retention/route.ts (daily cron, 03:30 UTC)
--   * lib/dashboard/queries.ts          (read-path union daily + monthly)
--   * app/portal/ads/page.tsx           (operator UI panel + export)

-- 1. Optional override on Organization. NULL = use tier default.
ALTER TABLE "Organization"
  ADD COLUMN "adDataRetentionMonths" INTEGER;

-- 2. Monthly aggregate table. One row per (orgId, adAccountId, year, month).
CREATE TABLE "AdMetricMonthly" (
    "id"                   TEXT             NOT NULL,
    "orgId"                TEXT             NOT NULL,
    "adAccountId"          TEXT             NOT NULL,
    "year"                 INTEGER          NOT NULL,
    "month"                INTEGER          NOT NULL,
    "impressions"          INTEGER          NOT NULL DEFAULT 0,
    "clicks"               INTEGER          NOT NULL DEFAULT 0,
    "spendCents"           INTEGER          NOT NULL DEFAULT 0,
    "conversions"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionValueCents" INTEGER          NOT NULL DEFAULT 0,
    "daysAggregated"       INTEGER          NOT NULL DEFAULT 0,
    "aggregatedAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "AdMetricMonthly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdMetricMonthly_orgId_adAccountId_year_month_key"
  ON "AdMetricMonthly"("orgId", "adAccountId", "year", "month");

CREATE INDEX "AdMetricMonthly_orgId_year_month_idx"
  ON "AdMetricMonthly"("orgId", "year", "month");

CREATE INDEX "AdMetricMonthly_adAccountId_year_month_idx"
  ON "AdMetricMonthly"("adAccountId", "year", "month");
