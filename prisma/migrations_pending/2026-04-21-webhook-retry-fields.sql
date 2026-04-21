-- ============================================================================
-- Migration: WebhookEvent retry tracking
-- 2026-04-21
--
-- Inbound webhook handlers (Cursive primarily) dedup on body hash before
-- processing. If processing fails after the dedup row exists, the event is
-- effectively dropped — the next retry from AudienceLab gets rejected as a
-- duplicate. These columns let us recover by tracking processing state and
-- letting the webhook-retry cron re-run failed events.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE "WebhookEvent"
  ADD COLUMN IF NOT EXISTS "status"           TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS "attempts"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingError"  TEXT,
  ADD COLUMN IF NOT EXISTS "rawBody"          TEXT,
  ADD COLUMN IF NOT EXISTS "nextRetryAt"      TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WebhookEvent_status_nextRetryAt_idx"
  ON "WebhookEvent"("status", "nextRetryAt");
