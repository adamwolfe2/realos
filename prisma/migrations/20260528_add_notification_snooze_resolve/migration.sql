-- ============================================================================
-- Notification snooze + resolve — adds operator workflow state to the inbox.
--
-- snoozedUntil: hides the row from the default view + unread count until the
-- given timestamp. Surfaces back in the bell / inbox automatically when the
-- timer expires. Null = visible.
--
-- resolvedAt: explicit "dealt with" marker for action-required rows
-- (integration_error, ai_quota_warning). Distinct from readAt: an operator
-- can read a row without resolving it. Null = not yet resolved.
--
-- Both columns are nullable so existing rows are unaffected. Idempotent.
-- ============================================================================

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt"   TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Notification_orgId_resolvedAt_idx"
  ON "Notification"("orgId", "resolvedAt");

CREATE INDEX IF NOT EXISTS "Notification_orgId_snoozedUntil_idx"
  ON "Notification"("orgId", "snoozedUntil");
