-- Removes the unused columns added by 20261111_lead_ad_attribution. Ad credit
-- reads Lead.source / Lead.trafficSource instead. Nothing ever wrote these
-- columns (verified empty before merge).
DROP INDEX IF EXISTS "Lead_orgId_adPlatform_idx";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "adCampaign";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "adPlatform";
