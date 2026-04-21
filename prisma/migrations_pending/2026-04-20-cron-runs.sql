-- ============================================================================
-- Migration: CronRun — track every cron handler invocation
-- Generated 2026-04-20
--
-- Apply against the production Neon DB with:
--   psql "$DATABASE_URL" -f prisma/migrations_pending/2026-04-20-cron-runs.sql
-- (Adam to run, not the agent.)
--
-- The /admin/system dashboard reads the most recent row per jobName to show
-- "did this fire in the last 24h?". The lib/health/cron-run.ts wrapper writes
-- one row per invocation (start + finish/error/timeout). All cron handlers
-- now wrap their work in recordCronRun() so any cron running in production
-- will populate this table on its next firing without any data backfill.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "CronRun" (
  "id"               TEXT PRIMARY KEY,
  "jobName"          TEXT NOT NULL,
  "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"       TIMESTAMP(3),
  "status"           TEXT NOT NULL DEFAULT 'running',
  "error"            TEXT,
  "durationMs"       INTEGER,
  "recordsProcessed" INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CronRun_jobName_startedAt_idx"
  ON "CronRun"("jobName", "startedAt" DESC);

CREATE INDEX IF NOT EXISTS "CronRun_startedAt_idx"
  ON "CronRun"("startedAt" DESC);

CREATE INDEX IF NOT EXISTS "CronRun_status_idx"
  ON "CronRun"("status");
