-- Idempotent backfill for AppFolioIntegration columns that were added to
-- prisma/schema.prisma but never had migration files generated. Production
-- DBs that were originally provisioned via `prisma db push` (before
-- migrations were tracked in git) are missing these columns entirely,
-- which causes every prisma.appFolioIntegration.findUnique({ select: {...} })
-- call selecting them to throw — the .catch(() => null) swallows the error
-- and the AppFolio status helper returns "not_connected" forever.
--
-- This migration is safe to apply on top of any prior state — every ALTER
-- uses IF NOT EXISTS so it no-ops on DBs where the column already exists
-- (e.g. local dev, where `prisma db push` keeps the schema in sync).

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "syncStartedAt" TIMESTAMP(3);

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "syncStatus" TEXT;

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "lastError" TEXT;

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "clientIdEncrypted" TEXT;

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "clientSecretEncrypted" TEXT;

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "oauthTokenEncrypted" TEXT;

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "oauthRefreshEncrypted" TEXT;

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "oauthExpiresAt" TIMESTAMP(3);

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "plan" TEXT;

ALTER TABLE "AppFolioIntegration"
  ADD COLUMN IF NOT EXISTS "embedScriptConfig" JSONB;

-- Recovery: any row stuck in syncStatus='syncing' with a stale
-- syncStartedAt (or none at all) should be reset so the next sync attempt
-- — manual or cron — actually runs instead of being stonewalled by the
-- in-progress concurrency guard. The guard considers anything older than
-- 10 min as "stuck and steamrollable", so this UPDATE is just belt-and-
-- suspenders for the rows that may have been wedged before the column
-- existed at all.
UPDATE "AppFolioIntegration"
   SET "syncStatus" = 'error',
       "syncStartedAt" = NULL,
       "lastError" = COALESCE(
         "lastError",
         'Sync state was reset by 20260504_appfolio_sync_columns migration. Click Retry to re-run.'
       )
 WHERE "syncStatus" = 'syncing';
