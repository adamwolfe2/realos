-- ============================================================================
-- Audience Sync — recurring schedules
-- Adds:
--   * AudienceScheduleFrequency enum (DAILY, WEEKLY)
--   * AudienceSyncSchedule table + indexes + foreign keys
--
-- Apply with:
--   pnpm prisma migrate deploy    (CI / Vercel)
-- or, locally on Neon (shadow DB unavailable):
--   pnpm prisma db push
-- ============================================================================

-- CreateEnum
CREATE TYPE "AudienceScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "AudienceSyncSchedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "frequency" "AudienceScheduleFrequency" NOT NULL,
    "dayOfWeek" INTEGER,
    "hourUtc" INTEGER NOT NULL,
    "filterSnapshot" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudienceSyncSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudienceSyncSchedule_orgId_enabled_idx"
    ON "AudienceSyncSchedule"("orgId", "enabled");
CREATE INDEX "AudienceSyncSchedule_nextRunAt_enabled_idx"
    ON "AudienceSyncSchedule"("nextRunAt", "enabled");
CREATE INDEX "AudienceSyncSchedule_segmentId_idx"
    ON "AudienceSyncSchedule"("segmentId");
CREATE INDEX "AudienceSyncSchedule_destinationId_idx"
    ON "AudienceSyncSchedule"("destinationId");

-- AddForeignKey
ALTER TABLE "AudienceSyncSchedule"
    ADD CONSTRAINT "AudienceSyncSchedule_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudienceSyncSchedule"
    ADD CONSTRAINT "AudienceSyncSchedule_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "AudienceSegment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudienceSyncSchedule"
    ADD CONSTRAINT "AudienceSyncSchedule_destinationId_fkey"
    FOREIGN KEY ("destinationId") REFERENCES "AudienceDestination"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
