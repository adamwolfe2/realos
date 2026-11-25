"use server";

import { revalidatePath } from "next/cache";
import {
  ForbiddenError,
  requireWritableWorkspace,
} from "@/lib/tenancy/scope";
import { effectivePropertyIds } from "@/lib/tenancy/property-filter";
import { runChatbotLearningLoop } from "@/lib/chatbot/learning/run";
import { generateProposals } from "@/lib/self-improve/generate";
import { prisma } from "@/lib/db";

export async function runConversationLearningAction(): Promise<
  | { ok: true; message: string }
  | { ok: false; error: string }
> {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const propertyIds = effectivePropertyIds(scope, null);
  const result = await runChatbotLearningLoop({
    orgId: scope.orgId,
    propertyIds,
    dryRun: false,
    take: 1000,
  });

  revalidatePath("/portal/conversations/insights");
  revalidatePath("/portal/conversations");
  revalidatePath("/portal/leads");

  return {
    ok: true,
    message: `Scanned ${result.scannedConversations.toLocaleString()} conversations. Created or refreshed ${result.persisted?.tasks ?? 0} follow-up tasks, ${result.persisted?.knowledgeSuggestions ?? 0} knowledge fixes, ${result.persisted?.conversationInsights ?? 0} insights, and ${result.persisted?.siteRecommendations ?? 0} site recommendations.`,
  };
}

/** "Generate now": this week's self-improve proposals for the workspace. */
export async function generateProposalsAction(): Promise<
  | { ok: true; message: string }
  | { ok: false; error: string }
> {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
  // A double click must not pay for a second pass. ponytail: check-then-act;
  // a click racing the weekly cron can pay twice for a few cents (rows are
  // still unique on dedupeKey). Add a lock row if this ever matters.
  const recent = await prisma.chatbotKnowledgeSuggestion.findFirst({
    where: { orgId: scope.orgId, dedupeKey: { startsWith: "si:" }, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
    select: { id: true },
  });
  if (recent) return { ok: false, error: "Proposals were generated a moment ago. Try again in a few minutes." };

  const r = await generateProposals(scope.orgId, { propertyIds: effectivePropertyIds(scope, null), deadline: Date.now() + 240_000 });
  revalidatePath("/portal/conversations/insights");
  revalidatePath("/portal");
  const made = r.answers + r.needsAnswer + r.popups + r.site;
  return {
    ok: true,
    message: made
      ? `${made} new proposal${made === 1 ? "" : "s"}: ${r.answers} drafted answers, ${r.needsAnswer} need SG's answer, ${r.popups} pop-up, ${r.site} website.${r.stoppedEarly ? " More next run." : ""}`
      : "Nothing new to propose. Every current signal already has a proposal.",
  };
}
