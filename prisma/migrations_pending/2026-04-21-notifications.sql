-- ============================================================================
-- 2026-04-21-notifications.sql
-- Idempotent. Run with: psql $DATABASE_URL -f this-file.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Notification" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "orgId"      TEXT        NOT NULL,
  "userId"     TEXT,
  "kind"       TEXT        NOT NULL, -- lead_created | tour_scheduled | chatbot_lead | integration_error | sync_complete
  "title"      TEXT        NOT NULL,
  "body"       TEXT,
  "entityType" TEXT,
  "entityId"   TEXT,
  "href"       TEXT,
  "readAt"     TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId")  REFERENCES "User"("id")         ON DELETE SET NULL
);

-- Indexes (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "Notification_orgId_readAt_idx"
  ON "Notification" ("orgId", "readAt");

CREATE INDEX IF NOT EXISTS "Notification_orgId_createdAt_idx"
  ON "Notification" ("orgId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Notification_orgId_kind_idx"
  ON "Notification" ("orgId", "kind");
