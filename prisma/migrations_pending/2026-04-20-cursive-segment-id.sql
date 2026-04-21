-- ============================================================================
-- Add cursiveSegmentId to CursiveIntegration
--
-- Used by the admin "Sync from segment" action to pull resolved visitors from
-- AudienceLab's /segments/{id} REST API on demand. Idempotent.
-- ============================================================================

ALTER TABLE "CursiveIntegration"
  ADD COLUMN IF NOT EXISTS "cursiveSegmentId"  TEXT,
  ADD COLUMN IF NOT EXISTS "lastSegmentSyncAt" TIMESTAMP(3);
