-- ============================================================================
-- OAuthConnection — generic encrypted OAuth token store
--
-- Apply with:
--   pnpm prisma migrate deploy           (CI / Vercel build)
-- or, in a local dev session against Neon's direct (non-pooler) endpoint:
--   DIRECT_DATABASE_URL=... pnpm prisma migrate dev
--
-- Backfill: none. The legacy paste-credential paths (AdAccount.credentials
-- Encrypted, SeoIntegration.serviceAccountJsonEncrypted) remain authoritative
-- until each org runs the new OAuth connect flow.
-- ============================================================================

-- CreateTable
CREATE TABLE "OAuthConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConnection_orgId_provider_externalAccountId_key"
    ON "OAuthConnection"("orgId", "provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "OAuthConnection_orgId_idx" ON "OAuthConnection"("orgId");

-- CreateIndex
CREATE INDEX "OAuthConnection_orgId_provider_idx"
    ON "OAuthConnection"("orgId", "provider");

-- AddForeignKey
ALTER TABLE "OAuthConnection"
    ADD CONSTRAINT "OAuthConnection_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
