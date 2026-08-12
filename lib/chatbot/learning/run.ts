import "server-only";

import {
  ChatbotLearningCaseType,
  ChatbotLearningStatus,
  ConversationInsightType,
  LeadFollowUpChannel,
  LeadFollowUpDraftStatus,
  LeadFollowUpTaskStatus,
  LeadFollowUpTaskType,
  Prisma,
  RecommendationStatus,
  SiteImprovementTarget,
  SiteImprovementType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createLearningRunPlan,
  type ConversationInsightPlan,
  type DraftPlan,
  type FollowUpTaskPlan,
  type KnowledgeSuggestionPlan,
  type LearningCasePlan,
  type LearningConversation,
  type LearningRunPlan,
  type SiteImprovementPlan,
} from "./engine";

export type ChatbotLearningRunResult = {
  dryRun: boolean;
  scannedConversations: number;
  plan: {
    cases: number;
    tasks: number;
    drafts: number;
    knowledgeSuggestions: number;
    conversationInsights: number;
    siteRecommendations: number;
  };
  persisted?: {
    cases: number;
    tasks: number;
    drafts: number;
    knowledgeSuggestions: number;
    conversationInsights: number;
    siteRecommendations: number;
  };
};

export async function runChatbotLearningLoop(params: {
  orgId: string;
  propertyIds?: string[] | null;
  dryRun?: boolean;
  take?: number;
  now?: Date;
}): Promise<ChatbotLearningRunResult> {
  const dryRun = params.dryRun ?? true;
  const take = Math.min(Math.max(params.take ?? 500, 1), 2000);
  const conversations = await loadLearningConversations({
    orgId: params.orgId,
    propertyIds: params.propertyIds,
    take,
  });
  const plan = createLearningRunPlan(conversations, params.now ?? new Date());
  const summary = summarizePlan(plan);

  if (dryRun) {
    return {
      dryRun,
      scannedConversations: conversations.length,
      plan: summary,
    };
  }

  const persisted = await persistLearningPlan(params.orgId, plan);
  return {
    dryRun,
    scannedConversations: conversations.length,
    plan: summary,
    persisted,
  };
}

