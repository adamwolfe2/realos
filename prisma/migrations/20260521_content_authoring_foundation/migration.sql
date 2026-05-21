-- ---------------------------------------------------------------------------
-- Content authoring foundation:
--   * PublishMode enum + Organization.publishMode column (default
--     EXTERNAL_VIA_ADMIN — most clients host their site separately;
--     concierge "Hosted Marketing Site" clients flip to HOSTED).
--   * Organization.contentQuotaOverride JSON for per-client quota bumps.
--   * ContentDraft.htmlBody / .aiContext / .chatThread for the editor.
--   * SiteIntelligence — cached Firecrawl crawl + Perplexity research +
--     Claude brand-voice extract per org. One row per org.
--   * MonthlyContentQuota — per-org per-UTC-month usage counter for
--     plan-based limits.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "PublishMode" AS ENUM ('HOSTED', 'EXTERNAL_VIA_ADMIN', 'EXTERNAL_VIA_WEBHOOK', 'EXTERNAL_VIA_GITHUB');

-- AlterTable: ContentDraft picks up editor state columns
ALTER TABLE "ContentDraft"
  ADD COLUMN "aiContext"  JSONB,
  ADD COLUMN "chatThread" JSONB,
  ADD COLUMN "htmlBody"   TEXT;

-- AlterTable: Organization gets publish-mode + per-client quota override
ALTER TABLE "Organization"
  ADD COLUMN "contentQuotaOverride" JSONB,
  ADD COLUMN "publishMode" "PublishMode" NOT NULL DEFAULT 'EXTERNAL_VIA_ADMIN';

-- CreateTable: SiteIntelligence (one per org)
CREATE TABLE "SiteIntelligence" (
    "id"           TEXT NOT NULL,
    "orgId"        TEXT NOT NULL,
    "rootUrl"      TEXT,
    "sitemapUrls"  TEXT[],
    "pages"        JSONB,
    "research"     JSONB,
    "brandVoice"   TEXT,
    "crawledAt"    TIMESTAMP(3),
    "researchedAt" TIMESTAMP(3),
    "brandVoiceAt" TIMESTAMP(3),
    "lastRunStats" JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MonthlyContentQuota
CREATE TABLE "MonthlyContentQuota" (
    "id"                       TEXT NOT NULL,
    "orgId"                    TEXT NOT NULL,
    "periodStart"              TIMESTAMP(3) NOT NULL,
    "blogPostsUsed"            INTEGER NOT NULL DEFAULT 0,
    "neighborhoodPagesUsed"    INTEGER NOT NULL DEFAULT 0,
    "propertyDescriptionsUsed" INTEGER NOT NULL DEFAULT 0,
    "metaRewritesUsed"         INTEGER NOT NULL DEFAULT 0,
    "faqBlocksUsed"            INTEGER NOT NULL DEFAULT 0,
    "adCopiesUsed"             INTEGER NOT NULL DEFAULT 0,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyContentQuota_pkey" PRIMARY KEY ("id")
);

-- Indexes + uniques
CREATE UNIQUE INDEX "SiteIntelligence_orgId_key"        ON "SiteIntelligence"("orgId");
CREATE        INDEX "SiteIntelligence_orgId_idx"        ON "SiteIntelligence"("orgId");
CREATE        INDEX "MonthlyContentQuota_orgId_periodStart_idx"
  ON "MonthlyContentQuota"("orgId", "periodStart");
CREATE UNIQUE INDEX "MonthlyContentQuota_orgId_periodStart_key"
  ON "MonthlyContentQuota"("orgId", "periodStart");

-- Foreign keys
ALTER TABLE "SiteIntelligence"     ADD CONSTRAINT "SiteIntelligence_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyContentQuota"  ADD CONSTRAINT "MonthlyContentQuota_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
