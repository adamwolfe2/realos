-- Proof-of-life for managed publishing: live URL a shipped ContentDraft was
-- published at. Shown to the tenant next to the SHIPPED status.
-- Additive and idempotent.
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "publishedUrl" TEXT;
