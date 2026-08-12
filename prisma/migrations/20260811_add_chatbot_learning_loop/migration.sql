-- Chatbot recursive learning loop.
-- Additive only: introduces learning cases, follow-up tasks/drafts,
-- conversation insights, and recommendation queues. No existing lead,
-- conversation, or property data is modified.

CREATE TYPE "ChatbotLearningCaseType" AS ENUM (
  'STALLED_LEAD',
  'UNCAPTURED_ENGAGED_CONVERSATION',
  'TOUR_INTENT_NO_TOUR',
  'PRICING_QUESTION_NO_CAPTURE',
  'AVAILABILITY_QUESTION_NO_CAPTURE',
  'APPLICATION_HELP_NEEDED',
  'SIGNED_PATTERN',
  'LOST_PATTERN',
  'BOT_FALLBACK_PATTERN'
);

CREATE TYPE "ChatbotLearningStatus" AS ENUM (
  'OPEN',
  'RESOLVED',
  'DISMISSED',
  'SUPERSEDED'
);

CREATE TYPE "LeadFollowUpTaskType" AS ENUM (
  'SEND_AVAILABILITY_PRICING',
  'INVITE_TO_TOUR',
  'APPLICATION_HELP',
  'GENERAL_FOLLOW_UP',
  'CONFIRM_ROOM_TYPE',
  'CONFIRM_MOVE_IN'
);

CREATE TYPE "LeadFollowUpTaskStatus" AS ENUM (
  'OPEN',
  'APPROVED',
  'SENT',
  'EDITED_SENT',
  'DISMISSED',
  'SNOOZED'
);

CREATE TYPE "LeadFollowUpChannel" AS ENUM (
  'EMAIL',
  'SMS',
  'CALL',
  'INTERNAL_NOTE'
);

CREATE TYPE "LeadFollowUpDraftStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'SENT',
  'EDITED_SENT',
  'DISMISSED'
);

CREATE TYPE "ConversationInsightType" AS ENUM (
  'OBJECTION',
  'MISSING_ANSWER',
  'PRICING_CONFUSION',
  'AVAILABILITY_CONFUSION',
  'TOUR_FRICTION',
  'APPLICATION_FRICTION',
  'POLICY_QUESTION',
  'SITE_CONTENT_GAP',
  'WEAK_CTA',
  'HIGH_CONVERTING_PATTERN'
);

CREATE TYPE "RecommendationStatus" AS ENUM (
  'OPEN',
  'APPLIED',
  'DISMISSED',
  'SUPERSEDED'
);

CREATE TYPE "SiteImprovementType" AS ENUM (
  'FAQ',
  'PRICING_COPY',
  'AVAILABILITY_COPY',
  'TOUR_CTA',
  'APPLICATION_COPY',
  'POLICY_COPY'
);

CREATE TYPE "SiteImprovementTarget" AS ENUM (
  'TENANT_SITE',
  'CHATBOT_KNOWLEDGE_BASE',
  'SITE_BUILDER',
  'CONTENT_WORKFLOW'
);

CREATE TABLE "ChatbotLearningCase" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "propertyId" TEXT,
  "conversationId" TEXT,
  "leadId" TEXT,
  "caseType" "ChatbotLearningCaseType" NOT NULL,
  "status" "ChatbotLearningStatus" NOT NULL DEFAULT 'OPEN',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "reasonSummary" TEXT NOT NULL,
  "evidenceJson" JSONB,
  "outcomeSnapshotJson" JSONB,
  "dedupeKey" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatbotLearningCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadFollowUpTask" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "propertyId" TEXT,
  "leadId" TEXT,
  "conversationId" TEXT,
  "learningCaseId" TEXT,
  "taskType" "LeadFollowUpTaskType" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 2,
  "status" "LeadFollowUpTaskStatus" NOT NULL DEFAULT 'OPEN',
  "recommendedChannel" "LeadFollowUpChannel" NOT NULL,
  "dueAt" TIMESTAMP(3),
  "reasonSummary" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "dismissedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadFollowUpTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadFollowUpDraft" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "channel" "LeadFollowUpChannel" NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "generatedFromJson" JSONB,
  "complianceWarningsJson" JSONB,
  "status" "LeadFollowUpDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "editedBody" TEXT,
  "sentAt" TIMESTAMP(3),
  "sentAuditEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadFollowUpDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatbotKnowledgeSuggestion" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "propertyId" TEXT,
  "patternType" TEXT NOT NULL,
  "affectedCount" INTEGER NOT NULL DEFAULT 0,
  "suggestedText" TEXT NOT NULL,
  "sourceCaseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "dedupeKey" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatbotKnowledgeSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationInsight" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "propertyId" TEXT,
  "insightType" "ConversationInsightType" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "affectedCount" INTEGER NOT NULL DEFAULT 0,
  "impactScore" INTEGER NOT NULL DEFAULT 0,
  "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "evidenceJson" JSONB,
  "recommendationJson" JSONB,
  "sourceCaseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dedupeKey" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteImprovementRecommendation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "propertyId" TEXT,
  "insightId" TEXT,
  "recommendationType" "SiteImprovementType" NOT NULL,
  "targetSurface" "SiteImprovementTarget" NOT NULL,
  "suggestedTitle" TEXT NOT NULL,
  "suggestedBody" TEXT NOT NULL,
  "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "dedupeKey" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SiteImprovementRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatbotLearningCase_orgId_dedupeKey_key"
  ON "ChatbotLearningCase"("orgId", "dedupeKey");
