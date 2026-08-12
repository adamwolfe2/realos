"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, Prisma, RecommendationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ForbiddenError,
  auditPayload,
  requireWritableWorkspace,
  type ScopedContext,
} from "@/lib/tenancy/scope";

const KNOWLEDGE_BASE_MAX = 5000;

const idSchema = z.object({
  id: z.string().min(1),
});

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function applyChatbotKnowledgeSuggestion(
  input: unknown,
): Promise<ActionResult> {
  const scopeResult = await getWritableScope();
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.scope;

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const suggestion = await prisma.chatbotKnowledgeSuggestion.findFirst({
    where: scopedWhere(scope, parsed.data.id),
    select: {
      id: true,
      propertyId: true,
      status: true,
      patternType: true,
      suggestedText: true,
      affectedCount: true,
    },
  });
  if (!suggestion) return { ok: false, error: "Knowledge suggestion not found" };
  if (suggestion.status !== RecommendationStatus.OPEN) {
    return { ok: false, error: "This knowledge suggestion was already handled." };
  }

  const block = buildKnowledgeBlock(suggestion);
  if (suggestion.propertyId) {
    const current = await prisma.propertyChatbotConfig.findUnique({
      where: { propertyId: suggestion.propertyId },
      select: { chatbotKnowledgeBase: true },
    });
    const next = appendKnowledgeBlock(current?.chatbotKnowledgeBase ?? null, block);
    if (next.length > KNOWLEDGE_BASE_MAX) {
      return {
        ok: false,
        error: "Knowledge base is too long. Edit the property chatbot knowledge base before applying this fix.",
      };
    }

    await prisma.$transaction([
      prisma.propertyChatbotConfig.upsert({
        where: { propertyId: suggestion.propertyId },
        update: { chatbotKnowledgeBase: next },
        create: {
          orgId: scope.orgId,
          propertyId: suggestion.propertyId,
          chatbotKnowledgeBase: next,
        },
      }),
      prisma.chatbotKnowledgeSuggestion.update({
        where: { id: suggestion.id },
        data: { status: RecommendationStatus.APPLIED, appliedAt: new Date() },
      }),
      prisma.auditEvent.create({
        data: auditPayload(scope as ScopedContext, {
          action: AuditAction.UPDATE,
          entityType: "ChatbotKnowledgeSuggestion",
          entityId: suggestion.id,
          description: "Applied chatbot knowledge suggestion",
          diff: {
            propertyId: suggestion.propertyId,
            patternType: suggestion.patternType,
            affectedCount: suggestion.affectedCount,
          } as Prisma.InputJsonValue,
        }),
      }),
    ]);
    revalidatePath(`/portal/properties/${suggestion.propertyId}`);
  } else {
    const current = await prisma.tenantSiteConfig.findUnique({
      where: { orgId: scope.orgId },
      select: { chatbotKnowledgeBase: true },
    });
    const next = appendKnowledgeBlock(current?.chatbotKnowledgeBase ?? null, block);
    if (next.length > KNOWLEDGE_BASE_MAX) {
      return {
        ok: false,
        error: "Workspace chatbot knowledge base is too long. Edit it before applying this fix.",
      };
    }

    await prisma.$transaction([
      prisma.tenantSiteConfig.upsert({
        where: { orgId: scope.orgId },
        update: { chatbotKnowledgeBase: next },
        create: {
          orgId: scope.orgId,
          chatbotKnowledgeBase: next,
        },
      }),
      prisma.chatbotKnowledgeSuggestion.update({
        where: { id: suggestion.id },
        data: { status: RecommendationStatus.APPLIED, appliedAt: new Date() },
      }),
      prisma.auditEvent.create({
        data: auditPayload(scope as ScopedContext, {
          action: AuditAction.UPDATE,
          entityType: "ChatbotKnowledgeSuggestion",
          entityId: suggestion.id,
          description: "Applied workspace chatbot knowledge suggestion",
          diff: {
            patternType: suggestion.patternType,
            affectedCount: suggestion.affectedCount,
          } as Prisma.InputJsonValue,
        }),
      }),
    ]);
    revalidatePath("/portal/chatbot");
  }

  revalidateInsights();
  return { ok: true, message: "Knowledge fix applied to chatbot knowledge." };
}

export async function dismissChatbotKnowledgeSuggestion(
  input: unknown,
): Promise<ActionResult> {
  return updateSimpleQueueItem({
    input,
    model: "chatbotKnowledgeSuggestion",
    entityType: "ChatbotKnowledgeSuggestion",
    message: "Knowledge fix dismissed.",
  });
}

