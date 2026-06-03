-- AEO v2 W2 — AeoOpportunityScore + AeoOverviewSnapshot
-- Spec: .claude/specs/2026-06-02-aeo-v2-w2.md
--
-- Two new tables layered on top of the W1 surfaces:
--   - AeoOpportunityScore: composite 0-100 score per (org, keyword)
--     with denormalized inputs for explainability + recompute-safety.
--   - AeoOverviewSnapshot: Google AI Overview text + citation status
--     per (org, query, capturedAt).

CREATE TABLE "AeoOpportunityScore" (
  "id"                      TEXT NOT NULL,
  "orgId"                   TEXT NOT NULL,
  "propertyId"              TEXT,
  "keyword"                 TEXT NOT NULL,
  "gscClicks28d"            INTEGER NOT NULL DEFAULT 0,
  "gscImpressions28d"       INTEGER NOT NULL DEFAULT 0,
  "gscAvgPosition"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "aiSearchVolume"          INTEGER NOT NULL DEFAULT 0,
  "yourMentionCount"        INTEGER NOT NULL DEFAULT 0,
  "competitorMentionCount"  INTEGER NOT NULL DEFAULT 0,
  "onPageSeoScore"          DOUBLE PRECISION,
  "score"                   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "computedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AeoOpportunityScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AeoOpportunityScore_orgId_keyword_key"
  ON "AeoOpportunityScore" ("orgId", "keyword");

CREATE INDEX "AeoOpportunityScore_orgId_score_idx"
  ON "AeoOpportunityScore" ("orgId", "score");

CREATE INDEX "AeoOpportunityScore_orgId_computedAt_idx"
  ON "AeoOpportunityScore" ("orgId", "computedAt");

ALTER TABLE "AeoOpportunityScore"
  ADD CONSTRAINT "AeoOpportunityScore_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AeoOpportunityScore"
  ADD CONSTRAINT "AeoOpportunityScore_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "AeoOverviewSnapshot" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "query"      TEXT NOT NULL,
  "summary"    TEXT NOT NULL,
  "citedUrls"  TEXT[],
  "cited"      BOOLEAN NOT NULL DEFAULT false,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "costUsd"    DOUBLE PRECISION NOT NULL DEFAULT 0,

  CONSTRAINT "AeoOverviewSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AeoOverviewSnapshot_orgId_capturedAt_idx"
  ON "AeoOverviewSnapshot" ("orgId", "capturedAt");

ALTER TABLE "AeoOverviewSnapshot"
  ADD CONSTRAINT "AeoOverviewSnapshot_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
