-- Property launch status. Separate from `lifecycle` (which is the
-- AppFolio-curation decision) — launchStatus tracks whether the
-- property is actually wired up to live data sources (site, GA4, GSC,
-- pixel, ads). Lets dashboards distinguish "approved building" from
-- "building with active marketing data flowing."
--
-- Lifecycle answers: should this row count at all?
-- Launch status answers: is this row LIVE / mid-onboarding / not started?
--
-- Default for new/existing rows: ONBOARDING. We want operators to walk
-- through the onboarding checklist explicitly per property. Telegraph
-- Commons (the pilot) gets backfilled to LIVE because it has real
-- pixel + integration data; the rest of SG Real Estate's 121 ACTIVE
-- properties go to ONBOARDING and the operator promotes them as each
-- property gets its site / pixel / GA4 / GSC / ads connected.

CREATE TYPE "PropertyLaunchStatus" AS ENUM (
  'DRAFT',      -- Approved (lifecycle=ACTIVE) but no integrations connected
  'ONBOARDING', -- Some integrations connected, others pending
  'LIVE',       -- Site + pixel + (GA4 OR GSC) all connected & firing
  'PAUSED'      -- Operator explicitly paused; keep row, suspend reporting
);

CREATE TYPE "PropertyLaunchStatusSource" AS ENUM (
  'AUTO',     -- Set by computeLaunchStatus background recompute
  'OPERATOR'  -- Set by an operator explicitly via the onboarding page
);

ALTER TABLE "Property"
  ADD COLUMN "launchStatus" "PropertyLaunchStatus" NOT NULL DEFAULT 'ONBOARDING',
  ADD COLUMN "launchStatusSetBy" "PropertyLaunchStatusSource" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "launchStatusSetAt" TIMESTAMP(3),
  ADD COLUMN "launchedAt" TIMESTAMP(3);

-- Backfill: any property that already has a CursiveIntegration with
-- a recent event (last 14 days) is auto-promoted to LIVE. This catches
-- Telegraph Commons without forcing the operator to re-flag it.
UPDATE "Property" p
SET
  "launchStatus" = 'LIVE',
  "launchStatusSetBy" = 'AUTO',
  "launchStatusSetAt" = NOW(),
  "launchedAt" = NOW()
WHERE EXISTS (
  SELECT 1 FROM "CursiveIntegration" ci
  WHERE ci."propertyId" = p."id"
    AND ci."cursivePixelId" IS NOT NULL
    AND ci."lastEventAt" IS NOT NULL
    AND ci."lastEventAt" > NOW() - INTERVAL '14 days'
);

-- Stamp launchStatusSetAt for every other row so the audit field isn't
-- blank.
UPDATE "Property"
SET "launchStatusSetAt" = COALESCE("launchStatusSetAt", "createdAt")
WHERE "launchStatusSetAt" IS NULL;

-- Index for the most common query: "live + onboarding properties for
-- this org" (used by dashboards once Phase 4 ships).
CREATE INDEX "Property_orgId_launchStatus_idx"
  ON "Property"("orgId", "launchStatus");
