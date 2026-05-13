-- Property image-scrape support fields (May 2026).
--
-- Adds per-property `websiteUrl`, `logoUrl`, plus telemetry for the
-- scrape job (`imageScrapeAt`, `imageScrapeError`). The scrape pipeline
-- pulls og:image / og:logo / favicon from a property's public marketing
-- site so heroImageUrl + logoUrl populate automatically — operators don't
-- need to upload anything for a polished avatar to appear.
--
-- All new columns are nullable so the migration is non-breaking: existing
-- rows just have NULL websiteUrl/logoUrl until the scrape job (or an
-- operator) fills them in.

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "imageScrapeAt" TIMESTAMP(3);
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "imageScrapeError" TEXT;

-- Index supporting the nightly scrape cron query:
--   WHERE websiteUrl IS NOT NULL
--     AND (imageScrapeAt IS NULL OR imageScrapeAt < now() - interval '30 days')
--   ORDER BY imageScrapeAt ASC NULLS FIRST
--   LIMIT 200
-- Partial index keeps it tiny — only rows with a websiteUrl are
-- candidates, so this never grows past the marketable property count.
CREATE INDEX IF NOT EXISTS "Property_imageScrapeAt_websiteUrl_idx"
  ON "Property" ("imageScrapeAt" ASC NULLS FIRST)
  WHERE "websiteUrl" IS NOT NULL;
