-- Per-tenant webhook token for AudienceLab's per-pixel webhook UI.
-- That UI does not include our x-audiencelab-secret header on outbound
-- calls, so the URL itself becomes the secret: 32 hex chars (128 bits).
-- Routes at /api/webhooks/cursive/[token] look up the matching tenant
-- and skip header-based auth.
ALTER TABLE "CursiveIntegration"
    ADD COLUMN "webhookToken" TEXT;

CREATE UNIQUE INDEX "CursiveIntegration_webhookToken_key"
    ON "CursiveIntegration"("webhookToken");
