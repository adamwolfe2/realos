-- AppFolio Applications by Unit + applicant grouping
-- All changes are additive and nullable / defaulted → zero-downtime.

-- CreateEnum
CREATE TYPE "ApplicantRole" AS ENUM ('PRIMARY', 'CO_APPLICANT', 'CO_SIGNER', 'OCCUPANT', 'GUARANTOR');

-- AlterTable
ALTER TABLE "Application"
  ADD COLUMN "unitName" TEXT,
  ADD COLUMN "unitExternalId" TEXT,
  ADD COLUMN "desiredMoveIn" TIMESTAMP(3),
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "applicationGroupId" TEXT,
  ADD COLUMN "applicantRole" "ApplicantRole" NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN "screeningStatus" TEXT;

-- CreateIndex
CREATE INDEX "Application_propertyId_unitExternalId_idx" ON "Application"("propertyId", "unitExternalId");

-- CreateIndex
CREATE INDEX "Application_applicationGroupId_idx" ON "Application"("applicationGroupId");

-- Dedup guard: the previous find-then-create upsert had a race window that
-- could (in theory) leave duplicate (leadId, backendAppId) rows. Collapse any
-- duplicates to the most-recently-updated row before adding the unique index
-- so this migration can never fail on existing data. No-op when clean.
DELETE FROM "Application" a
USING "Application" b
WHERE a."backendAppId" IS NOT NULL
  AND a."leadId" = b."leadId"
  AND a."backendAppId" = b."backendAppId"
  AND (a."updatedAt" < b."updatedAt"
       OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id"));

-- CreateIndex (idempotency on AppFolio applicant id; NULLs distinct → manual rows unaffected)
CREATE UNIQUE INDEX "Application_leadId_backendAppId_key" ON "Application"("leadId", "backendAppId");
