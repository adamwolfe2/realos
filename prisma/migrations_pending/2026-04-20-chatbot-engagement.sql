-- ============================================================================
-- Migration: ChatbotEngagement — operator → live visitor outbound message
-- Generated 2026-04-20
--
-- Powers the "Engage" button on /portal/visitors. An operator pushes a
-- contextual message into a live visitor's chatbot widget. The widget polls
-- /api/public/chatbot/inbox every ~3s and renders any PENDING engagements
-- as assistant turns (and optionally auto-opens the panel).
--
-- This is a manual migration file. Apply against the production Neon DB with:
--   psql "$DATABASE_URL" -f prisma/migrations_pending/2026-04-20-chatbot-engagement.sql
-- (Adam to run, not the agent.)
--
-- All statements use IF NOT EXISTS guards so re-running is a no-op.
-- ============================================================================

-- 1. EngagementStatus enum ---------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EngagementStatus') THEN
    CREATE TYPE "EngagementStatus" AS ENUM (
      'PENDING',
      'DELIVERED',
      'DISMISSED',
      'REPLIED'
    );
  END IF;
END $$;

-- 2. ChatbotEngagement table -------------------------------------------------
CREATE TABLE IF NOT EXISTS "ChatbotEngagement" (
  "id"             TEXT PRIMARY KEY,
  "orgId"          TEXT NOT NULL,
  "visitorId"      TEXT,
  "sessionId"      TEXT NOT NULL,
  "triggeredById"  TEXT NOT NULL,
  "message"        TEXT NOT NULL,
  "openWidget"     BOOLEAN NOT NULL DEFAULT TRUE,
  "status"         "EngagementStatus" NOT NULL DEFAULT 'PENDING',
  "deliveredAt"    TIMESTAMP(3),
  "repliedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatbotEngagement_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatbotEngagement_visitorId_fkey"
    FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- triggeredById is a Clerk userId string, intentionally NOT a FK to "User"
-- so the row survives operator-account deletions for audit purposes.

-- 3. Indexes -----------------------------------------------------------------
-- Hot path: widget poll filters on (sessionId, status='PENDING') ordered by createdAt.
CREATE INDEX IF NOT EXISTS "ChatbotEngagement_sessionId_idx"
  ON "ChatbotEngagement"("sessionId");

-- Operator-side queue and audit by org.
CREATE INDEX IF NOT EXISTS "ChatbotEngagement_orgId_status_idx"
  ON "ChatbotEngagement"("orgId", "status");

CREATE INDEX IF NOT EXISTS "ChatbotEngagement_orgId_createdAt_idx"
  ON "ChatbotEngagement"("orgId", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatbotEngagement_visitorId_idx"
  ON "ChatbotEngagement"("visitorId");
