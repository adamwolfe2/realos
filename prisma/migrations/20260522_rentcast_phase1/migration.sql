-- RentCast Phase 1 — Property Detail Market Intelligence
--
-- Two new tables wire RentCast (https://developers.rentcast.io) into the
-- portal as a cached, per-org budgeted source of market intelligence for
-- the property detail page. The integration is paywall-aware:
--
--   * RentCastSnapshot — per-property cache of raw API payloads, keyed by
--     a normalized cache key so repeated requests for the same address /
--     zip collapse to a single fetch. TTLs vary by endpoint and are
--     enforced by the cache helper, not the DB.
--
--   * OrgRentCastUsage — per-org monthly budget counter. Defaults to the
--     RentCast free-tier quota (50/mo). When `requestsThisMonth >=
--     monthlyBudget * hardCapMultiplier` the cache layer refuses new
--     fetches and falls through to upsell copy. Resets monthly via
--     `monthKey` rollover (YYYY-MM) the next time the org is touched.
--
-- Both tables are additive only — no alterations to existing rows or
-- columns, so the migration is safe to deploy alongside in-flight schema
-- changes. ON DELETE CASCADE on Organization / Property keeps tenancy
-- and per-property cleanup automatic.

CREATE TABLE "RentCastSnapshot" (
  "id"            TEXT      NOT NULL,
  "orgId"         TEXT      NOT NULL,
  "propertyId"    TEXT,
  "endpoint"      TEXT      NOT NULL,
  "cacheKey"      TEXT      NOT NULL,
  "payload"       JSONB     NOT NULL,
  "fetchedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "requestCost"   INTEGER   NOT NULL DEFAULT 1,

  CONSTRAINT "RentCastSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RentCastSnapshot_orgId_cacheKey_key"
  ON "RentCastSnapshot"("orgId", "cacheKey");

CREATE INDEX "RentCastSnapshot_orgId_endpoint_fetchedAt_idx"
  ON "RentCastSnapshot"("orgId", "endpoint", "fetchedAt");

CREATE INDEX "RentCastSnapshot_propertyId_idx"
  ON "RentCastSnapshot"("propertyId");

ALTER TABLE "RentCastSnapshot"
  ADD CONSTRAINT "RentCastSnapshot_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RentCastSnapshot"
  ADD CONSTRAINT "RentCastSnapshot_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "OrgRentCastUsage" (
  "id"                   TEXT          NOT NULL,
  "orgId"                TEXT          NOT NULL,
  "monthKey"             TEXT          NOT NULL,
  "requestsThisMonth"    INTEGER       NOT NULL DEFAULT 0,
  "monthlyBudget"        INTEGER       NOT NULL DEFAULT 50,
  "hardCapMultiplier"    DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  "lastResetAt"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "OrgRentCastUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgRentCastUsage_orgId_key"
  ON "OrgRentCastUsage"("orgId");

ALTER TABLE "OrgRentCastUsage"
  ADD CONSTRAINT "OrgRentCastUsage_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
