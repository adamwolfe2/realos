-- Adds ChatbotConversation.funnelPushedAt so the funnel-lead-sync cron can push
-- a chatbot lead to the org's Funnel Leasing CRM exactly once, AFTER the
-- conversation has gone idle (so Funnel's `notes` gets the FULL transcript, not
-- the empty/partial snapshot that existed at capture time).
--
-- Funnel's POST /api/v2/clients creates a NEW Prospect on every call (no upsert
-- / idempotency key), so a duplicate push would duplicate the client's CRM
-- record. funnelPushedAt is stamped BEFORE the push fires → at-most-once. A push
-- failure is surfaced via FunnelIntegration.lastError, not retried.
--
-- Additive only: one nullable column + one partial index. No existing data is
-- touched or backfilled. Zero downtime.

ALTER TABLE "ChatbotConversation"
  ADD COLUMN "funnelPushedAt" TIMESTAMP(3);

-- Cron index: the sync job filters by (lastMessageAt < now-5min) AND
-- funnelPushedAt IS NULL AND leadId IS NOT NULL. A partial index keyed on the
-- "not yet pushed" predicate keeps the scan tight, mirroring the digest queue
-- index. Prisma declares the plain column set; the WHERE predicate lives here.
CREATE INDEX "ChatbotConversation_funnelQueue_idx"
  ON "ChatbotConversation" ("lastMessageAt")
  WHERE "funnelPushedAt" IS NULL AND "leadId" IS NOT NULL;
