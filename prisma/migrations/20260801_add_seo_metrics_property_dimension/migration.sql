-- Wave 3 Phase 5: property dimension on SEO metrics (SeoSnapshot, SeoQuery,
-- SeoLandingPage). Two properties' GSC/GA4 data currently collide because
-- these tables are keyed org-wide only (@@unique([orgId, date]) etc.) — a
-- second per-property SeoIntegration syncing the same org overwrites the
-- first property's rows.
--
-- Additive + idempotent throughout (ADD COLUMN IF NOT EXISTS / CREATE INDEX
-- IF NOT EXISTS / DO-block FK guards / DROP ... IF EXISTS), matching
-- 20260801_add_visitor_session_event_property. Idempotent under
-- `prisma migrate deploy` (which never replays an applied migration); a
-- manual re-run is also safe now that steps 2 and 2b guard against
-- re-stamping a row that already has a property-scoped sibling for the
-- same key (see comment on step 2b).
--
-- Uniqueness strategy: Prisma cannot express a partial unique index, so the
-- old @@unique([orgId, date]) (etc.) constraints are removed from the
-- Prisma schema entirely and reimplemented here as TWO raw-SQL partial
-- unique indexes per table — one for org-wide rows (propertyId IS NULL),
-- one for property-scoped rows (propertyId IS NOT NULL). NULL is not
-- equal to NULL in a unique index, so without the WHERE split, Postgres
-- would happily allow unlimited org-wide rows per date once propertyId
-- entered the key. The partial split is what actually enforces
-- "one org-wide row per date, plus at most one row per property per date".
--
-- WARNING: these six partial unique indexes are invisible to Prisma's
-- schema/migration diff engine (see the WARNING comment on SeoSnapshot in
-- schema.prisma). `prisma db push` / `prisma migrate dev` against a real
-- database can generate a DROP INDEX for any of them. Only
-- `prisma migrate deploy` is safe.

-- ============================================================
-- 1) ADD COLUMN + FK (NOT VALID) + supporting index (per table)
--
-- FKs are added NOT VALID, then validated in a separate statement (step
-- 1b). A plain ADD CONSTRAINT takes SHARE ROW EXCLUSIVE and performs a
-- full validation scan against the existing table inside the same
-- transaction migrate deploy wraps the file in — on a busy table (these
-- SEO tables are lower-volume than VisitorEvent, but the pattern is kept
-- consistent with 20260801_add_visitor_session_event_property) that scan
-- can hold the lock long enough to stall concurrent writers. NOT VALID
-- skips the scan and takes only SHARE UPDATE EXCLUSIVE (does not block
-- writes); VALIDATE CONSTRAINT then does the scan under a lock that
-- permits concurrent reads/writes.
--
-- CASCADE (not SET NULL): a property-scoped row nulled by SET NULL on
-- delete can collide with the org-wide partial unique for the same date
-- (two properties deleted sequentially can also collide with each other).
-- Property-scoped metric rows are meaningless without their property, so
-- they are deleted along with it instead — see lib/actions/properties.ts
-- deleteProperty.
-- ============================================================

ALTER TABLE "SeoSnapshot" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "SeoSnapshot_orgId_propertyId_date_idx"
  ON "SeoSnapshot" ("orgId", "propertyId", "date");

DO $$ BEGIN
  ALTER TABLE "SeoSnapshot" ADD CONSTRAINT "SeoSnapshot_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "SeoSnapshot" VALIDATE CONSTRAINT "SeoSnapshot_propertyId_fkey";

ALTER TABLE "SeoQuery" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "SeoQuery_orgId_propertyId_date_idx"
  ON "SeoQuery" ("orgId", "propertyId", "date");

DO $$ BEGIN
  ALTER TABLE "SeoQuery" ADD CONSTRAINT "SeoQuery_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "SeoQuery" VALIDATE CONSTRAINT "SeoQuery_propertyId_fkey";

ALTER TABLE "SeoLandingPage" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "SeoLandingPage_orgId_propertyId_date_idx"
  ON "SeoLandingPage" ("orgId", "propertyId", "date");

