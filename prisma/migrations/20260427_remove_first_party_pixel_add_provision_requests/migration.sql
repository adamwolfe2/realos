-- Drop first-party pixel columns from CursiveIntegration. AudienceLab does
-- not expose a programmatic pixel-creation API, so the only way to provision
-- a real identity-resolution pixel is for ops to set it up in AL's UI. This
-- removes the misleading first-party fallback.
DROP INDEX IF EXISTS "CursiveIntegration_publicSiteKey_key";

ALTER TABLE "CursiveIntegration"
    DROP COLUMN IF EXISTS "publicSiteKey",
    DROP COLUMN IF EXISTS "publicKeyPrefix",
    DROP COLUMN IF EXISTS "publicKeyIssuedAt";

-- New: queued requests for AudienceLab pixel provisioning. Customer submits
-- the form on /portal/settings/integrations -> we create a row -> ops sets
-- up the pixel in AL -> ops pastes pixel_id into the admin Cursive panel ->
-- the matching row flips to FULFILLED and the customer is emailed their
-- install snippet.
CREATE TYPE "PixelRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

CREATE TABLE "PixelProvisionRequest" (
    "id"                TEXT NOT NULL,
    "orgId"             TEXT NOT NULL,
    "websiteName"       TEXT NOT NULL,
    "websiteUrl"        TEXT NOT NULL,
    "status"            "PixelRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT,
    "requestedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt"       TIMESTAMP(3),
    "fulfilledPixelId"  TEXT,
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixelProvisionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PixelProvisionRequest_orgId_status_idx"
    ON "PixelProvisionRequest"("orgId", "status");

CREATE INDEX "PixelProvisionRequest_status_requestedAt_idx"
    ON "PixelProvisionRequest"("status", "requestedAt");

ALTER TABLE "PixelProvisionRequest"
    ADD CONSTRAINT "PixelProvisionRequest_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