CREATE INDEX "ChatbotLearningCase_orgId_status_createdAt_idx"
  ON "ChatbotLearningCase"("orgId", "status", "createdAt" DESC);
CREATE INDEX "ChatbotLearningCase_propertyId_idx"
  ON "ChatbotLearningCase"("propertyId");
CREATE INDEX "ChatbotLearningCase_conversationId_idx"
  ON "ChatbotLearningCase"("conversationId");
CREATE INDEX "ChatbotLearningCase_leadId_idx"
  ON "ChatbotLearningCase"("leadId");

CREATE UNIQUE INDEX "LeadFollowUpTask_orgId_dedupeKey_key"
  ON "LeadFollowUpTask"("orgId", "dedupeKey");
CREATE INDEX "LeadFollowUpTask_orgId_status_priority_dueAt_idx"
  ON "LeadFollowUpTask"("orgId", "status", "priority", "dueAt");
CREATE INDEX "LeadFollowUpTask_propertyId_idx"
  ON "LeadFollowUpTask"("propertyId");
CREATE INDEX "LeadFollowUpTask_leadId_idx"
  ON "LeadFollowUpTask"("leadId");
CREATE INDEX "LeadFollowUpTask_conversationId_idx"
  ON "LeadFollowUpTask"("conversationId");
CREATE INDEX "LeadFollowUpTask_learningCaseId_idx"
  ON "LeadFollowUpTask"("learningCaseId");

CREATE UNIQUE INDEX "LeadFollowUpDraft_taskId_channel_key"
  ON "LeadFollowUpDraft"("taskId", "channel");
CREATE INDEX "LeadFollowUpDraft_orgId_status_createdAt_idx"
  ON "LeadFollowUpDraft"("orgId", "status", "createdAt" DESC);

CREATE UNIQUE INDEX "ChatbotKnowledgeSuggestion_orgId_dedupeKey_key"
  ON "ChatbotKnowledgeSuggestion"("orgId", "dedupeKey");
CREATE INDEX "ChatbotKnowledgeSuggestion_orgId_status_createdAt_idx"
  ON "ChatbotKnowledgeSuggestion"("orgId", "status", "createdAt" DESC);
CREATE INDEX "ChatbotKnowledgeSuggestion_propertyId_idx"
  ON "ChatbotKnowledgeSuggestion"("propertyId");

CREATE UNIQUE INDEX "ConversationInsight_orgId_dedupeKey_key"
  ON "ConversationInsight"("orgId", "dedupeKey");
CREATE INDEX "ConversationInsight_orgId_status_impactScore_idx"
  ON "ConversationInsight"("orgId", "status", "impactScore");
CREATE INDEX "ConversationInsight_propertyId_idx"
  ON "ConversationInsight"("propertyId");

CREATE UNIQUE INDEX "SiteImprovementRecommendation_orgId_dedupeKey_key"
  ON "SiteImprovementRecommendation"("orgId", "dedupeKey");
CREATE INDEX "SiteImprovementRecommendation_orgId_status_createdAt_idx"
  ON "SiteImprovementRecommendation"("orgId", "status", "createdAt" DESC);
CREATE INDEX "SiteImprovementRecommendation_propertyId_idx"
  ON "SiteImprovementRecommendation"("propertyId");
CREATE INDEX "SiteImprovementRecommendation_insightId_idx"
  ON "SiteImprovementRecommendation"("insightId");

ALTER TABLE "ChatbotLearningCase"
  ADD CONSTRAINT "ChatbotLearningCase_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatbotLearningCase"
  ADD CONSTRAINT "ChatbotLearningCase_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatbotLearningCase"
  ADD CONSTRAINT "ChatbotLearningCase_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "ChatbotConversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatbotLearningCase"
  ADD CONSTRAINT "ChatbotLearningCase_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadFollowUpTask"
  ADD CONSTRAINT "LeadFollowUpTask_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadFollowUpTask"
  ADD CONSTRAINT "LeadFollowUpTask_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadFollowUpTask"
  ADD CONSTRAINT "LeadFollowUpTask_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadFollowUpTask"
  ADD CONSTRAINT "LeadFollowUpTask_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "ChatbotConversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadFollowUpTask"
  ADD CONSTRAINT "LeadFollowUpTask_learningCaseId_fkey"
  FOREIGN KEY ("learningCaseId") REFERENCES "ChatbotLearningCase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadFollowUpDraft"
  ADD CONSTRAINT "LeadFollowUpDraft_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadFollowUpDraft"
  ADD CONSTRAINT "LeadFollowUpDraft_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "LeadFollowUpTask"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatbotKnowledgeSuggestion"
  ADD CONSTRAINT "ChatbotKnowledgeSuggestion_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatbotKnowledgeSuggestion"
  ADD CONSTRAINT "ChatbotKnowledgeSuggestion_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationInsight"
  ADD CONSTRAINT "ConversationInsight_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationInsight"
  ADD CONSTRAINT "ConversationInsight_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiteImprovementRecommendation"
  ADD CONSTRAINT "SiteImprovementRecommendation_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteImprovementRecommendation"
  ADD CONSTRAINT "SiteImprovementRecommendation_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SiteImprovementRecommendation"
  ADD CONSTRAINT "SiteImprovementRecommendation_insightId_fkey"
  FOREIGN KEY ("insightId") REFERENCES "ConversationInsight"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