DO $$ BEGIN
  ALTER TABLE "SeoLandingPage" ADD CONSTRAINT "SeoLandingPage_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "SeoLandingPage" VALIDATE CONSTRAINT "SeoLandingPage_propertyId_fkey";

-- ============================================================
-- 2) BACKFILL — stamp propertyId on pre-existing rows, conservatively.
--
-- A SeoSnapshot row blends GSC + GA4 fields into one row, and pre-migration
-- an org could have GSC/GA4 pointed at different LeaseStack properties with
-- no way to tell, after the fact, which fields came from which property.
-- We do NOT attempt to untangle that. We only stamp an org's existing rows
-- when the backfill can be done with zero guessing:
--
--   an org's non-DEMO SeoIntegration rows all share exactly ONE distinct,
--   non-null propertyId (COUNT(DISTINCT propertyId) = 1 AND no NULL-scoped
--   integration rows for that org) — i.e. every GSC/GA4 connection this org
--   has ever made points at the same single property. In that case every
--   historical row unambiguously belongs to that property.
--
-- Orgs with a NULL-scoped integration (legacy "applies to whole org") or
-- with integrations spanning >1 distinct property are left NULL (stay
-- org-wide / unattributed) — multi-property blended history is not
-- untangleable and we do not guess (per 2026-08-01 addendum decision).
--
-- 2b) DEMO_SEED metric-row exclusion: the eligibility subquery already
-- excludes DEMO_SEED *integrations* from the propertyId computation, but
-- that alone does not stop the UPDATE from stamping an eligible org's
-- DEMO_SEED-sourced metric rows (scripts/seed-dashboard-data.ts writes
-- propertyId-NULL SeoSnapshot/SeoQuery/SeoLandingPage rows with no
-- provenance marker of its own) — an org with both a demo integration and
-- one real per-property integration would have its fabricated traffic
-- re-attributed to a real building. The NOT EXISTS guard below skips the
-- ENTIRE org (not just the demo rows) whenever any DEMO_SEED integration
-- exists for it, so demo data is never re-attributed.
--
-- Guarded to only touch rows still unset (propertyId IS NULL) AND with no
-- existing property-scoped sibling for the same key, so re-running this
-- migration (e.g. manually, out-of-band) cannot raise a unique violation
-- against the property-scoped partial index created in step 4.
-- ============================================================

UPDATE "SeoSnapshot" t
   SET "propertyId" = elig."propertyId"
  FROM (
    SELECT "orgId", MIN("propertyId") AS "propertyId"
      FROM "SeoIntegration"
     WHERE "serviceAccountJsonEncrypted" <> 'DEMO_SEED'
     GROUP BY "orgId"
    HAVING COUNT(DISTINCT "propertyId") = 1
       AND COUNT(*) FILTER (WHERE "propertyId" IS NULL) = 0
  ) elig
 WHERE t."orgId" = elig."orgId"
   AND t."propertyId" IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM "SeoIntegration" d
      WHERE d."orgId" = elig."orgId"
        AND d."serviceAccountJsonEncrypted" = 'DEMO_SEED'
   )
   AND NOT EXISTS (
     SELECT 1 FROM "SeoSnapshot" x
      WHERE x."orgId" = t."orgId"
        AND x."propertyId" = elig."propertyId"
        AND x."date" = t."date"
   );

UPDATE "SeoQuery" t
   SET "propertyId" = elig."propertyId"
  FROM (
    SELECT "orgId", MIN("propertyId") AS "propertyId"
      FROM "SeoIntegration"
     WHERE "serviceAccountJsonEncrypted" <> 'DEMO_SEED'
     GROUP BY "orgId"
    HAVING COUNT(DISTINCT "propertyId") = 1
       AND COUNT(*) FILTER (WHERE "propertyId" IS NULL) = 0
  ) elig
 WHERE t."orgId" = elig."orgId"
   AND t."propertyId" IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM "SeoIntegration" d
      WHERE d."orgId" = elig."orgId"
        AND d."serviceAccountJsonEncrypted" = 'DEMO_SEED'
   )
   AND NOT EXISTS (
     SELECT 1 FROM "SeoQuery" x
      WHERE x."orgId" = t."orgId"
        AND x."propertyId" = elig."propertyId"
        AND x."date" = t."date"
        AND x."query" = t."query"
   );

