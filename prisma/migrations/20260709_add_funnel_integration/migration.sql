-- Funnel Leasing outbound lead-push integration.
--
-- Additive only: a new per-org table mirroring AppFolioIntegration's shape.
-- No existing table is touched, no data is backfilled, and the feature ships
-- fully-built-but-disconnected (enabled defaults to false, credentials NULL)
-- until an operator connects their Funnel account. Zero downtime.
CREATE TABLE IF NOT EXISTS "FunnelIntegration" (
  "id"                TEXT NOT NULL,
  "orgId"             TEXT NOT NULL,
  "apiKeyEncrypted"   TEXT,
  "apiBaseUrl"        TEXT,
  "groupId"           INTEGER,
  "discoverySourceId" TEXT,
  "enabled"           BOOLEAN NOT NULL DEFAULT false,
  "lastPushAt"        TIMESTAMP(3),
  "lastError"         TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FunnelIntegration_pkey" PRIMARY KEY ("id")
);

-- One integration row per org (1:1, like AppFolioIntegration).
CREATE UNIQUE INDEX IF NOT EXISTS "FunnelIntegration_orgId_key"
  ON "FunnelIntegration" ("orgId");

-- Cascade-delete with the owning Organization.
ALTER TABLE "FunnelIntegration"
  ADD CONSTRAINT "FunnelIntegration_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
