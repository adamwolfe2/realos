import { prisma } from "@/lib/db";
import { unansweredQuestions } from "@/lib/portal/property-cockpit";
import { measureWindow, type Measured, type MetricKey, type Proposal } from "@/lib/self-improve/proposal";

// The metric each proposal should move, read from the same rows the
// cockpit shows: chats the bot couldn't answer, pop-up conversion, website
// leads. One read per metric per window; windows are equal length.

type Target = { orgId: string; propertyId: string | null; campaignId?: string };
type Value = { value: number; of: number | null };

export async function metricValue(key: MetricKey, t: Target, from: Date, to: Date): Promise<Value> {
  const span = { gte: from, lt: to };
  if (key === "unanswered") {
    // ponytail: newest 1000 chats per window; a property past that needs
    // the no-answer flag stored at write time.
    const convs = await prisma.chatbotConversation.findMany({
      where: { orgId: t.orgId, propertyId: t.propertyId, createdAt: span },
      select: { messages: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return { value: convs.filter((c) => unansweredQuestions(c.messages).length > 0).length, of: convs.length };
  }
  if (key === "popup_conversion") {
    if (!t.campaignId) return { value: 0, of: 0 };
    const rows = await prisma.popupEvent.groupBy({
      by: ["type"],
      where: { orgId: t.orgId, campaignId: t.campaignId, occurredAt: span, type: { in: ["SHOWN", "CONVERTED"] } },
      _count: { _all: true },
    });
    const n = (type: string) => rows.find((r) => r.type === type)?._count._all ?? 0;
    return { value: n("CONVERTED"), of: n("SHOWN") };
  }
  // AppFolio-imported applicants are applications, not website leads.
  const value = await prisma.lead.count({
    where: { orgId: t.orgId, propertyId: t.propertyId, createdAt: span, OR: [{ externalSystem: null }, { externalSystem: { not: "appfolio" } }] },
  });
  return { value, of: null };
}

export type ProposalImpact = { kind: "too_early"; daysLive: number } | ({ kind: "measured" } & Measured);

/** Before/after for an approved proposal; equal windows either side of approval. */
export async function proposalImpact(
  p: Proposal,
  row: { orgId: string; propertyId: string | null; appliedAt: Date | null },
  now = new Date(),
): Promise<ProposalImpact | null> {
  if (!row.appliedAt) return null;
  const { daysLive, window: w } = measureWindow(row.appliedAt, now);
  if (!w) return { kind: "too_early", daysLive: Math.max(0, daysLive) };
  const t = { orgId: row.orgId, propertyId: row.propertyId, campaignId: p.popup?.campaignId };
  const [before, after] = await Promise.all([
    metricValue(p.metric.key, t, w.start, w.appliedAt),
    metricValue(p.metric.key, t, w.appliedAt, w.end),
  ]);
  return { kind: "measured", key: p.metric.key, days: w.days, before, after };
}