UPDATE "SeoLandingPage" t
   SET "propertyId" = elig."propertyId"
  FROM (
    SELECT "orgId", MIN("propertyId") AS "propertyId"
      FROM "SeoIntegration"
     WHERE "serviceAccountJsonEncrypted" <> 'DEMO_SEED'
     GROUP BY "orgId"
    HAVING COUNT(DISTINCT "propertyId") = 1
       AND COUNT(*) FILTER (WHERE "propertyId" IS NULL) = 0
  ) elig
 WHERE t."orgId" = elig."orgId"
   AND t."propertyId" IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM "SeoIntegration" d
      WHERE d."orgId" = elig."orgId"
        AND d."serviceAccountJsonEncrypted" = 'DEMO_SEED'
   )
   AND NOT EXISTS (
     SELECT 1 FROM "SeoLandingPage" x
      WHERE x."orgId" = t."orgId"
        AND x."propertyId" = elig."propertyId"
        AND x."date" = t."date"
        AND x."url" = t."url"
   );

-- ============================================================
-- 3) DROP old org-wide-only unique constraints (both constraint and
--    backing-index forms — a constraint's backing index shares its name in
--    Postgres, but guard both spellings in case the DB was provisioned via
--    `prisma db push` instead of a migration history).
-- ============================================================

ALTER TABLE "SeoSnapshot" DROP CONSTRAINT IF EXISTS "SeoSnapshot_orgId_date_key";
DROP INDEX IF EXISTS "SeoSnapshot_orgId_date_key";

ALTER TABLE "SeoQuery" DROP CONSTRAINT IF EXISTS "SeoQuery_orgId_date_query_key";
DROP INDEX IF EXISTS "SeoQuery_orgId_date_query_key";

ALTER TABLE "SeoLandingPage" DROP CONSTRAINT IF EXISTS "SeoLandingPage_orgId_date_url_key";
DROP INDEX IF EXISTS "SeoLandingPage_orgId_date_url_key";

-- ============================================================
-- 4) CREATE the two partial unique indexes per table.
--
-- Collision safety: the backfill above ONLY ever updates propertyId on a
-- row that already existed under the dropped (orgId, date[, query|url])
-- unique constraint, so before this step there was still at most one row
-- per (orgId, date[, query|url]) total. Backfill never inserts new rows
-- and, for a given org, only ever stamps a single shared propertyId — so
-- after backfill there is still at most one row per (orgId, date[,
-- query|url]) among the newly-stamped rows for that org, and it now lives
-- under the property-scoped key instead of the org-wide key. The
-- org-wide partial (WHERE propertyId IS NULL) and the property-scoped
-- partial (WHERE propertyId IS NOT NULL) therefore cannot collide with
-- each other or with themselves when built over the post-backfill data.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS "SeoSnapshot_org_date_orgwide_key"
  ON "SeoSnapshot" ("orgId", "date") WHERE "propertyId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "SeoSnapshot_org_prop_date_key"
  ON "SeoSnapshot" ("orgId", "propertyId", "date") WHERE "propertyId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SeoQuery_org_date_query_orgwide_key"
  ON "SeoQuery" ("orgId", "date", "query") WHERE "propertyId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "SeoQuery_org_prop_date_query_key"
  ON "SeoQuery" ("orgId", "propertyId", "date", "query") WHERE "propertyId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SeoLandingPage_org_date_url_orgwide_key"
  ON "SeoLandingPage" ("orgId", "date", "url") WHERE "propertyId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "SeoLandingPage_org_prop_date_url_key"
  ON "SeoLandingPage" ("orgId", "propertyId", "date", "url") WHERE "propertyId" IS NOT NULL;
