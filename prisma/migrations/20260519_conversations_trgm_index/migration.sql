-- Trigram GIN index on ChatbotConversation.messages so the operator
-- transcript search at /portal/conversations can use an index instead
-- of full-scanning the table on every keystroke.
--
-- The search query (app/portal/conversations/page.tsx) is:
--   SELECT id FROM "ChatbotConversation"
--   WHERE "orgId" = $1
--     AND "messages"::text ILIKE $2  -- '%query%'
-- which, without trigram support, sequential-scans every conversation
-- row for the org and cast-coerces the JSONB to text inline. With a
-- pg_trgm GIN index on (messages::text gin_trgm_ops) the planner can
-- satisfy the ILIKE '%q%' (leading wildcard) from the index, so search
-- stays fast as conversation volume grows past a few thousand rows.
--
-- Wrapped in a DO block (same pattern as 20260513_properties_pagination_indexes)
-- so the migration succeeds even if the deploy account can't create the
-- extension — search still works, just without trigram acceleration.

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm extension creation skipped (insufficient privilege). Conversation search will work but without the trigram acceleration.';
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    -- Indexes the JSON column cast to text — matches exactly what the
    -- query in app/portal/conversations/page.tsx does in its WHERE
    -- clause, so the planner can pick it up.
    CREATE INDEX IF NOT EXISTS "ChatbotConversation_messages_trgm_idx"
      ON "ChatbotConversation" USING gin (("messages"::text) gin_trgm_ops);
  END IF;
END;
$$;
