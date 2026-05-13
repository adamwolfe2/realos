-- Properties pagination indexes — supports the May 2026 refactor of
-- /portal/properties to fully-server-side pagination + ILIKE search.
--
-- The new query shape on the Properties list page:
--
--   SELECT * FROM "Property"
--   WHERE "orgId" = $1
--     AND lifecycle = 'ACTIVE'
--     [AND <view filter>]
--     [AND (name ILIKE %q% OR addressLine1 ILIKE %q% OR ...)]
--   ORDER BY "updatedAt" DESC
--   LIMIT 50 OFFSET $2;
--
-- Plus parallel COUNT(*) queries for each view tab. The existing
-- (orgId, lifecycle) index covers the WHERE narrowing, but Postgres
-- still has to sort the matching set by updatedAt at query time. For
-- portfolios approaching low thousands of properties this becomes
-- the dominant cost. The new composite covers both the WHERE AND the
-- ORDER BY, enabling an index scan that returns rows in order without
-- a separate sort step.
--
-- The view-filter indexes (availableCount, lastSyncedAt) are partial
-- indexes scoped to lifecycle='ACTIVE' so they stay tiny and only
-- catch the rows operators actually browse — IMPORTED + EXCLUDED rows
-- never appear in the list. Partial indexes are a Postgres feature
-- Prisma doesn't model in @@index, so they're declared in raw SQL.
--
-- IF NOT EXISTS so re-running this migration after a manual schema
-- patch is safe.

-- 1. Dominant query path: WHERE orgId + lifecycle ORDER BY updatedAt DESC.
CREATE INDEX IF NOT EXISTS "Property_orgId_lifecycle_updatedAt_idx"
  ON "Property" ("orgId", "lifecycle", "updatedAt" DESC);

-- 2. "Has vacancies" view filter — partial index limits the size to
--    the rows we actually filter (lifecycle=ACTIVE + availableCount > 0).
CREATE INDEX IF NOT EXISTS "Property_orgId_availableCount_active_idx"
  ON "Property" ("orgId", "availableCount" DESC)
  WHERE "lifecycle" = 'ACTIVE' AND "availableCount" > 0;

-- 3. "Recently synced" view filter — partial on lifecycle=ACTIVE so
--    the index only covers marketable rows.
CREATE INDEX IF NOT EXISTS "Property_orgId_lastSyncedAt_active_idx"
  ON "Property" ("orgId", "lastSyncedAt" DESC)
  WHERE "lifecycle" = 'ACTIVE' AND "lastSyncedAt" IS NOT NULL;

-- 4. ILIKE search on name — pg_trgm GIN index gives fast substring
--    matching without a sequential scan. Without this, ILIKE %q%
--    forces a full scan of the (orgId, lifecycle)-filtered set, which
--    is fine at 100 rows and slow at 10,000.
--
--    Wrapped in a DO block so the migration succeeds even if the
--    pg_trgm extension isn't enabled on the target DB (Neon needs an
--    explicit CREATE EXTENSION). The extension is created here too,
--    behind IF NOT EXISTS, so first-time deployments get it.
DO $$
BEGIN
  -- pg_trgm is in the standard contrib, available on Neon, Supabase,
  -- and RDS. Wrapping in a DO block lets us swallow EX_PERMISSION_DENIED
  -- gracefully if the deploy account can't create extensions — the
  -- ILIKE queries still WORK, they're just slower without the index.
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm extension creation skipped (insufficient privilege). ILIKE search will work but without the trigram acceleration.';
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    -- Property name is the highest-signal search field, so it gets the
    -- dedicated GIN. addressLine1 + city + state are lower priority but
    -- still indexed under one combined GIN to keep write amplification
    -- bounded.
    CREATE INDEX IF NOT EXISTS "Property_name_trgm_idx"
      ON "Property" USING gin ("name" gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS "Property_address_trgm_idx"
      ON "Property" USING gin (
        (COALESCE("addressLine1", '') || ' ' || COALESCE("city", '') || ' ' || COALESCE("state", '')) gin_trgm_ops
      );
  END IF;
END $$;
