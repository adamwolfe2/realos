-- Proposal Builder migration
-- Spec: .claude/specs/2026-06-02-proposal-builder.md
-- 2026-06-02

-- ============================================================================
-- Enums
-- ============================================================================
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELED');
CREATE TYPE "ProposalCadence" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "ProposalLineKind" AS ENUM ('TIER', 'ADDON', 'CUSTOM', 'SETUP');
CREATE TYPE "ProposalCatalogKind" AS ENUM ('TIER', 'ADDON');

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE "Proposal" (
  "id"                     TEXT NOT NULL,
  "number"                 TEXT NOT NULL,
  "status"                 "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "prospectName"           TEXT NOT NULL,
  "prospectEmail"          TEXT NOT NULL,
  "prospectCompany"        TEXT,
  "prospectOrgId"          TEXT,
  "intakeId"               TEXT,
  "cadence"                "ProposalCadence",
  "trialDays"              INTEGER NOT NULL DEFAULT 0,
  "currency"               TEXT NOT NULL DEFAULT 'usd',
  "recurringSubtotalCents" INTEGER NOT NULL DEFAULT 0,
  "oneTimeSubtotalCents"   INTEGER NOT NULL DEFAULT 0,
  "discountAmountCents"    INTEGER NOT NULL DEFAULT 0,
  "discountReason"         TEXT,
  "discountScope"          TEXT NOT NULL DEFAULT 'both',
  "expiresAt"              TIMESTAMP(3),
  "publicMessage"          TEXT,
  "internalNotes"          TEXT,
  "stripeCustomerId"       TEXT,
  "stripeCheckoutId"       TEXT,
  "stripeSubscriptionId"   TEXT,
  "stripeInvoiceId"        TEXT,
  "checkoutVersion"        INTEGER NOT NULL DEFAULT 0,
  "pdfCachedAt"            TIMESTAMP(3),
  "pdfBlobUrl"             TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,
  "sentAt"                 TIMESTAMP(3),
  "firstViewedAt"          TIMESTAMP(3),
  "lastViewedAt"           TIMESTAMP(3),
  "viewCount"              INTEGER NOT NULL DEFAULT 0,
  "acceptedAt"             TIMESTAMP(3),
  "declinedAt"             TIMESTAMP(3),
  "canceledAt"             TIMESTAMP(3),
  "voidedAt"               TIMESTAMP(3),
  "voidReason"             TEXT,
  "createdById"            TEXT,
  CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Proposal_number_key" ON "Proposal"("number");
CREATE INDEX "Proposal_status_createdAt_idx" ON "Proposal"("status", "createdAt" DESC);
CREATE INDEX "Proposal_prospectEmail_idx" ON "Proposal"("prospectEmail");
CREATE INDEX "Proposal_prospectOrgId_idx" ON "Proposal"("prospectOrgId");
CREATE INDEX "Proposal_stripeCustomerId_idx" ON "Proposal"("stripeCustomerId");
CREATE INDEX "Proposal_stripeCheckoutId_idx" ON "Proposal"("stripeCheckoutId");

ALTER TABLE "Proposal"
  ADD CONSTRAINT "Proposal_prospectOrgId_fkey"
    FOREIGN KEY ("prospectOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Proposal_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "IntakeSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Proposal_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "ProposalCatalogItem" (
  "id"                   TEXT NOT NULL,
  "kind"                 "ProposalCatalogKind" NOT NULL,
  "slug"                 TEXT NOT NULL,
  "label"                TEXT NOT NULL,
  "description"          TEXT NOT NULL,
  "defaultPriceCents"    INTEGER NOT NULL,
  "cadence"              "ProposalCadence",
  "stripePriceIdMonthly" TEXT,
  "stripePriceIdAnnual"  TEXT,
  "active"               BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"            INTEGER NOT NULL DEFAULT 0,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalCatalogItem_slug_key" ON "ProposalCatalogItem"("slug");
CREATE INDEX "ProposalCatalogItem_kind_active_sortOrder_idx" ON "ProposalCatalogItem"("kind", "active", "sortOrder");


CREATE TABLE "ProposalLineItem" (
  "id"             TEXT NOT NULL,
  "proposalId"     TEXT NOT NULL,
  "kind"           "ProposalLineKind" NOT NULL,
  "catalogItemId"  TEXT,
  "label"          TEXT NOT NULL,
  "description"    TEXT,
  "unitPriceCents" INTEGER NOT NULL,
  "quantity"       INTEGER NOT NULL DEFAULT 1,
  "recurring"      BOOLEAN NOT NULL DEFAULT true,
  "stripePriceId"  TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProposalLineItem_proposalId_idx" ON "ProposalLineItem"("proposalId");
CREATE INDEX "ProposalLineItem_catalogItemId_idx" ON "ProposalLineItem"("catalogItemId");

ALTER TABLE "ProposalLineItem"
  ADD CONSTRAINT "ProposalLineItem_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProposalLineItem_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "ProposalCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "ProposalShareToken" (
  "id"         TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"  TIMESTAMP(3),
  CONSTRAINT "ProposalShareToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalShareToken_token_key" ON "ProposalShareToken"("token");
CREATE INDEX "ProposalShareToken_token_idx" ON "ProposalShareToken"("token");
CREATE INDEX "ProposalShareToken_proposalId_revokedAt_idx" ON "ProposalShareToken"("proposalId", "revokedAt");

ALTER TABLE "ProposalShareToken"
  ADD CONSTRAINT "ProposalShareToken_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "ProposalAcceptance" (
  "id"                    TEXT NOT NULL,
  "proposalId"            TEXT NOT NULL,
  "acceptedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stripeCheckoutId"      TEXT NOT NULL,
  "stripeCustomerId"      TEXT NOT NULL,
  "stripeInvoiceId"       TEXT,
  "stripeSubscriptionId"  TEXT,
  "stripePaymentIntentId" TEXT,
  "amountPaidCents"       INTEGER NOT NULL,
  "provisionedOrgId"      TEXT,
  "provisionedAt"         TIMESTAMP(3),
  CONSTRAINT "ProposalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalAcceptance_proposalId_key" ON "ProposalAcceptance"("proposalId");
CREATE INDEX "ProposalAcceptance_stripeCheckoutId_idx" ON "ProposalAcceptance"("stripeCheckoutId");
CREATE INDEX "ProposalAcceptance_stripeCustomerId_idx" ON "ProposalAcceptance"("stripeCustomerId");
CREATE INDEX "ProposalAcceptance_stripePaymentIntentId_idx" ON "ProposalAcceptance"("stripePaymentIntentId");
CREATE INDEX "ProposalAcceptance_provisionedOrgId_idx" ON "ProposalAcceptance"("provisionedOrgId");

ALTER TABLE "ProposalAcceptance"
  ADD CONSTRAINT "ProposalAcceptance_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProposalAcceptance_provisionedOrgId_fkey"
    FOREIGN KEY ("provisionedOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "ProcessedStripeEvent" (
  "eventId"     TEXT NOT NULL,
  "eventType"   TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "proposalId"  TEXT,
  "orgId"       TEXT,
  CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "ProcessedStripeEvent_processedAt_idx" ON "ProcessedStripeEvent"("processedAt");
CREATE INDEX "ProcessedStripeEvent_proposalId_idx" ON "ProcessedStripeEvent"("proposalId");
CREATE INDEX "ProcessedStripeEvent_orgId_idx" ON "ProcessedStripeEvent"("orgId");
