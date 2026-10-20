import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// "What prospects are asking" — topic counts + a few recent questions, read
// from chatbot transcripts in the report window. Deterministic keyword
// themes (no LLM): the same transcripts always produce the same report.
// ---------------------------------------------------------------------------

export type ReportProspectQuestions = {
  conversations: number; // conversations with at least one visitor message
  themes: Array<{ label: string; count: number }>; // desc, count > 0
  examples: string[]; // most recent first, PII-filtered
};

const THEMES: Array<{ label: string; re: RegExp }> = [
  { label: "Availability", re: /availab|vacan|anything open|still open|units? left/ },
  { label: "Room types & roommates", re: /single|double|triple|studio|roommate|bedroom|private room|share/ },
  { label: "Pricing", re: /price|pricing|cost|how much|cheap|budget|rent is|\$\d/ },
  { label: "What's included", re: /includ|utilit|wifi|furnish|amenit/ },
  { label: "Lease length & short-term", re: /semester|short.?term|month lease|lease length|how long|sublet/ },
  { label: "Move-in timing", re: /move.?in|spring|january|august|september|fall 20/ },
  { label: "Tours & photos", re: /tour|visit|video|virtual|photo|picture/ },
  { label: "Applying", re: /apply|application|approv|guarantor|income|credit/ },
  { label: "International students", re: /international|ssn|passport|visa|f-1/ },
  { label: "Location & transit", re: /campus|walk|distance|close to|transit|bart|bus|shuttle/ },
  { label: "Bathrooms & kitchen", re: /bathroom|shower|toilet|kitchen|laundry/ },
  { label: "Parking & pets", re: /parking|\bcar\b|\bpets?\b|\bdogs?\b|\bcats?\b/ },
];

type Msg = { role?: unknown; content?: unknown };

function visitorText(messages: unknown): string[] {
  if (!Array.isArray(messages)) return [];
  return (messages as Msg[])
    .filter((m) => m?.role === "user" && typeof m.content === "string")
    .map((m) => (m.content as string).trim());
}

// A question is quotable only if it carries no contact details or dollar
// amounts and reads
// as a real question (quick-reply chips like "Current availability" are
// not quotes).
export function isQuotable(text: string): boolean {
  if (text.length < 25 || text.length > 160) return false;
  if (/@|https?:\/\//i.test(text)) return false;
  if (/\d[\d\s().-]{6,}\d/.test(text)) return false; // phone-like
  if (/\$\s?\d/.test(text)) return false; // quoted prices go stale in a report
  return /\?\s*$/.test(text);
}

export function summarizeProspectQuestions(
  transcripts: Array<{ createdAt: Date; messages: unknown }>,
): ReportProspectQuestions {
  const counts = new Map<string, number>();
  const examples: Array<{ at: number; text: string }> = [];
  let conversations = 0;
  for (const t of transcripts) {
    const msgs = visitorText(t.messages);
    if (msgs.length === 0) continue;
    conversations += 1;
    const all = msgs.join(" ").toLowerCase();
    for (const theme of THEMES) {
      if (theme.re.test(all)) counts.set(theme.label, (counts.get(theme.label) ?? 0) + 1);
    }
    const quote = msgs.find(isQuotable);
    if (quote) examples.push({ at: t.createdAt.getTime(), text: quote });
  }
  return {
    conversations,
    themes: [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    examples: examples
      .sort((a, b) => b.at - a.at)
      .slice(0, 4)
      .map((e) => e.text),
  };
}

export async function buildProspectQuestions(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
): Promise<ReportProspectQuestions | undefined> {
  // Same launched-building gate as the other chatbot stats in the report.
  const propertyClause = propertyId
    ? { propertyId }
    : { OR: [{ propertyId: null }, { property: { lifecycle: "ACTIVE" as const } }] };
  const rows = await prisma.chatbotConversation.findMany({
    where: {
      orgId,
      ...propertyClause,
      createdAt: { gte: periodStart, lt: periodEnd },
      messageCount: { gt: 0 },
    },
    select: { createdAt: true, messages: true },
    orderBy: { createdAt: "desc" },
    take: 2000, // ponytail: cap scan per report; paginate if a tenant exceeds this
  });
  const summary = summarizeProspectQuestions(rows);
  return summary.conversations > 0 ? summary : undefined;
}
