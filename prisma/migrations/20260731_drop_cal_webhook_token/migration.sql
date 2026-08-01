-- Cal.com tour-sync removed 2026-07-31 (Adam: every client books
-- differently). Token was random + per-org, no data value to preserve.
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "calWebhookToken";
