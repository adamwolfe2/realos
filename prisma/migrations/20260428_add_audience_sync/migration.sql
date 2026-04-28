-- ============================================================================
-- Audience Sync product line
-- Adds:
--   * ProductLine enum + Organization.productLine column
--   * Organization.cursiveApiKeyOverride (encrypted-at-rest, optional)
--   * AL_PARTNER value on UserRole
--   * AudienceDestinationType + AudienceSyncStatus enums
--   * AudienceSegment, AudienceDestination, AudienceSyncRun tables
--
-- Apply with:
--   pnpm prisma migrate deploy    (CI / Vercel)
-- or, locally on Neon (shadow DB unavailable):
--   pnpm prisma db push
-- ============================================================================

-- CreateEnum
CREATE TYPE "ProductLine" AS ENUM ('STUDENT_HOUSING', 'AUDIENCE_SYNC', 'AGENCY_INTERNAL');

-- AlterEnum: extend UserRole
ALTER TYPE "UserRole" ADD VALUE 'AL_PARTNER';

-- AlterTable: Organization
ALTER TABLE "Organization"
    ADD COLUMN "productLine" "ProductLine" NOT NULL DEFAULT 'STUDENT_HOUSING',
    ADD COLUMN "cursiveApiKeyOverride" TEXT;

-- CreateEnum
CREATE TYPE "AudienceDestinationType" AS ENUM (
    'CSV_DOWNLOAD',
    'WEBHOOK',
    'META_CUSTOM_AUDIENCE',
    'GOOGLE_CUSTOMER_MATCH'
);

-- CreateEnum
CREATE TYPE "AudienceSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "AudienceSegment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "alSegmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "rawPayload" JSONB,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudienceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceDestination" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "AudienceDestinationType" NOT NULL,
    "name" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecretEnc" TEXT,
    "adAccountId" TEXT,
    "externalAudienceId" TEXT,
    "segmentId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudienceDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceSyncRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "status" "AudienceSyncStatus" NOT NULL DEFAULT 'PENDING',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "filterSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "triggeredByUserId" TEXT,

    CONSTRAINT "AudienceSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AudienceSegment_orgId_alSegmentId_key"
    ON "AudienceSegment"("orgId", "alSegmentId");
CREATE INDEX "AudienceSegment_orgId_visible_idx"
    ON "AudienceSegment"("orgId", "visible");

CREATE INDEX "AudienceDestination_orgId_type_idx"
    ON "AudienceDestination"("orgId", "type");
CREATE INDEX "AudienceDestination_segmentId_idx"
    ON "AudienceDestination"("segmentId");
CREATE INDEX "AudienceDestination_adAccountId_idx"
    ON "AudienceDestination"("adAccountId");

CREATE INDEX "AudienceSyncRun_orgId_startedAt_idx"
    ON "AudienceSyncRun"("orgId", "startedAt" DESC);
CREATE INDEX "AudienceSyncRun_segmentId_startedAt_idx"
    ON "AudienceSyncRun"("segmentId", "startedAt" DESC);
CREATE INDEX "AudienceSyncRun_destinationId_startedAt_idx"
    ON "AudienceSyncRun"("destinationId", "startedAt" DESC);
CREATE INDEX "AudienceSyncRun_status_idx"
    ON "AudienceSyncRun"("status");

-- AddForeignKey
ALTER TABLE "AudienceSegment"
    ADD CONSTRAINT "AudienceSegment_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudienceDestination"
    ADD CONSTRAINT "AudienceDestination_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudienceDestination"
    ADD CONSTRAINT "AudienceDestination_adAccountId_fkey"
    FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AudienceDestination"
    ADD CONSTRAINT "AudienceDestination_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "AudienceSegment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AudienceSyncRun"
    ADD CONSTRAINT "AudienceSyncRun_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudienceSyncRun"
    ADD CONSTRAINT "AudienceSyncRun_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "AudienceSegment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudienceSyncRun"
    ADD CONSTRAINT "AudienceSyncRun_destinationId_fkey"
    FOREIGN KEY ("destinationId") REFERENCES "AudienceDestination"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
