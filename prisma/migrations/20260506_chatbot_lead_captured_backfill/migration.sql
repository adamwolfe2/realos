-- Backfill ChatbotConversation.status for rows that have a leadId but are
-- still flagged ACTIVE. The PRE_CHAT capture path used to insert
-- conversations with status=ACTIVE even though a Lead was already bound,
-- which made the report's "capture rate" KPI under-count by exactly the
-- pre-chat captures. The route handler is fixed going forward; this
-- corrects the historical rows in one pass.

UPDATE "ChatbotConversation"
SET "status" = 'LEAD_CAPTURED'
WHERE "leadId" IS NOT NULL
  AND "status" = 'ACTIVE';
