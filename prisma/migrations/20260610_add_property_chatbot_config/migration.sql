-- Per-property chatbot override (slice S1). One optional row per property;
-- every field nullable = inherit org-level TenantSiteConfig. Additive, no
-- backfill needed. Idempotent so `migrate deploy` is safe even though this
-- was applied to prod directly (Vercel build does not run migrate deploy).
CREATE TABLE IF NOT EXISTS "PropertyChatbotConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "chatbotEnabled" BOOLEAN,
    "chatbotAvatarUrl" TEXT,
    "chatbotPersonaName" TEXT,
    "chatbotGreeting" TEXT,
    "chatbotFollowUpMessage" TEXT,
    "chatbotTeaserText" TEXT,
    "chatbotBrandColor" TEXT,
    "chatbotCaptureMode" "ChatbotCaptureMode",
    "chatbotKnowledgeBase" TEXT,
    "chatbotIdleTriggerSeconds" INTEGER,
    "primaryCtaText" TEXT,
    "primaryCtaUrl" TEXT,
    "phoneNumber" TEXT,
    "contactEmail" TEXT,
    "ga4MeasurementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyChatbotConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyChatbotConfig_propertyId_key" ON "PropertyChatbotConfig"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyChatbotConfig_orgId_idx" ON "PropertyChatbotConfig"("orgId");

DO $$ BEGIN
  ALTER TABLE "PropertyChatbotConfig" ADD CONSTRAINT "PropertyChatbotConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PropertyChatbotConfig" ADD CONSTRAINT "PropertyChatbotConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
