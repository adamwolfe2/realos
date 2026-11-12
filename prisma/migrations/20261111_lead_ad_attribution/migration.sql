-- Applied to production by mistake on 2026-11-12 (a scratch-branch test ran
-- against DIRECT_DATABASE_URL). Superseded by Lead.trafficSource (PR #240)
-- and removed again by 20261112_drop_lead_ad_attribution. Kept so the
-- migration history matches the database.
ALTER TABLE "Lead" ADD COLUMN "adPlatform" "AdPlatform";
ALTER TABLE "Lead" ADD COLUMN "adCampaign" TEXT;
CREATE INDEX "Lead_orgId_adPlatform_idx" ON "Lead"("orgId", "adPlatform");
