-- ProspectBrief — hand-curated AI search visibility brief for a single
-- prospect domain, gated by a URL-safe random token at /brief/[token].
--
-- Distinct from ProspectAudit (the multifamily DPS pipeline) because the
-- brief data shape is commercial-vertical: verbatim AI engine quotes,
-- competitor mindshare bar chart, AEO Page Health, schema gap, etc. The
-- JSON shape is owned by lib/brief/collect.ts → BriefData.
--
-- A status lifecycle (QUEUED → RUNNING → READY / FAILED) lets the admin
-- UI poll for the brief while data collection runs. ProspectBrief.data
-- is null until status flips READY.

CREATE TYPE "ProspectBriefStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'READY',
  'FAILED'
);

CREATE TABLE "ProspectBrief" (
  "id"             TEXT NOT NULL,
  "token"          TEXT NOT NULL,
  "domain"         TEXT NOT NULL,
  "brand"          TEXT NOT NULL,
  "vertical"       TEXT,
  "status"         "ProspectBriefStatus" NOT NULL DEFAULT 'QUEUED',
  "data"           JSONB,
  "errorMessage"   TEXT,
  "viewCount"      INTEGER NOT NULL DEFAULT 0,
  "lastViewedAt"   TIMESTAMP(3),
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProspectBrief_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProspectBrief_token_key" ON "ProspectBrief" ("token");

CREATE INDEX "ProspectBrief_domain_createdAt_idx"
  ON "ProspectBrief" ("domain", "createdAt" DESC);

CREATE INDEX "ProspectBrief_status_createdAt_idx"
  ON "ProspectBrief" ("status", "createdAt" DESC);
