-- Per-feature Stripe linkage on FeaturePrice. Additive, idempotent.
ALTER TABLE "FeaturePrice" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "FeaturePrice" ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT;
ALTER TABLE "FeaturePrice" ADD COLUMN IF NOT EXISTS "stripeSyncedAt" TIMESTAMP(3);
