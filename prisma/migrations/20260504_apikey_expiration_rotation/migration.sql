-- API key expiration + rotation support. Audit BUG #5 — operators
-- expected an expiration policy and a rotate-in-place action when
-- generating keys for security/convenience. rotatedFromKeyId is a
-- forward-only soft pointer (no FK constraint) so deleting a
-- predecessor key doesn't cascade through the rotation chain.
ALTER TABLE "ApiKey"
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "rotatedFromKeyId" TEXT;

CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");
