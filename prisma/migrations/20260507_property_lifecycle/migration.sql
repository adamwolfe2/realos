-- Property lifecycle: separates AppFolio-imported rows from operator-curated
-- "marketable" properties so dashboards/counts/onboarding flows can ignore
-- parking lots, storage units, sub-records, and HOA-only entities without
-- losing them from the database.
--
-- Trade-off: AppFolio sync continues to import everything (no data loss),
-- but new rows land as IMPORTED and only show in dashboards once an
-- operator (or the auto-classifier) promotes them to ACTIVE. This was the
-- explicit product call from 2026-05-07.

-- 1. Lifecycle enum
CREATE TYPE "PropertyLifecycle" AS ENUM (
  'IMPORTED',  -- Fresh from sync, awaiting operator review
  'ACTIVE',    -- Marketable building under management
  'EXCLUDED',  -- Parking lot / storage / sub-record / "do not use"
  'ARCHIVED'   -- Was active, no longer on platform
);

-- 2. Who set the lifecycle. AUTO_CLASSIFIER decisions can be overridden
--    by re-classification on re-sync; OPERATOR decisions are sticky.
CREATE TYPE "PropertyLifecycleSource" AS ENUM (
  'AUTO_CLASSIFIER',
  'OPERATOR'
);

-- 3. Add columns. Existing rows backfill to ACTIVE so we don't suddenly
--    hide every property when the migration ships.
ALTER TABLE "Property"
  ADD COLUMN "lifecycle" "PropertyLifecycle" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "lifecycleSetBy" "PropertyLifecycleSource" NOT NULL DEFAULT 'AUTO_CLASSIFIER',
  ADD COLUMN "lifecycleSetAt" TIMESTAMP(3),
  ADD COLUMN "excludeReason" TEXT;

-- 4. Auto-classify the obvious sub-records that already snuck in. These
--    pattern matches are deliberately conservative — we'd rather leave a
--    real building as ACTIVE and let the operator excluded-flag it later
--    than auto-exclude a real building. The patterns target AppFolio's
--    well-known sub-record naming conventions.
UPDATE "Property"
SET
  "lifecycle" = 'EXCLUDED',
  "lifecycleSetBy" = 'AUTO_CLASSIFIER',
  "lifecycleSetAt" = NOW(),
  "excludeReason" = 'auto-classified: name pattern matches non-marketable sub-record'
WHERE "lifecycle" = 'ACTIVE'
  AND (
    "name" ~* '\m(parking|storage|garage|locker|carport|laundry|maintenance|leasing.?office|model.?unit|amenity|amenities|pool|gym|clubhouse)\M'
    OR "name" ILIKE '%do not use%'
    OR "name" ILIKE 'Property %'
    OR "name" ~* '^unit\s'
  );

-- 5. Index for the most common dashboard query: "all marketable properties
--    for an org". Covers count() and findMany filtered by lifecycle.
CREATE INDEX "Property_orgId_lifecycle_idx"
  ON "Property"("orgId", "lifecycle");

-- 6. Set lifecycleSetAt for ALL pre-existing rows so the audit trail isn't
--    blank. Use createdAt as the closest approximation we have.
UPDATE "Property"
SET "lifecycleSetAt" = COALESCE("lifecycleSetAt", "createdAt")
WHERE "lifecycleSetAt" IS NULL;
