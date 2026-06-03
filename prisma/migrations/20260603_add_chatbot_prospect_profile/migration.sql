-- Adds two columns to ChatbotConversation so the chatbot can build + email
-- a rich prospect profile (budget, move-in date, room type, party size,
-- employer, notes — whatever the prospect shared during the conversation)
-- to the agency operator's notifyLeadEmail.
--
-- prospectProfile: JSONB — extracted-by-Claude structured fields. Null
--   until the first extraction lands. Shape owned by
--   lib/chatbot/extract-prospect-profile.ts → ProspectProfile.
-- prospectProfileEmailedAt: timestamp — null until the digest email has
--   been sent at least once. Used by the cron + the handoff route to
--   ensure we don't spam the agency more than once per conversation.

ALTER TABLE "ChatbotConversation"
  ADD COLUMN "prospectProfile" JSONB,
  ADD COLUMN "prospectProfileEmailedAt" TIMESTAMP(3);

-- Cron index: the digest job filters by (lastMessageAt < now-5min) AND
-- prospectProfileEmailedAt IS NULL AND messageCount > 0. The org+status
-- indexes don't cover that — a small partial index keeps the scan tight.
CREATE INDEX "ChatbotConversation_digestQueue_idx"
  ON "ChatbotConversation" ("lastMessageAt")
  WHERE "prospectProfileEmailedAt" IS NULL;