export async function loadChatbotLearningSummary(params: {
  orgId: string;
  propertyIds?: string[] | null;
}) {
  const propertyWhere = propertyScope(params.propertyIds);
  const [
    openTasks,
    highPriorityTasks,
    openInsights,
    openKnowledgeSuggestions,
    openSiteRecommendations,
    recentTasks,
    topInsights,
    knowledgeSuggestions,
    siteRecommendations,
  ] = await Promise.all([
    prisma.leadFollowUpTask.count({
      where: { orgId: params.orgId, status: LeadFollowUpTaskStatus.OPEN, ...propertyWhere },
    }),
    prisma.leadFollowUpTask.count({
      where: {
        orgId: params.orgId,
        status: LeadFollowUpTaskStatus.OPEN,
        priority: { lte: 1 },
        ...propertyWhere,
      },
    }),
    prisma.conversationInsight.count({
      where: { orgId: params.orgId, status: RecommendationStatus.OPEN, ...propertyWhere },
    }),
    prisma.chatbotKnowledgeSuggestion.count({
      where: { orgId: params.orgId, status: RecommendationStatus.OPEN, ...propertyWhere },
    }),
    prisma.siteImprovementRecommendation.count({
      where: { orgId: params.orgId, status: RecommendationStatus.OPEN, ...propertyWhere },
    }),
    prisma.leadFollowUpTask.findMany({
      where: { orgId: params.orgId, status: LeadFollowUpTaskStatus.OPEN, ...propertyWhere },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, status: true, email: true, phone: true } },
        drafts: { where: { status: LeadFollowUpDraftStatus.DRAFT }, take: 1 },
      },
    }),
    prisma.conversationInsight.findMany({
      where: { orgId: params.orgId, status: RecommendationStatus.OPEN, ...propertyWhere },
      orderBy: [{ impactScore: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.chatbotKnowledgeSuggestion.findMany({
      where: { orgId: params.orgId, status: RecommendationStatus.OPEN, ...propertyWhere },
      orderBy: [{ affectedCount: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.siteImprovementRecommendation.findMany({
      where: { orgId: params.orgId, status: RecommendationStatus.OPEN, ...propertyWhere },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    counts: {
      openTasks,
      highPriorityTasks,
      openInsights,
      openKnowledgeSuggestions,
      openSiteRecommendations,
    },
    recentTasks,
    topInsights,
    knowledgeSuggestions,
    siteRecommendations,
  };
}

async function loadLearningConversations(params: {
  orgId: string;
  propertyIds?: string[] | null;
  take: number;
}): Promise<LearningConversation[]> {
  const rows = await prisma.chatbotConversation.findMany({
    where: {
      orgId: params.orgId,
      ...propertyScope(params.propertyIds),
    },
    orderBy: { lastMessageAt: "desc" },
    take: params.take,
    select: {
      id: true,
      orgId: true,
      propertyId: true,
      leadId: true,
      capturedEmail: true,
      capturedPhone: true,
      messageCount: true,
      lastMessageAt: true,
      messages: true,
      prospectProfile: true,
      lead: {
        select: {
          id: true,
          status: true,
          source: true,
          intent: true,
          firstName: true,
          email: true,
          phone: true,
          lastActivityAt: true,
          lastEmailSentAt: true,
          emailsSent: true,
          tours: { select: { id: true } },
          applications: { select: { id: true } },
          residents: { select: { id: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    orgId: row.orgId,
    propertyId: row.propertyId,
    leadId: row.leadId,
    capturedEmail: row.capturedEmail,
    capturedPhone: row.capturedPhone,
    messageCount: row.messageCount,
    lastMessageAt: row.lastMessageAt,
    messages: row.messages,
    prospectProfile: row.prospectProfile,
    lead: row.lead
      ? {
          id: row.lead.id,
          status: row.lead.status,
          source: row.lead.source,
          intent: row.lead.intent,
          firstName: row.lead.firstName,
          email: row.lead.email,
          phone: row.lead.phone,
          lastActivityAt: row.lead.lastActivityAt,
          lastEmailSentAt: row.lead.lastEmailSentAt,
          emailsSent: row.lead.emailsSent,
          tours: row.lead.tours,
          applications: row.lead.applications,
          residents: row.lead.residents,
        }
      : null,
  }));
}

async function persistLearningPlan(
  orgId: string,
  plan: LearningRunPlan,
): Promise<NonNullable<ChatbotLearningRunResult["persisted"]>> {
  const caseIds = new Map<string, string>();
  for (const item of plan.cases) {
    const row = await persistCase(orgId, item);
    caseIds.set(item.dedupeKey, row.id);
  }

  const taskIds = new Map<string, string>();
  for (const item of plan.tasks) {
    const row = await persistTask(orgId, item, caseIds.get(item.caseDedupeKey) ?? null);
    taskIds.set(item.dedupeKey, row.id);
    await persistDraft(orgId, row.id, item.draft);
  }

  for (const item of plan.knowledgeSuggestions) {
    await persistKnowledgeSuggestion(orgId, item, caseIds);
  }

  const insightIds = new Map<string, string>();
  for (const item of plan.conversationInsights) {
    const row = await persistConversationInsight(orgId, item, caseIds);
    insightIds.set(item.dedupeKey, row.id);
  }

  for (const item of plan.siteRecommendations) {
    await persistSiteRecommendation(orgId, item, insightIds.get(item.insightDedupeKey) ?? null);
  }

  return {
    cases: plan.cases.length,
    tasks: plan.tasks.length,
    drafts: plan.tasks.length,
    knowledgeSuggestions: plan.knowledgeSuggestions.length,
    conversationInsights: plan.conversationInsights.length,
    siteRecommendations: plan.siteRecommendations.length,
  };
}

function persistCase(orgId: string, item: LearningCasePlan) {
  return prisma.chatbotLearningCase.upsert({
    where: { orgId_dedupeKey: { orgId, dedupeKey: item.dedupeKey } },
    create: {
      orgId,
      propertyId: item.propertyId,
      conversationId: item.conversationId,
      leadId: item.leadId,
      caseType: item.caseType as ChatbotLearningCaseType,
      status: ChatbotLearningStatus.OPEN,
      confidence: item.confidence,
      reasonSummary: item.reasonSummary,
      evidenceJson: item.evidence as Prisma.InputJsonValue,
      outcomeSnapshotJson: item.outcomeSnapshot as Prisma.InputJsonValue,
      dedupeKey: item.dedupeKey,
    },
    update: {
      propertyId: item.propertyId,
      conversationId: item.conversationId,
      leadId: item.leadId,
      confidence: item.confidence,
      reasonSummary: item.reasonSummary,
      evidenceJson: item.evidence as Prisma.InputJsonValue,
      outcomeSnapshotJson: item.outcomeSnapshot as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

function persistTask(
  orgId: string,
  item: FollowUpTaskPlan,
  learningCaseId: string | null,
) {
  return prisma.leadFollowUpTask.upsert({
    where: { orgId_dedupeKey: { orgId, dedupeKey: item.dedupeKey } },
    create: {
      orgId,
      propertyId: item.propertyId,
      leadId: item.leadId,
      conversationId: item.conversationId,
      learningCaseId,
      taskType: item.taskType as LeadFollowUpTaskType,
      priority: item.priority,
      status: LeadFollowUpTaskStatus.OPEN,
      recommendedChannel: item.recommendedChannel as LeadFollowUpChannel,
      dueAt: item.dueAt,
      reasonSummary: item.reasonSummary,
      dedupeKey: item.dedupeKey,
    },
    update: {
      propertyId: item.propertyId,
      leadId: item.leadId,
      conversationId: item.conversationId,
      learningCaseId,
      priority: item.priority,
      recommendedChannel: item.recommendedChannel as LeadFollowUpChannel,
      dueAt: item.dueAt,
      reasonSummary: item.reasonSummary,
    },
    select: { id: true },
  });
}

function persistDraft(orgId: string, taskId: string, item: DraftPlan) {
  return prisma.leadFollowUpDraft.upsert({
    where: { taskId_channel: { taskId, channel: item.channel as LeadFollowUpChannel } },
    create: {
      orgId,
      taskId,
      channel: item.channel as LeadFollowUpChannel,
      subject: item.subject,
      body: item.body,
      generatedFromJson: item.generatedFrom as Prisma.InputJsonValue,
      complianceWarningsJson: item.complianceWarnings as Prisma.InputJsonValue,
      status: LeadFollowUpDraftStatus.DRAFT,
    },
    update: {
      subject: item.subject,
      body: item.body,
      generatedFromJson: item.generatedFrom as Prisma.InputJsonValue,
      complianceWarningsJson: item.complianceWarnings as Prisma.InputJsonValue,
    },
  });
}

function persistKnowledgeSuggestion(
  orgId: string,
  item: KnowledgeSuggestionPlan,
  caseIds: Map<string, string>,
) {
  const sourceCaseIds = item.sourceCaseDedupeKeys
    .map((key) => caseIds.get(key))
    .filter((id): id is string => !!id);
  return prisma.chatbotKnowledgeSuggestion.upsert({
    where: { orgId_dedupeKey: { orgId, dedupeKey: item.dedupeKey } },
    create: {
      orgId,
      propertyId: item.propertyId,
      patternType: item.patternType,
      affectedCount: item.affectedCount,
      suggestedText: item.suggestedText,
      sourceCaseIds,
      status: RecommendationStatus.OPEN,
      dedupeKey: item.dedupeKey,
    },
    update: {
      affectedCount: item.affectedCount,
      suggestedText: item.suggestedText,
      sourceCaseIds,
    },
  });
}

function persistConversationInsight(
  orgId: string,
  item: ConversationInsightPlan,
  caseIds: Map<string, string>,
) {
  const sourceCaseIds = item.sourceCaseDedupeKeys
    .map((key) => caseIds.get(key))
    .filter((id): id is string => !!id);
  return prisma.conversationInsight.upsert({
    where: { orgId_dedupeKey: { orgId, dedupeKey: item.dedupeKey } },
    create: {
      orgId,
      propertyId: item.propertyId,
      insightType: item.insightType as ConversationInsightType,
      title: item.title,
      summary: item.summary,
      affectedCount: item.affectedCount,
      impactScore: item.impactScore,
      status: RecommendationStatus.OPEN,
      evidenceJson: item.evidence as Prisma.InputJsonValue,
      recommendationJson: item.recommendation as Prisma.InputJsonValue,
      sourceCaseIds,
      dedupeKey: item.dedupeKey,
    },
    update: {
      title: item.title,
      summary: item.summary,
      affectedCount: item.affectedCount,
      impactScore: item.impactScore,
      evidenceJson: item.evidence as Prisma.InputJsonValue,
      recommendationJson: item.recommendation as Prisma.InputJsonValue,
      sourceCaseIds,
    },
    select: { id: true },
  });
}

function persistSiteRecommendation(
  orgId: string,
  item: SiteImprovementPlan,
  insightId: string | null,
) {
  return prisma.siteImprovementRecommendation.upsert({
    where: { orgId_dedupeKey: { orgId, dedupeKey: item.dedupeKey } },
    create: {
      orgId,
      propertyId: item.propertyId,
      insightId,
      recommendationType: item.recommendationType as SiteImprovementType,
      targetSurface: item.targetSurface as SiteImprovementTarget,
      suggestedTitle: item.suggestedTitle,
      suggestedBody: item.suggestedBody,
      status: RecommendationStatus.OPEN,
      dedupeKey: item.dedupeKey,
    },
    update: {
      propertyId: item.propertyId,
      insightId,
      suggestedTitle: item.suggestedTitle,
      suggestedBody: item.suggestedBody,
    },
  });
}

function summarizePlan(plan: LearningRunPlan): ChatbotLearningRunResult["plan"] {
  return {
    cases: plan.cases.length,
    tasks: plan.tasks.length,
    drafts: plan.tasks.length,
    knowledgeSuggestions: plan.knowledgeSuggestions.length,
    conversationInsights: plan.conversationInsights.length,
    siteRecommendations: plan.siteRecommendations.length,
  };
}

function propertyScope(propertyIds: string[] | null | undefined) {
  if (!propertyIds || propertyIds.length === 0) return {};
  return {
    OR: [{ propertyId: { in: propertyIds } }, { propertyId: null }],
  };
}
