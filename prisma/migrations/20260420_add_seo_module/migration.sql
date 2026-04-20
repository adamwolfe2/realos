-- ============================================================================
-- SEO module
-- Adds 4 tables that back the /portal/seo dashboard:
--   SeoIntegration (per tenant per provider, encrypted service account JSON)
--   SeoSnapshot    (daily aggregate per tenant, the time-series data)
--   SeoQuery       (top queries per tenant per day, GSC-derived)
--   SeoLandingPage (top landing pages per tenant per day, GA4-derived)
--
-- Apply with:
--   pnpm prisma db push           (Neon-friendly, no shadow DB)
-- or
--   pnpm prisma migrate deploy    (proper migration with shadow DB)
-- ============================================================================

-- CreateEnum
CREATE TYPE "SeoProvider" AS ENUM ('GSC', 'GA4');

-- CreateEnum
CREATE TYPE "SeoSyncStatus" AS ENUM ('IDLE', 'SYNCING', 'ERROR');

-- CreateTable
CREATE TABLE "SeoIntegration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "SeoProvider" NOT NULL,
    "propertyIdentifier" TEXT NOT NULL,
    "serviceAccountEmail" TEXT,
    "serviceAccountJsonEncrypted" TEXT NOT NULL,
    "status" "SeoSyncStatus" NOT NULL DEFAULT 'IDLE',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "organicSessions" INTEGER NOT NULL DEFAULT 0,
    "organicUsers" INTEGER NOT NULL DEFAULT 0,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "avgCtr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoQuery" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "query" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoLandingPage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "users" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgEngagementTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoLandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoIntegration_orgId_provider_key" ON "SeoIntegration"("orgId", "provider");
CREATE INDEX "SeoIntegration_orgId_idx" ON "SeoIntegration"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoSnapshot_orgId_date_key" ON "SeoSnapshot"("orgId", "date");
CREATE INDEX "SeoSnapshot_orgId_date_idx" ON "SeoSnapshot"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SeoQuery_orgId_date_query_key" ON "SeoQuery"("orgId", "date", "query");
CREATE INDEX "SeoQuery_orgId_date_idx" ON "SeoQuery"("orgId", "date");
CREATE INDEX "SeoQuery_orgId_clicks_idx" ON "SeoQuery"("orgId", "clicks");

-- CreateIndex
CREATE UNIQUE INDEX "SeoLandingPage_orgId_date_url_key" ON "SeoLandingPage"("orgId", "date", "url");
CREATE INDEX "SeoLandingPage_orgId_date_idx" ON "SeoLandingPage"("orgId", "date");
CREATE INDEX "SeoLandingPage_orgId_sessions_idx" ON "SeoLandingPage"("orgId", "sessions");

-- AddForeignKey
ALTER TABLE "SeoIntegration" ADD CONSTRAINT "SeoIntegration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSnapshot" ADD CONSTRAINT "SeoSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoQuery" ADD CONSTRAINT "SeoQuery_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoLandingPage" ADD CONSTRAINT "SeoLandingPage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
