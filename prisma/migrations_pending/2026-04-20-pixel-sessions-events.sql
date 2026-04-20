-- ============================================================================
-- Migration: First-party pixel — VisitorSession + VisitorEvent + public site key
-- Generated 2026-04-20
--
-- This is a manual migration file. Apply against the production Neon DB with:
--   psql "$DATABASE_URL" -f prisma/migrations_pending/2026-04-20-pixel-sessions-events.sql
-- (Adam to run, not the agent.)
-- ============================================================================

-- 1. Add public site key columns to CursiveIntegration -----------------------
ALTER TABLE "CursiveIntegration"
  ADD COLUMN IF NOT EXISTS "publicSiteKey"    TEXT,
  ADD COLUMN IF NOT EXISTS "publicKeyPrefix"  TEXT,
  ADD COLUMN IF NOT EXISTS "publicKeyIssuedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "CursiveIntegration_publicSiteKey_key"
  ON "CursiveIntegration"("publicSiteKey");

-- 2. VisitorSession ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "VisitorSession" (
  "id"               TEXT PRIMARY KEY,
  "orgId"            TEXT NOT NULL,
  "visitorId"        TEXT,
  "anonymousId"      TEXT NOT NULL,
  "sessionToken"     TEXT NOT NULL,
  "deviceHash"       TEXT,
  "firstUrl"         TEXT,
  "firstReferrer"    TEXT,
  "utmSource"        TEXT,
  "utmMedium"        TEXT,
  "utmCampaign"      TEXT,
  "utmTerm"          TEXT,
  "utmContent"       TEXT,
  "userAgent"        TEXT,
  "ipAddress"        TEXT,
  "country"          TEXT,
  "language"         TEXT,
  "pageviewCount"    INTEGER NOT NULL DEFAULT 0,
  "totalTimeSeconds" INTEGER NOT NULL DEFAULT 0,
  "maxScrollDepth"   INTEGER NOT NULL DEFAULT 0,
  "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastEventAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"          TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisitorSession_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VisitorSession_visitorId_fkey"
    FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisitorSession_sessionToken_key"
  ON "VisitorSession"("sessionToken");
CREATE INDEX IF NOT EXISTS "VisitorSession_orgId_startedAt_idx"
  ON "VisitorSession"("orgId", "startedAt");
CREATE INDEX IF NOT EXISTS "VisitorSession_orgId_anonymousId_idx"
  ON "VisitorSession"("orgId", "anonymousId");
CREATE INDEX IF NOT EXISTS "VisitorSession_visitorId_idx"
  ON "VisitorSession"("visitorId");

-- 3. VisitorEvent ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "VisitorEvent" (
  "id"                TEXT PRIMARY KEY,
  "orgId"             TEXT NOT NULL,
  "sessionId"         TEXT NOT NULL,
  "visitorId"         TEXT,
  "type"              TEXT NOT NULL,
  "url"               TEXT,
  "path"              TEXT,
  "title"             TEXT,
  "referrer"          TEXT,
  "properties"        JSONB,
  "scrollDepth"       INTEGER,
  "timeOnPageSeconds" INTEGER,
  "occurredAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisitorEvent_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VisitorEvent_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "VisitorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VisitorEvent_visitorId_fkey"
    FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VisitorEvent_orgId_occurredAt_idx"
  ON "VisitorEvent"("orgId", "occurredAt");
CREATE INDEX IF NOT EXISTS "VisitorEvent_sessionId_idx"
  ON "VisitorEvent"("sessionId");
CREATE INDEX IF NOT EXISTS "VisitorEvent_visitorId_idx"
  ON "VisitorEvent"("visitorId");
CREATE INDEX IF NOT EXISTS "VisitorEvent_type_idx"
  ON "VisitorEvent"("type");
