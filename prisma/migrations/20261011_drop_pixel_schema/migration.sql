-- S4 of plans/remove-pixel: drop the retired visitor pixel + Audience Sync
-- schema. Code stopped reading all of this in PR #173.
-- Destructive. Backup: Neon branch backup/pre-pixel-drop-2026-10-11.
-- One transaction: any unexpected row (e.g. an AL_PARTNER user) makes an enum
-- cast fail and the whole migration rolls back.
-- Hand-written: a raw `migrate diff` also drops the hand-made partial unique
-- indexes on SeoSnapshot/SeoQuery/SeoLandingPage. Those are left alone.

BEGIN;

-- 1. Data: move rows off the enum values being dropped.
UPDATE "Organization" SET "productLine" = 'STUDENT_HOUSING' WHERE "productLine" = 'AUDIENCE_SYNC';
UPDATE "Lead"
  SET "source" = 'OTHER', "sourceDetail" = COALESCE("sourceDetail", 'Pixel outreach (retired)')
  WHERE "source" = 'PIXEL_OUTREACH';
DELETE FROM "OnboardingStepProgress" WHERE "stepKey" = 'INSTALL_PIXEL';
DELETE FROM "LeadNotificationDelivery" WHERE "channel" IN ('PIXEL', 'VISITOR_CONVERT');
DELETE FROM "Insight" WHERE "kind" = 'hot_visitor';
-- Deactivate, not delete: addon-cursive-pixel-pro is referenced by sent proposals.
UPDATE "ProposalCatalogItem" SET "active" = false
  WHERE "slug" IN ('addon-audience-sync', 'addon-cursive-pixel-pro', 'addon-pixel-overage');

-- 2. Enums: drop retired values.
CREATE TYPE "LeadNotifyChannel_new" AS ENUM ('CHATBOT', 'POPUP', 'FORM', 'INGEST', 'TOUR', 'MANUAL');
ALTER TABLE "LeadNotificationDelivery" ALTER COLUMN "channel" TYPE "LeadNotifyChannel_new" USING ("channel"::text::"LeadNotifyChannel_new");
ALTER TYPE "LeadNotifyChannel" RENAME TO "LeadNotifyChannel_old";
ALTER TYPE "LeadNotifyChannel_new" RENAME TO "LeadNotifyChannel";
DROP TYPE "LeadNotifyChannel_old";

CREATE TYPE "LeadSource_new" AS ENUM ('CHATBOT', 'FORM', 'REFERRAL', 'GOOGLE_ADS', 'META_ADS', 'ORGANIC', 'DIRECT', 'EMAIL_CAMPAIGN', 'COLD_EMAIL', 'MANUAL', 'OTHER');
ALTER TABLE "Lead" ALTER COLUMN "source" TYPE "LeadSource_new" USING ("source"::text::"LeadSource_new");
ALTER TYPE "LeadSource" RENAME TO "LeadSource_old";
ALTER TYPE "LeadSource_new" RENAME TO "LeadSource";
DROP TYPE "LeadSource_old";

CREATE TYPE "OnboardingStepKey_new" AS ENUM ('ADD_PROPERTY', 'CONNECT_DATA_SOURCE', 'CONFIRM_CONTACT_PREFS', 'APPROVE_CHATBOT_PERSONA', 'VERIFY_LEAD_CAPTURE', 'CONNECT_ADS', 'REVIEW_FIRST_REPORT', 'SET_REPUTATION_QUERIES', 'CUSTOM_DOMAIN', 'WHITE_LABEL', 'GENERATE_NEIGHBORHOOD_PAGE', 'CUSTOM_REPORT_PREFS', 'INVITE_TEAMMATE');
ALTER TABLE "OnboardingStepProgress" ALTER COLUMN "stepKey" TYPE "OnboardingStepKey_new" USING ("stepKey"::text::"OnboardingStepKey_new");
ALTER TYPE "OnboardingStepKey" RENAME TO "OnboardingStepKey_old";
ALTER TYPE "OnboardingStepKey_new" RENAME TO "OnboardingStepKey";
DROP TYPE "OnboardingStepKey_old";

CREATE TYPE "ProductLine_new" AS ENUM ('STUDENT_HOUSING', 'AGENCY_INTERNAL');
ALTER TABLE "Organization" ALTER COLUMN "productLine" DROP DEFAULT;
ALTER TABLE "Organization" ALTER COLUMN "productLine" TYPE "ProductLine_new" USING ("productLine"::text::"ProductLine_new");
ALTER TYPE "ProductLine" RENAME TO "ProductLine_old";
ALTER TYPE "ProductLine_new" RENAME TO "ProductLine";
DROP TYPE "ProductLine_old";
ALTER TABLE "Organization" ALTER COLUMN "productLine" SET DEFAULT 'STUDENT_HOUSING';

CREATE TYPE "UserRole_new" AS ENUM ('AGENCY_OWNER', 'AGENCY_ADMIN', 'AGENCY_OPERATOR', 'CLIENT_OWNER', 'CLIENT_ADMIN', 'CLIENT_VIEWER', 'LEASING_AGENT');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TABLE "UserPropertyAccess" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT_VIEWER';

-- 3. Columns.
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_visitorId_fkey";
ALTER TABLE "Lead" DROP COLUMN "visitorId";
ALTER TABLE "ChatbotEngagement" DROP CONSTRAINT "ChatbotEngagement_visitorId_fkey";
DROP INDEX "ChatbotEngagement_visitorId_idx";
ALTER TABLE "ChatbotEngagement" DROP COLUMN "visitorId";
ALTER TABLE "AdAccount" DROP COLUMN "pixelSyncEnabled";
ALTER TABLE "TenantSiteConfig" DROP COLUMN "enablePixel";
ALTER TABLE "Organization"
  DROP COLUMN "cursiveApiKeyOverride",
  DROP COLUMN "modulePixel",
  DROP COLUMN "notifyOnNewVisitors",
  DROP COLUMN "notifyOnPixelLead",
  DROP COLUMN "notifyOnVisitorConvert";

-- 4. Tables (children first; CASCADE not used so an unknown dependency fails loudly).
DROP TABLE "AudienceSyncSchedule";
DROP TABLE "AudienceSyncRun";
DROP TABLE "AudienceDestination";
DROP TABLE "AudienceSegment";
DROP TABLE "VisitorEvent";
DROP TABLE "VisitorSession";
DROP TABLE "Visitor";
DROP TABLE "CursiveIntegration";
DROP TABLE "PixelProvisionRequest";

DROP TYPE "AudienceDestinationType";
DROP TYPE "AudienceScheduleFrequency";
DROP TYPE "AudienceSyncStatus";
DROP TYPE "PixelRequestStatus";
DROP TYPE "VisitorIdentificationStatus";

COMMIT;
