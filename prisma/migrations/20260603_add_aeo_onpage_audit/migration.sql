-- AEO v2 W3 — AeoOnPageAudit
-- Spec: .claude/specs/2026-06-02-aeo-v2-w3.md
--
-- Per-URL AEO-readiness audit gated behind the AEO Boost addon.
-- Score is 8 boolean checks × 12.5 pts each = 0-100.

CREATE TABLE "AeoOnPageAudit" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "propertyId" TEXT,
  "url"        TEXT NOT NULL,
  "score"      INTEGER NOT NULL DEFAULT 0,
  "checks"     JSONB NOT NULL,
  "excerpt"    TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AeoOnPageAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AeoOnPageAudit_orgId_capturedAt_idx"
  ON "AeoOnPageAudit" ("orgId", "capturedAt");

CREATE INDEX "AeoOnPageAudit_orgId_url_capturedAt_idx"
  ON "AeoOnPageAudit" ("orgId", "url", "capturedAt");

ALTER TABLE "AeoOnPageAudit"
  ADD CONSTRAINT "AeoOnPageAudit_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AeoOnPageAudit"
  ADD CONSTRAINT "AeoOnPageAudit_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
