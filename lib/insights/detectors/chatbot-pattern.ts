import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;

type ChatbotMessage = {
  role: string;
  content: string;
  timestamp?: string;
};

/**
 * Chatbot pattern detector.
 *
 * Scans recent chatbot conversations for repeated user questions that the bot
 * answered with generic "contact the leasing office" or "I don't know"
 * responses. These are prompt-tuning opportunities the operator would never
 * see without reading every transcript. Fires one insight per pattern per week.
 *
 * Patterns detected:
 *   1. Multiple pricing questions → suggest adding current pricing to prompt
 *   2. Multiple questions about a specific amenity the bot didn't know
 *   3. High rate of "I'm not sure" fallbacks
 */
export const chatbotPatternDetector: Detector = {
  name: "chatbot-pattern",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - 7 * DAY);
    const conversations = await prisma.chatbotConversation.findMany({
      where: { orgId, lastMessageAt: { gte: since } },
      select: { messages: true },
      take: 500,
    });

    if (conversations.length < 5) return [];

    let pricingQuestions = 0;
    let unsureFallbacks = 0;
    let totalAssistantMessages = 0;

    for (const conv of conversations) {
      const msgs = (conv.messages as unknown as ChatbotMessage[]) ?? [];
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const content = (m.content ?? "").toLowerCase();

        if (m.role === "user") {
          if (/\$|price|rent|cost|how much|monthly/.test(content)) {
            pricingQuestions += 1;
          }
        }

        if (m.role === "assistant") {
          totalAssistantMessages += 1;
          if (
            /i'?m not sure|i don'?t know|contact the leasing|reach out to.*leasing|i can'?t confirm|check.*availabilities|current pricing/i.test(
              m.content ?? "",
            )
          ) {
            unsureFallbacks += 1;
          }
        }
      }
    }

    const insights: DetectedInsight[] = [];
    const weekKey = isoWeekKey(new Date());

    if (pricingQuestions >= 10) {
      insights.push({
        kind: "chatbot_pattern",
        category: "chatbot",
        severity: "info",
        title: `${pricingQuestions} pricing questions asked this week`,
        body: `Users keep asking about rent and pricing. The bot's current prompt directs them to call or check availabilities, which adds friction. Adding a current starting price range to the system prompt would convert more sessions directly.`,
        suggestedAction:
          "Open Chatbot settings and add a pricing line: 'Rooms start at $X/mo, depending on unit type and lease length. For exact pricing schedule a tour.'",
        href: "/portal/chatbot",
        dedupeKey: `chatbot_pattern:pricing:week:${weekKey}`,
        context: {
          pricingQuestionCount: pricingQuestions,
          conversationsScanned: conversations.length,
        },
      });
    }

    if (totalAssistantMessages >= 20) {
      const fallbackRate = unsureFallbacks / totalAssistantMessages;
      if (fallbackRate >= 0.2) {
        insights.push({
          kind: "chatbot_pattern",
          category: "chatbot",
          severity: "warning",
          title: `Chatbot punted ${Math.round(fallbackRate * 100)}% of replies to leasing`,
          body: `${unsureFallbacks} of ${totalAssistantMessages} assistant replies this week told the visitor to contact the leasing office. That is ceding the sale.`,
          suggestedAction:
            "Review the flagged transcripts in Conversations. Tighten the system prompt to cover the top three unknowns instead of bouncing the visitor.",
          href: "/portal/conversations",
          dedupeKey: `chatbot_pattern:fallback:week:${weekKey}`,
          context: {
            fallbackRate: Math.round(fallbackRate * 1000) / 10,
            unsureFallbacks,
            totalAssistantMessages,
            conversationsScanned: conversations.length,
          },
        });
      }
    }

    return insights;
  },
};
