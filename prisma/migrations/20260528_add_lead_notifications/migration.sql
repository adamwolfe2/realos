-- ============================================================================
-- Instant lead-capture notifications.
--
-- Adds:
--   * Organization.notifyLeadEmail + 7 per-channel boolean toggles
--   * Property.notifyLeadEmailOverride
--   * LeadNotifyChannel + LeadNotifyStatus enums
--   * LeadNotificationDelivery table (audit trail + retry surface)
--
-- The Organization.notifyOn* booleans default to TRUE so the only thing an
-- operator has to do to start receiving notifications is paste an address
-- into Organization.notifyLeadEmail. The per-channel switches let them
-- silence individual sources without nuking the address.
--
-- Apply with:
--   pnpm prisma migrate deploy           (CI / Vercel build)
-- or, in a local dev session against Neon's direct (non-pooler) endpoint:
--   DIRECT_DATABASE_URL=... pnpm prisma migrate dev
-- ============================================================================

-- CreateEnum
CREATE TYPE "LeadNotifyChannel" AS ENUM (
    'CHATBOT',
    'POPUP',
    'FORM',
    'INGEST',
    'TOUR',
    'VISITOR_CONVERT',
    'MANUAL'
);

-- CreateEnum
CREATE TYPE "LeadNotifyStatus" AS ENUM (
    'PENDING',
    'SENT',
    'FAILED',
    'SUPPRESSED'
);

-- AlterTable
ALTER TABLE "Organization"
    ADD COLUMN     "notifyLeadEmail"        TEXT,
    ADD COLUMN     "notifyOnChatbotLead"    BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN     "notifyOnPopupLead"      BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN     "notifyOnFormLead"       BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN     "notifyOnIngestLead"     BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN     "notifyOnTourRequest"    BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN     "notifyOnVisitorConvert" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN     "notifyOnManualLead"     BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Property"
    ADD COLUMN     "notifyLeadEmailOverride" TEXT;

-- CreateTable
CREATE TABLE "LeadNotificationDelivery" (
    "id"           TEXT NOT NULL,
    "orgId"        TEXT NOT NULL,
    "leadId"       TEXT,
    "propertyId"   TEXT,
    "channel"      "LeadNotifyChannel" NOT NULL,
    "recipient"    TEXT NOT NULL,
    "status"       "LeadNotifyStatus" NOT NULL DEFAULT 'PENDING',
    "resendId"     TEXT,
    "errorMessage" TEXT,
    "attempts"     INTEGER NOT NULL DEFAULT 0,
    "subject"      TEXT NOT NULL,
    "payload"      JSONB NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt"       TIMESTAMP(3),

    CONSTRAINT "LeadNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadNotificationDelivery_orgId_createdAt_idx"
    ON "LeadNotificationDelivery"("orgId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LeadNotificationDelivery_leadId_idx"
    ON "LeadNotificationDelivery"("leadId");

-- CreateIndex
CREATE INDEX "LeadNotificationDelivery_status_createdAt_idx"
    ON "LeadNotificationDelivery"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadNotificationDelivery"
    ADD CONSTRAINT "LeadNotificationDelivery_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
