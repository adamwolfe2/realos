-- Admin-editable per-feature pricing (global config). One row per feature key
-- (+ "base_platform") overrides the code-default price from FEATURE_CATALOG.
-- Additive, idempotent (applied to prod directly; Vercel build doesn't run
-- migrate deploy).
CREATE TABLE IF NOT EXISTS "FeaturePrice" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "monthlyCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeaturePrice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FeaturePrice_key_key" ON "FeaturePrice"("key");
