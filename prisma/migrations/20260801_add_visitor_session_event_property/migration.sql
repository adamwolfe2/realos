-- Wave 3 Phase 3 + Phase 8 smalls: property dimension on pixel engagement
-- data + pixel provisioning requests.
--
-- Additive + idempotent throughout (ADD COLUMN IF NOT EXISTS / CREATE INDEX
-- IF NOT EXISTS / DO-block FK guards, matching 20260610_add_property_
-- chatbot_config). Safe to re-run and safe on DBs that already have these
-- columns via `prisma db push`.

-- VisitorSession.propertyId — attribution copied at write time from the
-- webhook processor's attributedPropertyId (lib/webhooks/cursive-process.ts),
-- never re-inferred here.
--
-- FKs below are added NOT VALID then validated in a separate statement.
-- These are the highest-volume tables in the system (every pixel webhook
-- write touches them) — a plain ADD CONSTRAINT takes SHARE ROW EXCLUSIVE
-- and runs a full validation scan inside the same transaction
-- `prisma migrate deploy` wraps this file in, which would stall
-- lib/webhooks/cursive-process.ts writes for the scan's duration (and risk
-- a deploy timeout leaving the migration marked failed). NOT VALID skips
-- the scan (SHARE UPDATE EXCLUSIVE only, does not block writes);
-- VALIDATE CONSTRAINT then does the scan under a lock that permits
-- concurrent reads/writes.
ALTER TABLE "VisitorSession" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "VisitorSession_orgId_propertyId_startedAt_idx"
  ON "VisitorSession" ("orgId", "propertyId", "startedAt");

DO $$ BEGIN
  ALTER TABLE "VisitorSession" ADD CONSTRAINT "VisitorSession_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "VisitorSession" VALIDATE CONSTRAINT "VisitorSession_propertyId_fkey";

-- VisitorEvent.propertyId — same attribution, copied from the parent
-- session at write time.
ALTER TABLE "VisitorEvent" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "VisitorEvent_orgId_propertyId_occurredAt_idx"
  ON "VisitorEvent" ("orgId", "propertyId", "occurredAt");

DO $$ BEGIN
  ALTER TABLE "VisitorEvent" ADD CONSTRAINT "VisitorEvent_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "VisitorEvent" VALIDATE CONSTRAINT "VisitorEvent_propertyId_fkey";

-- One-shot backfill: rows written before this column existed inherit the
-- property already resolved onto their Visitor record (same first-write-
-- wins attribution the webhook processor uses for Visitor.propertyId).
-- Guarded to only touch rows that are still unset so re-running is a no-op.
UPDATE "VisitorSession" s
   SET "propertyId" = v."propertyId"
  FROM "Visitor" v
 WHERE s."visitorId" = v.id
   AND s."propertyId" IS NULL
   AND v."propertyId" IS NOT NULL;

UPDATE "VisitorEvent" e
   SET "propertyId" = v."propertyId"
  FROM "Visitor" v
 WHERE e."visitorId" = v.id
   AND e."propertyId" IS NULL
   AND v."propertyId" IS NOT NULL;

-- Wave 3 Phase 8: PixelProvisionRequest.propertyId — which building a
-- queued pixel-provisioning request is for. Null for legacy org-wide
-- requests predating multi-property scoping; no backfill possible (the
-- old request shape never captured a property).
ALTER TABLE "PixelProvisionRequest" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

DO $$ BEGIN
  ALTER TABLE "PixelProvisionRequest" ADD CONSTRAINT "PixelProvisionRequest_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
