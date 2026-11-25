"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, Prisma, RecommendationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { answerBlock, isSteering, mentionsProtectedClass, readProposal, type Proposal } from "@/lib/self-improve/proposal";
import {
  ForbiddenError,
  auditPayload,
  requireWritableWorkspace,
  type ScopedContext,
} from "@/lib/tenancy/scope";

// Matches lib/actions/chatbot-config.ts. SG's generated KBs run 3-7k chars.
const KNOWLEDGE_BASE_MAX = 12_000;

const idSchema = z.object({
  id: z.string().min(1),
});

// Approve with the operator's edited or real answer (self-improve proposals).
const applySchema = idSchema.extend({
  text: z.string().trim().min(1).max(1200).optional(),
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

  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const found = await prisma.chatbotKnowledgeSuggestion.findFirst({
    where: scopedWhere(scope, parsed.data.id),
    select: {
      id: true,
      propertyId: true,
      status: true,
      patternType: true,
      suggestedText: true,
      affectedCount: true,
      proposal: true,
    },
  });
  if (!found) return { ok: false, error: "Knowledge suggestion not found" };
  if (found.status !== RecommendationStatus.OPEN) {
    return { ok: false, error: "This knowledge suggestion was already handled." };
  }

  // Self-improve proposals: the answer is the edited text or the draft; a
  // "Needs SG's answer" card can't apply until someone writes the answer.
  const proposal = readProposal(found.proposal);
  const answer = parsed.data.text ?? found.suggestedText.trim();
  if (proposal?.question) {
    if (!answer) return { ok: false, error: "Write SG's answer first." };
    if (isSteering(answer)) {
      return { ok: false, error: "This wording could exclude or steer renters by a protected class. Rewrite it so it applies to everyone." };
    }
  }
  const suggestion = { ...found, suggestedText: proposal?.question ? answer : found.suggestedText };
  const block = proposal?.question ? answerBlock(proposal.question, answer) : buildKnowledgeBlock(suggestion);
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
        data: { status: RecommendationStatus.APPLIED, appliedAt: new Date(), suggestedText: suggestion.suggestedText },
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
        data: { status: RecommendationStatus.APPLIED, appliedAt: new Date(), suggestedText: suggestion.suggestedText },
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

const popupSchema = idSchema.extend({
  headline: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(300),
  ctaText: z.string().trim().min(1).max(30),
  delaySeconds: z.number().int().min(0).max(120),
});

/**
 * Approve a self-improve pop-up proposal: writes the (possibly edited) copy
 * and delay onto the live campaign. Refuses when the campaign was edited
 * since the proposal was drafted, so an approval never overwrites newer copy.
 */
export async function applyPopupProposal(input: unknown): Promise<ActionResult> {
  const scopeResult = await getWritableScope();
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.scope;

  const parsed = popupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the pop-up fields: headline up to 80 characters, CTA up to 30." };
  const { id, ...next } = parsed.data;
  if ([next.headline, next.body, next.ctaText].some(mentionsProtectedClass)) {
    return { ok: false, error: "Pop-up copy can't mention protected classes (fair housing). Rewrite it." };
  }

  const rec = await prisma.siteImprovementRecommendation.findFirst({
    where: scopedWhere(scope, id),
    select: { id: true, status: true, propertyId: true, proposal: true },
  });
  const proposal = readProposal(rec?.proposal);
  if (!rec || !proposal?.popup) return { ok: false, error: "Pop-up proposal not found" };
  if (rec.status !== RecommendationStatus.OPEN) return { ok: false, error: "This proposal was already handled." };

  const campaign = await prisma.popupCampaign.findFirst({
    where: { id: proposal.popup.campaignId, orgId: scope.orgId },
    select: { id: true, headline: true, body: true, ctaText: true, trigger: true, triggerThreshold: true },
  });
  if (!campaign) return { ok: false, error: "The pop-up no longer exists." };
  const cur = proposal.popup.current;
  if (campaign.headline !== cur.headline || campaign.body !== cur.body || campaign.ctaText !== cur.ctaText) {
    return { ok: false, error: "The pop-up was edited since this was proposed. Dismiss it; next week's run proposes from the new copy." };
  }

  const applied: Proposal = { ...proposal, popup: { ...proposal.popup, proposed: next } };
  await prisma.$transaction([
    prisma.popupCampaign.update({
      where: { id: campaign.id },
      data: {
        headline: next.headline,
        body: next.body,
        ctaText: next.ctaText,
        // Delay only means something for the time-on-page trigger.
        ...(campaign.trigger === "TIME_ON_PAGE" ? { triggerThreshold: next.delaySeconds } : {}),
      },
    }),
    prisma.siteImprovementRecommendation.update({
      where: { id: rec.id },
      data: { status: RecommendationStatus.APPLIED, appliedAt: new Date(), proposal: applied as Prisma.InputJsonValue },
    }),
    prisma.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.UPDATE,
        entityType: "PopupCampaign",
        entityId: campaign.id,
        description: "Applied self-improve pop-up proposal",
        diff: {
          recommendationId: rec.id,
          before: { ...cur, delaySeconds: campaign.triggerThreshold },
          after: next,
        } as Prisma.InputJsonValue,
      }),
    }),
  ]);
  revalidatePath("/portal/popups");
  revalidatePath(`/portal/popups/${campaign.id}`);
  if (rec.propertyId) revalidatePath(`/portal/properties/${rec.propertyId}`);
  revalidateInsights();
  return { ok: true, message: "Pop-up updated. Conversion is tracked from today." };
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
  revalidatePath("/portal");
}
