-- Append-only audit trail for LeaseStack lead -> AppFolio outcome matching.
-- Additive only: no existing lead, resident, application, or lease rows change.

CREATE TYPE "LeadMatchDecisionStatus" AS ENUM (
  'MATCHED',
  'UNMATCHED',
  'REVIEW_REQUIRED',
  'AMBIGUOUS',
  'REJECTED',
  'MANUAL_MATCH',
  'MANUAL_UNLINK'
);

CREATE TYPE "LeadMatchMethod" AS ENUM (
  'PHONE_EMAIL',
  'NAME_EMAIL',
  'NAME_PHONE',
  'EXACT_EMAIL',
  'NORMALIZED_EMAIL',
  'EXACT_PHONE',
  'NORMALIZED_PHONE',
  'FUZZY_COMPOSITE',
  'NAME_ONLY',
  'MANUAL',
  'NONE'
);

CREATE TABLE "LeadMatchDecision" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "propertyId" TEXT,
  "residentId" TEXT,
  "applicationId" TEXT,
  "leadId" TEXT,
  "status" "LeadMatchDecisionStatus" NOT NULL,
  "method" "LeadMatchMethod" NOT NULL,
  "confidence" INTEGER NOT NULL,
  "evidence" JSONB,
  "syncRunId" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadMatchDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadMatchDecision_confidence_check"
    CHECK ("confidence" >= 0 AND "confidence" <= 100)
);

CREATE INDEX "LeadMatchDecision_orgId_status_createdAt_idx"
  ON "LeadMatchDecision"("orgId", "status", "createdAt");
CREATE INDEX "LeadMatchDecision_residentId_createdAt_idx"
  ON "LeadMatchDecision"("residentId", "createdAt");
CREATE INDEX "LeadMatchDecision_applicationId_createdAt_idx"
  ON "LeadMatchDecision"("applicationId", "createdAt");
CREATE INDEX "LeadMatchDecision_leadId_createdAt_idx"
  ON "LeadMatchDecision"("leadId", "createdAt");
CREATE INDEX "LeadMatchDecision_syncRunId_idx"
  ON "LeadMatchDecision"("syncRunId");

ALTER TABLE "LeadMatchDecision"
  ADD CONSTRAINT "LeadMatchDecision_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadMatchDecision"
  ADD CONSTRAINT "LeadMatchDecision_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadMatchDecision"
  ADD CONSTRAINT "LeadMatchDecision_residentId_fkey"
  FOREIGN KEY ("residentId") REFERENCES "Resident"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadMatchDecision"
  ADD CONSTRAINT "LeadMatchDecision_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadMatchDecision"
  ADD CONSTRAINT "LeadMatchDecision_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
