-- plans/lead-source-attribution S2: first-touch traffic source on leads + chats.
-- Additive only: nullable columns + one index. No data rewritten.

ALTER TABLE "Lead" ADD COLUMN "trafficSource" TEXT;
ALTER TABLE "Lead" ADD COLUMN "attribution" JSONB;
ALTER TABLE "ChatbotConversation" ADD COLUMN "trafficSource" TEXT;
ALTER TABLE "ChatbotConversation" ADD COLUMN "attribution" JSONB;

CREATE INDEX "Lead_orgId_trafficSource_idx" ON "Lead"("orgId", "trafficSource");
