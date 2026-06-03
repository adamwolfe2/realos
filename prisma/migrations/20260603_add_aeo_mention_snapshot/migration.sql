-- AEO v2 W1 — AeoMentionSnapshot
-- Spec: .claude/specs/2026-06-02-aeo-v2-w1.md
--
-- Adds the per-(engine × prompt) snapshot table written by the AEO
-- orchestrator whenever the DataForSEO LLM Responses adapter surfaces
-- mention metadata. Layered on top of existing AeoCitationCheck rows —
-- not a replacement.

CREATE TABLE "AeoMentionSnapshot" (
  "id"           TEXT NOT NULL,
  "orgId"        TEXT NOT NULL,
  "propertyId"   TEXT,
  "scanRunId"    TEXT,
  "engine"       "AeoEngine" NOT NULL,
  "prompt"       TEXT NOT NULL,
  "capturedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shareOfVoice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mentions"     JSONB NOT NULL,
  "externalId"   TEXT,
  "costUsd"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata"     JSONB,

  CONSTRAINT "AeoMentionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AeoMentionSnapshot_orgId_capturedAt_idx"
  ON "AeoMentionSnapshot" ("orgId", "capturedAt");

CREATE INDEX "AeoMentionSnapshot_propertyId_capturedAt_idx"
  ON "AeoMentionSnapshot" ("propertyId", "capturedAt");

CREATE INDEX "AeoMentionSnapshot_engine_capturedAt_idx"
  ON "AeoMentionSnapshot" ("engine", "capturedAt");

ALTER TABLE "AeoMentionSnapshot"
  ADD CONSTRAINT "AeoMentionSnapshot_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AeoMentionSnapshot"
  ADD CONSTRAINT "AeoMentionSnapshot_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
