-- Add operator-editable second chatbot message. Previously a hardcoded
-- template literal inside public/embed/chatbot.js (line 210-214) that
-- said "We just had rooms come available at {brandName} starting at
-- $X/mo. What can I help you with?" — operators had zero way to edit
-- or suppress it. Now it lives on TenantSiteConfig with full
-- placeholder support: {property_name}, {starting_rent},
-- {open_count}, {next_available}.
--
-- NULL/empty = suppress the second message entirely so the operator
-- can ship a single-greeting bot without conflicting copy. The
-- existing hardcoded fallback in chatbot.js stays as a final
-- belt-and-suspenders default for orgs that haven't migrated yet,
-- and we backfill it explicitly for existing rows so behavior is
-- unchanged on day one.

ALTER TABLE "TenantSiteConfig"
  ADD COLUMN "chatbotFollowUpMessage" TEXT;

-- Backfill existing rows with the previous hardcoded copy so widgets
-- already in production keep emitting the same second message until
-- the operator edits it. Empty string would suppress; we want to
-- preserve current behavior, so we seed the historical text.
UPDATE "TenantSiteConfig"
SET "chatbotFollowUpMessage" =
  'We just had rooms come available at {property_name} starting at ${starting_rent}/mo. What can I help you with?'
WHERE "chatbotEnabled" = true
  AND "chatbotFollowUpMessage" IS NULL;
