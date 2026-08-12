"use server";

import { revalidatePath } from "next/cache";
import {
  ForbiddenError,
  requireWritableWorkspace,
} from "@/lib/tenancy/scope";
import { effectivePropertyIds } from "@/lib/tenancy/property-filter";
import { runChatbotLearningLoop } from "@/lib/chatbot/learning/run";

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
