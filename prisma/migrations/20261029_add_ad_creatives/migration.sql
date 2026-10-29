-- S2 of plans/ads-read-only: per-ad creative mirror + per-ad daily metrics.
-- Additive only: two new tables, their indexes and FKs. No existing table is touched.

-- CreateTable
CREATE TABLE "AdCreative" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "platform" "AdPlatform" NOT NULL,
    "externalAdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "format" TEXT,
    "thumbnailUrl" TEXT,
    "imageUrl" TEXT,
    "videoId" TEXT,
    "headline" TEXT,
    "body" TEXT,
    "ctaType" TEXT,
    "landingUrl" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCreativeMetricDaily" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "adCreativeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpcCents" INTEGER NOT NULL DEFAULT 0,
    "costPerConversionCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCreativeMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdCreative_orgId_platform_idx" ON "AdCreative"("orgId", "platform");

-- CreateIndex
CREATE INDEX "AdCreative_campaignId_idx" ON "AdCreative"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCreative_adAccountId_externalAdId_key" ON "AdCreative"("adAccountId", "externalAdId");

-- CreateIndex
CREATE INDEX "AdCreativeMetricDaily_orgId_date_idx" ON "AdCreativeMetricDaily"("orgId", "date");

-- CreateIndex
CREATE INDEX "AdCreativeMetricDaily_adAccountId_date_idx" ON "AdCreativeMetricDaily"("adAccountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdCreativeMetricDaily_adCreativeId_date_key" ON "AdCreativeMetricDaily"("adCreativeId", "date");

-- AddForeignKey
ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCreativeMetricDaily" ADD CONSTRAINT "AdCreativeMetricDaily_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCreativeMetricDaily" ADD CONSTRAINT "AdCreativeMetricDaily_adCreativeId_fkey" FOREIGN KEY ("adCreativeId") REFERENCES "AdCreative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

