-- Per-property scoping for SeoIntegration (GA4 + GSC) and CursiveIntegration
-- (visitor pixel). Removes the org-level uniqueness that capped tenants at
-- one GA4 / one GSC / one pixel per organization, replacing it with a
-- composite unique that includes propertyId.
--
-- Compatibility model:
--   * Existing rows get propertyId = NULL on rollout.
--   * NULL is interpreted as "applies to the whole org" (legacy behavior).
--   * New connections specify a propertyId so multi-property tenants
--     (e.g. SG Real Estate's 71 properties) can wire each domain's
--     GA4 + GSC + pixel independently.
--   * Postgres treats NULL as distinct in unique indexes, so the
--     legacy (orgId, NULL, provider) row coexists with per-property rows.
--
-- Telegraph Commons safety: the existing SeoIntegration + CursiveIntegration
-- rows for any current customer survive untouched (their propertyId
-- column stays NULL after this migration). The unique-constraint reshape
-- is the only schema change; the data is preserved as-is.

-- ── CursiveIntegration ──────────────────────────────────────────────────────

ALTER TABLE "CursiveIntegration"
  ADD COLUMN "propertyId" TEXT;

ALTER TABLE "CursiveIntegration"
  ADD CONSTRAINT "CursiveIntegration_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the existing org-level uniqueness (one pixel per org).
ALTER TABLE "CursiveIntegration"
  DROP CONSTRAINT IF EXISTS "CursiveIntegration_orgId_key";

DROP INDEX IF EXISTS "CursiveIntegration_orgId_key";

-- New composite uniqueness: at most one row per (org, property).
-- Legacy rows are (orgId, NULL) and Postgres treats NULL as distinct so
-- multiple legacy rows would NOT collide — but we never create more than
-- one of those by design.
CREATE UNIQUE INDEX "CursiveIntegration_orgId_propertyId_key"
  ON "CursiveIntegration" ("orgId", "propertyId");

CREATE INDEX "CursiveIntegration_orgId_idx"
  ON "CursiveIntegration" ("orgId");

CREATE INDEX "CursiveIntegration_propertyId_idx"
  ON "CursiveIntegration" ("propertyId");

-- ── SeoIntegration ──────────────────────────────────────────────────────────

ALTER TABLE "SeoIntegration"
  ADD COLUMN "propertyId" TEXT;

ALTER TABLE "SeoIntegration"
  ADD CONSTRAINT "SeoIntegration_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the existing (orgId, provider) uniqueness (one GA4 + one GSC per org).
ALTER TABLE "SeoIntegration"
  DROP CONSTRAINT IF EXISTS "SeoIntegration_orgId_provider_key";

DROP INDEX IF EXISTS "SeoIntegration_orgId_provider_key";

-- New composite uniqueness: one row per (org, property, provider).
CREATE UNIQUE INDEX "SeoIntegration_orgId_propertyId_provider_key"
  ON "SeoIntegration" ("orgId", "propertyId", "provider");

CREATE INDEX "SeoIntegration_propertyId_idx"
  ON "SeoIntegration" ("propertyId");
