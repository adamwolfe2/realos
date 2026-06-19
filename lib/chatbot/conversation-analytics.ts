import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Chatbot conversation analytics — aggregate signal over raw transcripts so
// operators can see WHAT prospects ask, capture-rate trends, and top topics for
// reports. Pure derivation from existing ChatbotConversation data: no schema
// change, no AI cost. Keyword/question extraction is heuristic (frequency over
// user-typed text + the opening question), which is cheap and deterministic; an
// AI topic layer can be added later on top of the same shape.
// ---------------------------------------------------------------------------

type StoredMessage = { role?: string; content?: string; ts?: string };

export type ChatbotAnalytics = {
  periodDays: number;
  totals: {
    conversations: number; // in period
    lifetimeConversations: number;
    leadsCaptured: number; // in period
    captureRatePct: number; // leadsCaptured / conversations
    avgMessages: number;
    needsTuning: number; // flagged needs_prompt_tuning (lifetime)
  };
  trend: Array<{ date: string; conversations: number; captures: number }>;
  topKeywords: Array<{ term: string; count: number }>;
  topQuestions: Array<{ question: string; count: number }>;
};

// Common English + leasing-domain filler that carries no topical signal.
const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","is","are","am","was","were","be",
  "been","being","to","of","in","on","at","for","with","about","as","by","from",
  "i","you","we","they","he","she","it","me","my","your","our","their","this",
  "that","these","those","do","does","did","can","could","would","should","will",
  "have","has","had","not","no","yes","so","just","get","got","there","here",
  "what","when","where","which","who","how","why","any","some","more","much",
  "want","like","need","looking","hi","hello","hey","please","thanks","thank",
  "im","i'm","its","it's","u","ur","ok","okay","also","out","up","down","into",
  // Email/contact noise — prospects paste addresses into the chat, which would
  // otherwise rank "gmail"/"com" as top "topics".
  "gmail","com","yahoo","outlook","hotmail","icloud","mail","www","http","https",
]);

// First message a prospect actually typed — the question that opened the chat.
export function extractFirstUserMessage(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  for (const m of messages as StoredMessage[]) {
    if (m && m.role === "user" && typeof m.content === "string") {
      const t = m.content.trim();
      if (t) return t;
    }
  }
  return null;
}

// All user-typed text in a conversation, for keyword frequency.
export function extractUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  return (messages as StoredMessage[])
    .filter((m) => m && m.role === "user" && typeof m.content === "string")
    .map((m) => m.content as string)
    .join(" ");
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

export function topKeywords(
  texts: string[],
  limit = 15,
): Array<{ term: string; count: number }> {
  const counts = new Map<string, number>();
  for (const text of texts) {
    // Count each keyword once per conversation so one chatty visitor can't
    // dominate the ranking.
    const seen = new Set(tokenize(text));
    for (const term of seen) counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

// Normalize a question so near-duplicates collapse ("What's included?" ==
// "what is included") while we still surface a readable verbatim form.
function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function topQuestions(
  firstMessages: string[],
  limit = 10,
): Array<{ question: string; count: number }> {
  const groups = new Map<string, { display: string; count: number }>();
  for (const raw of firstMessages) {
    const q = raw.trim();
    if (q.length < 4 || q.length > 160) continue; // skip noise + essays
    const key = normalizeQuestion(q);
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { display: q, count: 1 });
  }
  return [...groups.values()]
    .map((g) => ({ question: g.display, count: g.count }))
    .sort((a, b) => b.count - a.count || a.question.localeCompare(b.question))
    .slice(0, limit);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getChatbotAnalytics(params: {
  orgId: string;
  propertyWhere?: Prisma.ChatbotConversationWhereInput;
  periodDays?: number;
}): Promise<ChatbotAnalytics> {
  const periodDays = params.periodDays ?? 30;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const scopeWhere: Prisma.ChatbotConversationWhereInput = {
    orgId: params.orgId,
    ...(params.propertyWhere ?? {}),
  };
  const periodWhere: Prisma.ChatbotConversationWhereInput = {
    ...scopeWhere,
    createdAt: { gte: since },
  };

  const [lifetimeConversations, periodConvos, needsTuning] = await Promise.all([
    prisma.chatbotConversation.count({ where: scopeWhere }),
    prisma.chatbotConversation.findMany({
      where: periodWhere,
      select: {
        messages: true,
        messageCount: true,
        leadId: true,
        capturedEmail: true,
        createdAt: true,
      },
      // Hard cap so a huge tenant can't blow the request. Order by recency so
      // the cap deterministically keeps the most-recent conversations (the ones
      // that matter for "what are people asking now").
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.conversationFlag.count({
      // Scope the flag count to the same properties as everything else so the
      // tile stays consistent when a property filter is applied.
      where: {
        orgId: params.orgId,
        flag: "needs_prompt_tuning",
        ...(params.propertyWhere
          ? { conversation: { is: params.propertyWhere } }
          : {}),
      },
    }),
  ]);

  const conversations = periodConvos.length;
  let leadsCaptured = 0;
  let messageSum = 0;
  const firstMessages: string[] = [];
  const userTexts: string[] = [];
  const byDay = new Map<string, { conversations: number; captures: number }>();

  for (const c of periodConvos) {
    const captured = !!c.leadId || !!c.capturedEmail;
    if (captured) leadsCaptured += 1;
    messageSum += c.messageCount ?? 0;
    const first = extractFirstUserMessage(c.messages);
    if (first) firstMessages.push(first);
    userTexts.push(extractUserText(c.messages));
    const key = dayKey(c.createdAt);
    const bucket = byDay.get(key) ?? { conversations: 0, captures: 0 };
    bucket.conversations += 1;
    if (captured) bucket.captures += 1;
    byDay.set(key, bucket);
  }

  // Dense daily series across the whole window (zero-fill gaps for the chart).
  const trend: ChatbotAnalytics["trend"] = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = dayKey(d);
    const bucket = byDay.get(key) ?? { conversations: 0, captures: 0 };
    trend.push({
      date: key,
      conversations: bucket.conversations,
      captures: bucket.captures,
    });
  }

  return {
    periodDays,
    totals: {
      conversations,
      lifetimeConversations,
      leadsCaptured,
      captureRatePct:
        conversations > 0 ? Math.round((leadsCaptured / conversations) * 100) : 0,
      avgMessages:
        conversations > 0 ? Math.round((messageSum / conversations) * 10) / 10 : 0,
      needsTuning,
    },
    trend,
    topKeywords: topKeywords(userTexts),
    topQuestions: topQuestions(firstMessages),
  };
}
