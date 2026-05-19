-- AEO (AI Engine Optimization) citation tracking.
--
-- Periodically queries ChatGPT / Perplexity / Claude / Gemini with realistic
-- renter prompts and records whether each tenant's property is cited. Powers
-- the AI-search visibility panel on /portal/seo/aeo.
--
-- Touched by:
--   * lib/aeo/orchestrate.ts        (scan fan-out across engines × prompts)
--   * lib/aeo/engines/*.ts          (per-engine clients)
--   * lib/aeo/parse.ts              (cited / not-cited / competitor parser)
--   * app/api/cron/aeo-scan         (weekly cron, Mondays 02:00 UTC)
--   * app/api/portal/seo/aeo/scan   (on-demand "Scan now")
--   * app/portal/seo/aeo            (dashboard panel)

CREATE TYPE "AeoEngine" AS ENUM ('CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI');

CREATE TYPE "AeoCitationStatus" AS ENUM ('CITED', 'NOT_CITED', 'COMPETITOR_CITED');

CREATE TABLE "AeoCitationCheck" (
    "id"                TEXT             NOT NULL,
    "orgId"             TEXT             NOT NULL,
    "propertyId"        TEXT,
    "engine"            "AeoEngine"      NOT NULL,
    "prompt"            TEXT             NOT NULL,
    "queryRunAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"            "AeoCitationStatus" NOT NULL,
    "responseText"      TEXT             NOT NULL,
    "citedUrl"          TEXT,
    "competitorsCited"  TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
    "metadata"          JSONB,

    CONSTRAINT "AeoCitationCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AeoCitationCheck_orgId_queryRunAt_idx"
  ON "AeoCitationCheck"("orgId", "queryRunAt");

CREATE INDEX "AeoCitationCheck_propertyId_queryRunAt_idx"
  ON "AeoCitationCheck"("propertyId", "queryRunAt");

CREATE INDEX "AeoCitationCheck_engine_queryRunAt_idx"
  ON "AeoCitationCheck"("engine", "queryRunAt");

ALTER TABLE "AeoCitationCheck"
  ADD CONSTRAINT "AeoCitationCheck_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AeoCitationCheck"
  ADD CONSTRAINT "AeoCitationCheck_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
