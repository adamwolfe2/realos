-- ============================================================================
-- Site Engine intake — adds SiteRequest + IntakeResponse + SiteRequestAsset +
-- SiteRequestEvent plus their enums. Sits alongside the existing
-- WebsiteBuildRequest queue. SiteRequest.orgId is nullable to support public
-- submissions (no LeaseStack account yet).
--
-- Every statement is guarded (idempotent) so the migration can be safely
-- re-applied after a partial/failed run without tripping "already exists".
-- ============================================================================

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SiteRequestStatus" AS ENUM (
    'SUBMITTED',
    'TRIAGE',
    'NEEDS_INFO',
    'DISQUALIFIED',
    'QUALIFIED',
    'INSPIRATION_EXTRACTION',
    'SPEC_REVIEW',
    'READY_TO_BUILD',
    'IN_BUILD',
    'PREVIEW_READY',
    'CLIENT_REVIEW',
    'REVISION_REQUESTED',
    'APPROVED',
    'DEPLOYED',
    'MAINTENANCE',
    'PAUSED',
    'CHURNED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SiteRequestTier" AS ENUM (
    'TIER1_MARKETING',
    'TIER2_PORTAL',
    'TIER3_CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SiteRequestPriority" AS ENUM (
    'URGENT',
    'NORMAL',
    'LOW'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SiteRequestAssetType" AS ENUM (
    'LOGO',
    'HERO',
    'HEADSHOT',
    'PROPERTY_PHOTO',
    'LISTING_PHOTO',
    'BRAND_GUIDE',
    'INSPIRATION',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteRequest" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "orgId" TEXT,
  "submittedByName" TEXT NOT NULL,
  "submittedByEmail" TEXT NOT NULL,
  "submittedByPhone" TEXT,
  "submittedByCompany" TEXT,
  "status" "SiteRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "tier" "SiteRequestTier" NOT NULL DEFAULT 'TIER1_MARKETING',
  "priority" "SiteRequestPriority" NOT NULL DEFAULT 'NORMAL',
  "estimatedLaunchAt" TIMESTAMP(3),
  "source" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "referrer" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "assignedToUserId" TEXT,
  "internalNotes" TEXT,
  "githubRepoUrl" TEXT,
  "vercelProjectId" TEXT,
  "vercelPreviewUrl" TEXT,
  "productionUrl" TEXT,
  "previewSentAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "deployedAt" TIMESTAMP(3),
  "disqualifiedAt" TIMESTAMP(3),
  "disqualifiedReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SiteRequest_slug_key" ON "SiteRequest"("slug");
CREATE INDEX IF NOT EXISTS "SiteRequest_status_lastActivityAt_idx" ON "SiteRequest"("status", "lastActivityAt");
CREATE INDEX IF NOT EXISTS "SiteRequest_orgId_status_idx" ON "SiteRequest"("orgId", "status");
CREATE INDEX IF NOT EXISTS "SiteRequest_assignedToUserId_status_idx" ON "SiteRequest"("assignedToUserId", "status");
CREATE INDEX IF NOT EXISTS "SiteRequest_source_idx" ON "SiteRequest"("source");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SiteRequest" ADD CONSTRAINT "SiteRequest_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SiteRequest" ADD CONSTRAINT "SiteRequest_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntakeResponse" (
  "id" TEXT NOT NULL,
  "siteRequestId" TEXT NOT NULL,
  "identityType" TEXT,
  "brandName" TEXT NOT NULL,
  "tagline" TEXT,
  "brandColorHex" TEXT,
  "vertical" TEXT,
  "licenseNumber" TEXT,
  "brokerageName" TEXT,
  "licenseState" TEXT,
  "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "hqCity" TEXT,
  "hqState" TEXT,
  "currentSiteUrl" TEXT,
  "domain" TEXT,
  "domainNeeded" BOOLEAN,
  "dnsAccess" BOOLEAN,
  "inspirationUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "presetChoice" TEXT,
  "voiceSample" TEXT,
  "bio" TEXT,
  "services" JSONB,
  "testimonials" JSONB,
  "keyStats" JSONB,
  "calendlyUrl" TEXT,
  "crmChoice" TEXT,
  "mlsPreference" TEXT,
  "ga4Id" TEXT,
  "timelineExpectation" TEXT,
  "budgetConfirmed" BOOLEAN,
  "budgetTier" TEXT,
  "anythingElse" TEXT,
  "raw" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IntakeResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntakeResponse_siteRequestId_key" ON "IntakeResponse"("siteRequestId");

DO $$ BEGIN
  ALTER TABLE "IntakeResponse" ADD CONSTRAINT "IntakeResponse_siteRequestId_fkey"
    FOREIGN KEY ("siteRequestId") REFERENCES "SiteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteRequestAsset" (
  "id" TEXT NOT NULL,
  "siteRequestId" TEXT NOT NULL,
  "type" "SiteRequestAssetType" NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "blobUrl" TEXT NOT NULL,
  "pathname" TEXT,
  "label" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SiteRequestAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteRequestAsset_siteRequestId_type_idx" ON "SiteRequestAsset"("siteRequestId", "type");

DO $$ BEGIN
  ALTER TABLE "SiteRequestAsset" ADD CONSTRAINT "SiteRequestAsset_siteRequestId_fkey"
    FOREIGN KEY ("siteRequestId") REFERENCES "SiteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteRequestEvent" (
  "id" TEXT NOT NULL,
  "siteRequestId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "fromStatus" "SiteRequestStatus",
  "toStatus" "SiteRequestStatus",
  "message" TEXT,
  "actorUserId" TEXT,
  "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SiteRequestEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteRequestEvent_siteRequestId_createdAt_idx" ON "SiteRequestEvent"("siteRequestId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "SiteRequestEvent" ADD CONSTRAINT "SiteRequestEvent_siteRequestId_fkey"
    FOREIGN KEY ("siteRequestId") REFERENCES "SiteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