export async function resolveConversationInsight(
  input: unknown,
): Promise<ActionResult> {
  return updateSimpleQueueItem({
    input,
    model: "conversationInsight",
    entityType: "ConversationInsight",
    nextStatus: RecommendationStatus.APPLIED,
    message: "Insight marked reviewed.",
  });
}

export async function dismissConversationInsight(
  input: unknown,
): Promise<ActionResult> {
  return updateSimpleQueueItem({
    input,
    model: "conversationInsight",
    entityType: "ConversationInsight",
    message: "Insight dismissed.",
  });
}

export async function markSiteRecommendationPlanned(
  input: unknown,
): Promise<ActionResult> {
  return updateSimpleQueueItem({
    input,
    model: "siteImprovementRecommendation",
    entityType: "SiteImprovementRecommendation",
    nextStatus: RecommendationStatus.APPLIED,
    message: "Site recommendation marked planned.",
  });
}

export async function dismissSiteRecommendation(
  input: unknown,
): Promise<ActionResult> {
  return updateSimpleQueueItem({
    input,
    model: "siteImprovementRecommendation",
    entityType: "SiteImprovementRecommendation",
    message: "Site recommendation dismissed.",
  });
}

async function updateSimpleQueueItem(params: {
  input: unknown;
  model:
    | "chatbotKnowledgeSuggestion"
    | "conversationInsight"
    | "siteImprovementRecommendation";
  entityType: string;
  nextStatus?: RecommendationStatus;
  message: string;
}): Promise<ActionResult> {
  const scopeResult = await getWritableScope();
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.scope;

  const parsed = idSchema.safeParse(params.input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const model = prisma[params.model] as unknown as {
    findFirst: (args: unknown) => Promise<{
      id: string;
      propertyId: string | null;
      status: RecommendationStatus;
    } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
  const item = await model.findFirst({
    where: scopedWhere(scope, parsed.data.id),
    select: { id: true, propertyId: true, status: true },
  });
  if (!item) return { ok: false, error: "Item not found" };
  if (item.status !== RecommendationStatus.OPEN) {
    return { ok: false, error: "This item was already handled." };
  }

  const nextStatus = params.nextStatus ?? RecommendationStatus.DISMISSED;
  const now = new Date();
  const data =
    params.model === "conversationInsight"
      ? { status: nextStatus, resolvedAt: now }
      : nextStatus === RecommendationStatus.DISMISSED
        ? { status: nextStatus, dismissedAt: now }
        : { status: nextStatus, appliedAt: now };

  await prisma.$transaction(async (tx) => {
    const txModel = tx[params.model] as unknown as {
      update: (args: unknown) => Promise<unknown>;
    };
    await txModel.update({
      where: { id: item.id },
      data,
    });
    await tx.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.UPDATE,
        entityType: params.entityType,
        entityId: item.id,
        description: `${params.entityType} ${nextStatus.toLowerCase()}`,
        diff: {
          previousStatus: item.status,
          nextStatus,
          propertyId: item.propertyId,
        } as Prisma.InputJsonValue,
      }),
    });
  });

  revalidateInsights();
  return { ok: true, message: params.message };
}

async function getWritableScope(): Promise<
  | { ok: true; scope: ScopedContext }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, scope: await requireWritableWorkspace() };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

function scopedWhere(scope: ScopedContext, id: string) {
  if (!scope.allowedPropertyIds) {
    return { id, orgId: scope.orgId };
  }
  return {
    id,
    orgId: scope.orgId,
    OR: [
      { propertyId: null },
      { propertyId: { in: scope.allowedPropertyIds } },
    ],
  };
}

function appendKnowledgeBlock(existing: string | null, block: string) {
  const trimmed = existing?.trim();
  if (!trimmed) return block;
  if (trimmed.includes(block)) return trimmed;
  return `${trimmed}\n\n${block}`;
}

function buildKnowledgeBlock(suggestion: {
  patternType: string;
  suggestedText: string;
  affectedCount: number;
}) {
  return [
    "Approved chatbot learning:",
    `- Pattern: ${suggestion.patternType.replaceAll("_", " ")}`,
    `- Affected conversations: ${suggestion.affectedCount}`,
    `- Guidance: ${suggestion.suggestedText}`,
  ].join("\n");
}

function revalidateInsights() {
  revalidatePath("/portal/conversations/insights");
  revalidatePath("/portal/chatbot");
}
