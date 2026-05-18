-- Credentials Vault — Phase 1
-- Adds:
--   * Organization: moduleVault, vaultDekWrapped, vaultDekNonce, vaultEnabledAt
--   * CredentialEntry  (encrypted secret + clear-text metadata)
--   * CredentialAccessLog  (audit trail for every reveal)
--
-- See docs/PRD-CREDENTIALS-VAULT.md for the full design and threat
-- model. Encryption is envelope-style: master KEK in env wraps a
-- per-org DEK which encrypts each credential's secret with AES-256-GCM.

ALTER TABLE "Organization"
  ADD COLUMN "moduleVault"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vaultDekWrapped" BYTEA,
  ADD COLUMN "vaultDekNonce"   BYTEA,
  ADD COLUMN "vaultEnabledAt"  TIMESTAMP(3);

CREATE TABLE "CredentialEntry" (
    "id"               TEXT NOT NULL,
    "orgId"            TEXT NOT NULL,
    "propertyId"       TEXT,
    "name"             TEXT NOT NULL,
    "platform"         TEXT,
    "websiteUrl"       TEXT,
    "username"         TEXT,
    "notes"            TEXT,
    "tags"             TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secretCiphertext" TEXT NOT NULL,
    "secretIv"         TEXT NOT NULL,
    "secretAuthTag"    TEXT NOT NULL,
    "createdById"      TEXT,
    "lastRevealedAt"   TIMESTAMP(3),
    "lastRotatedAt"    TIMESTAMP(3),
    "expiresAt"        TIMESTAMP(3),
    "deletedAt"        TIMESTAMP(3),
    "deletedById"      TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CredentialEntry_orgId_propertyId_idx" ON "CredentialEntry" ("orgId", "propertyId");
CREATE INDEX "CredentialEntry_orgId_platform_idx"   ON "CredentialEntry" ("orgId", "platform");
CREATE INDEX "CredentialEntry_orgId_deletedAt_idx"  ON "CredentialEntry" ("orgId", "deletedAt");

ALTER TABLE "CredentialEntry"
  ADD CONSTRAINT "CredentialEntry_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CredentialEntry_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CredentialAccessLog" (
    "id"               TEXT NOT NULL,
    "credentialId"     TEXT NOT NULL,
    "orgId"            TEXT NOT NULL,
    "userId"           TEXT,
    "userEmail"        TEXT NOT NULL,
    "asImpersonatorId" TEXT,
    "action"           TEXT NOT NULL,
    "ipAddress"        TEXT,
    "userAgent"        TEXT,
    "occurredAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CredentialAccessLog_credentialId_occurredAt_idx"
  ON "CredentialAccessLog" ("credentialId", "occurredAt" DESC);
CREATE INDEX "CredentialAccessLog_orgId_occurredAt_idx"
  ON "CredentialAccessLog" ("orgId", "occurredAt" DESC);

ALTER TABLE "CredentialAccessLog"
  ADD CONSTRAINT "CredentialAccessLog_credentialId_fkey"
    FOREIGN KEY ("credentialId") REFERENCES "CredentialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CredentialAccessLog_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
