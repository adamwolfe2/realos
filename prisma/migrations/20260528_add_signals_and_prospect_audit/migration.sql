-- ============================================================================
-- Signals system — DailySignalSnapshot + ProspectAudit
--
-- Backs /audit (public lead-magnet report) and /portal/insights (operator
-- dashboard rebuild). One row per day per scope (tenant org/property OR
-- public prospect audit). See lib/signals/* for compute/persist/read helpers.
--
-- Apply with:
--   pnpm prisma migrate deploy           (CI / Vercel build)
-- or, in a local dev session against Neon's direct (non-pooler) endpoint:
--   DIRECT_DATABASE_URL=... pnpm prisma migrate dev
-- ============================================================================

-- CreateEnum
CREATE TYPE "ProspectAuditStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SignalScopeKind" AS ENUM ('TENANT', 'PROSPECT');

-- CreateTable
CREATE TABLE "ProspectAudit" (
    "id" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "urlInput" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "brandName" TEXT,
    "email" TEXT,
    "emailCapturedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "ProspectAuditStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "overallScore" INTEGER,
    "sectionScores" JSONB,
    "claudeSummary" TEXT,
    "findings" JSONB,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySignalSnapshot" (
    "id" TEXT NOT NULL,
    "scopeKind" "SignalScopeKind" NOT NULL,
    "orgId" TEXT,
    "propertyId" TEXT,
    "prospectAuditId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "capturedOn" DATE NOT NULL,
    "seo" JSONB,
    "aeo" JSONB,
    "reputation" JSONB,
    "chatbot" JSONB,
    "leads" JSONB,
    "traffic" JSONB,
    "overallScore" INTEGER,
    "deltas7d" JSONB,
    "computeMs" INTEGER,
    "computeVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySignalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProspectAudit_shareToken_key" ON "ProspectAudit"("shareToken");

-- CreateIndex
CREATE INDEX "ProspectAudit_domain_createdAt_idx" ON "ProspectAudit"("domain", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProspectAudit_status_createdAt_idx" ON "ProspectAudit"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProspectAudit_expiresAt_idx" ON "ProspectAudit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailySignalSnapshot_scopeKey_capturedOn_key" ON "DailySignalSnapshot"("scopeKey", "capturedOn");

-- CreateIndex
CREATE INDEX "DailySignalSnapshot_scopeKey_capturedOn_idx" ON "DailySignalSnapshot"("scopeKey", "capturedOn" DESC);

-- CreateIndex
CREATE INDEX "DailySignalSnapshot_capturedOn_idx" ON "DailySignalSnapshot"("capturedOn");

-- CreateIndex
CREATE INDEX "DailySignalSnapshot_prospectAuditId_idx" ON "DailySignalSnapshot"("prospectAuditId");

-- CreateIndex
CREATE INDEX "DailySignalSnapshot_orgId_propertyId_capturedOn_idx" ON "DailySignalSnapshot"("orgId", "propertyId", "capturedOn" DESC);

-- AddForeignKey
ALTER TABLE "DailySignalSnapshot"
    ADD CONSTRAINT "DailySignalSnapshot_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySignalSnapshot"
    ADD CONSTRAINT "DailySignalSnapshot_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySignalSnapshot"
    ADD CONSTRAINT "DailySignalSnapshot_prospectAuditId_fkey"
    FOREIGN KEY ("prospectAuditId") REFERENCES "ProspectAudit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Scope XOR check — TENANT rows must point at an org (propertyId optional);
-- PROSPECT rows must point at a prospect audit and never at an org/property.
ALTER TABLE "DailySignalSnapshot" ADD CONSTRAINT scope_xor CHECK (
  ("scopeKind" = 'TENANT'   AND "orgId" IS NOT NULL AND "prospectAuditId" IS NULL) OR
  ("scopeKind" = 'PROSPECT' AND "prospectAuditId" IS NOT NULL AND "orgId" IS NULL)
);
