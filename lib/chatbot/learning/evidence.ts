import { prisma } from "@/lib/db";

// The real conversations behind a suggested fix. Fixes store sourceCaseIds;
// each learning case points at the conversation it was learned from. This
// turns those ids into "what the renter asked / what the bot said" excerpts
// so the operator can see why the fix exists.

export type FixEvidence = {
  conversationId: string;
  visitorName: string | null;
  propertyName: string | null;
  question: string;
  reply: string | null;
};

type Msg = { role?: unknown; content?: unknown };

/** First renter question and the bot reply right after it. */
export function excerptExchange(messages: unknown): { question: string; reply: string | null } | null {
  if (!Array.isArray(messages)) return null;
  const list = messages as Msg[];
  const qi = list.findIndex((m) => m?.role === "user" && typeof m.content === "string" && m.content.trim());
  if (qi === -1) return null;
  const next = list.slice(qi + 1).find((m) => m?.role === "assistant" && typeof m.content === "string");
  return {
    question: String(list[qi].content).trim(),
    reply: next ? String(next.content).trim() : null,
  };
}

/** Evidence per case id (cases without a readable conversation are skipped). */
export async function loadFixEvidence(orgId: string, caseIds: string[]): Promise<Map<string, FixEvidence>> {
  const out = new Map<string, FixEvidence>();
  if (caseIds.length === 0) return out;
  const cases = await prisma.chatbotLearningCase.findMany({
    where: { orgId, id: { in: caseIds }, conversationId: { not: null } },
    select: {
      id: true,
      conversation: {
        select: { id: true, capturedName: true, messages: true, property: { select: { name: true } } },
      },
    },
  });
  for (const c of cases) {
    if (!c.conversation) continue;
    const ex = excerptExchange(c.conversation.messages);
    if (!ex) continue;
    out.set(c.id, {
      conversationId: c.conversation.id,
      visitorName: c.conversation.capturedName,
      propertyName: c.conversation.property?.name ?? null,
      ...ex,
    });
  }
  return out;
}
