-- Integration scope containment (2026-08-04): make activating a property
-- actually backfill it.
--
-- Why: the AppFolio sync declines to import child records (leads,
-- applications, residents, leases, listings, work orders) for any property
-- whose lifecycle is not ACTIVE. Without this column, a building promoted
-- IMPORTED -> ACTIVE stays permanently empty — the incremental sync window
-- is `since lastSyncAt`, which has long advanced past the records we
-- deliberately declined to store. The operator enables a building, waits,
-- and sees nothing, with no error anywhere.
--
-- A non-null value makes the NEXT sync run widen its window to the full
-- backfill. It is cleared only after a run that completed at least one
-- phase, and only when it has not been re-stamped mid-run.
--
-- Additive, nullable, no default, non-destructive, safe to re-run. Existing
-- rows land NULL, i.e. "no backfill pending" — identical to today's
-- behavior for every integration.

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "backfillRequestedAt" TIMESTAMP(3);
