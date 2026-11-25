-- SG cockpit slice 4 (self-improve loop). Additive only: one nullable JSON
-- column on each existing suggestion table and three new enum values. No
-- existing row is rewritten; the running app ignores all of it until the
-- new code reads it.

ALTER TABLE "ChatbotKnowledgeSuggestion" ADD COLUMN IF NOT EXISTS "proposal" JSONB;
ALTER TABLE "SiteImprovementRecommendation" ADD COLUMN IF NOT EXISTS "proposal" JSONB;

ALTER TYPE "SiteImprovementType" ADD VALUE IF NOT EXISTS 'SEO_COPY';
ALTER TYPE "SiteImprovementType" ADD VALUE IF NOT EXISTS 'POPUP_COPY';
ALTER TYPE "SiteImprovementTarget" ADD VALUE IF NOT EXISTS 'POPUP';
