-- P0-2: Replace the Cal.com webhook's "orgId in the URL is the secret" model
-- with a per-org unguessable token (mirrors CursiveIntegration.webhookToken).
-- The old orgId was publicly leaked by the chatbot config endpoint, allowing
-- cross-tenant booking injection. This column is the new path secret.
--
-- Additive + nullable + no default = zero downtime. Postgres allows multiple
-- NULLs under a UNIQUE index, so existing orgs stay NULL until a token is
-- minted lazily on first Integrations view. No backfill required (the Cal
-- webhook had zero live usage in production at migration time).
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "calWebhookToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_calWebhookToken_key"
  ON "Organization" ("calWebhookToken");
