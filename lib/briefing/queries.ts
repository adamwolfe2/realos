import "server-only";
import { prisma } from "@/lib/db";
import { LeadStatus, LeadSource } from "@prisma/client";

// ---------------------------------------------------------------------------
// Command Center (/portal/briefing) query helpers.
//
// Every function is tenant-scoped on `orgId`. The point of this screen is to
// compress everything the operator needs to know into one glance — so we fan
// out a handful of narrow queries and let the page layout do the composition.
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;

export type CallPriorityLead = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  score: number;
  status: LeadStatus;
  source: LeadSource;
  lastActivityAt: Date;
  createdAt: Date;
  propertyId: string | null;
  propertyName: string | null;
  reason: "hot" | "stalled" | "new-high-score" | "recent-chatbot";
  priority: number;
};

/**
 * Rank leads by "who should the leasing team call first". Composition:
 *   - hot: high score, recent activity (<24h), not yet toured
 *   - stalled: NEW/CONTACTED, no activity 5+ days
 *   - new-high-score: created <48h, score >= 60, not yet called
 *   - recent-chatbot: has a ChatbotConversation in last 24h with lead captured
 *
 * Priority: 100 - daysSinceActivity + score/10, clamped.
 */
export async function getCallPriorityLeads(
  orgId: string,
  opts: { limit?: number; propertyId?: string | null } = {},
): Promise<CallPriorityLead[]> {
  const limit = opts.limit ?? 10;
  const propertyFilter = opts.propertyId ? { propertyId: opts.propertyId } : {};
  const now = new Date();
  const since24h = new Date(now.getTime() - DAY);
  const since48h = new Date(now.getTime() - 2 * DAY);
  const since5d = new Date(now.getTime() - 5 * DAY);

  const [hot, stalled, highScore] = await Promise.all([
    prisma.lead.findMany({
      where: {
        orgId,
        ...propertyFilter,
        status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED] },
        lastActivityAt: { gte: since24h },
        score: { gte: 50 },
      },
      orderBy: [{ score: "desc" }, { lastActivityAt: "desc" }],
      take: limit,
      include: { property: { select: { id: true, name: true } } },
    }),
    prisma.lead.findMany({
      where: {
        orgId,
        ...propertyFilter,
        status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED] },
        lastActivityAt: { lt: since5d },
      },
      orderBy: { lastActivityAt: "asc" },
      take: limit,
      include: { property: { select: { id: true, name: true } } },
    }),
    prisma.lead.findMany({
      where: {
        orgId,
        ...propertyFilter,
        createdAt: { gte: since48h },
        score: { gte: 60 },
        status: LeadStatus.NEW,
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: { property: { select: { id: true, name: true } } },
    }),
  ]);

  type SourceBucket = { reason: CallPriorityLead["reason"]; leads: typeof hot };
  const buckets: SourceBucket[] = [
    { reason: "hot", leads: hot },
    { reason: "stalled", leads: stalled },
    { reason: "new-high-score", leads: highScore },
  ];

  const merged = new Map<string, CallPriorityLead>();
  for (const { reason, leads } of buckets) {
    for (const l of leads) {
      if (merged.has(l.id)) continue;
      const daysSince = Math.max(
        0,
        Math.floor((now.getTime() - l.lastActivityAt.getTime()) / DAY),
      );
      let priority = 0;
      if (reason === "hot") priority = 100 + l.score / 10;
      else if (reason === "new-high-score") priority = 90 + l.score / 10;
      else if (reason === "stalled") priority = Math.max(30, 80 - daysSince);

      merged.set(l.id, {
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        phone: l.phone,
        score: l.score,
        status: l.status,
        source: l.source,
        lastActivityAt: l.lastActivityAt,
        createdAt: l.createdAt,
        propertyId: l.propertyId,
        propertyName: l.property?.name ?? null,
        reason,
        priority,
      });
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

export async function getTranscriptsWorthReading(
  orgId: string,
  opts: { limit?: number; propertyId?: string | null } = {},
) {
  const limit = opts.limit ?? 8;
  const propertyFilter = opts.propertyId ? { propertyId: opts.propertyId } : {};
  const since48h = new Date(Date.now() - 2 * DAY);

  const [flagged, recentWithLead, recent] = await Promise.all([
    prisma.chatbotConversation.findMany({
      where: {
        orgId,
        ...propertyFilter,
        flags: { some: { flag: { in: ["needs_prompt_tuning", "lead_high_intent", "handoff_missed"] } } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
      select: conversationSelect,
    }),
    prisma.chatbotConversation.findMany({
      where: {
        orgId,
        ...propertyFilter,
        lastMessageAt: { gte: since48h },
        capturedEmail: { not: null },
      },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
      select: conversationSelect,
    }),
    prisma.chatbotConversation.findMany({
      where: {
        orgId,
        ...propertyFilter,
        lastMessageAt: { gte: since48h },
        messageCount: { gte: 4 },
      },
      orderBy: { messageCount: "desc" },
      take: limit,
      select: conversationSelect,
    }),
  ]);

  const merged = new Map<string, (typeof flagged)[number]>();
  for (const c of [...flagged, ...recentWithLead, ...recent]) {
    if (!merged.has(c.id)) merged.set(c.id, c);
  }
  return Array.from(merged.values()).slice(0, limit);
}

const conversationSelect = {
  id: true,
  capturedName: true,
  capturedEmail: true,
  messageCount: true,
  lastMessageAt: true,
  messages: true,
  handedOffAt: true,
  property: { select: { id: true, name: true } },
  flags: { select: { flag: true } },
} as const;

export async function getSinceLastViewed(
  orgId: string,
  lastViewedAt: Date | null,
) {
  const since = lastViewedAt ?? new Date(Date.now() - 7 * DAY);
  const [newLeads, newInsights, newTours, newChats, newApplications] = await Promise.all([
    prisma.lead.count({ where: { orgId, createdAt: { gte: since } } }),
    prisma.insight.count({
      where: { orgId, createdAt: { gte: since }, status: { in: ["open", "acknowledged"] } },
    }),
    prisma.tour.count({ where: { lead: { orgId }, createdAt: { gte: since } } }),
    prisma.chatbotConversation.count({
      where: { orgId, createdAt: { gte: since }, capturedEmail: { not: null } },
    }),
    prisma.application.count({
      where: { lead: { orgId }, createdAt: { gte: since } },
    }),
  ]);
  return { since, newLeads, newInsights, newTours, newChats, newApplications };
}

export async function getBriefingMetrics(orgId: string) {
  const now = Date.now();
  const since7d = new Date(now - 7 * DAY);
  const since14d = new Date(now - 14 * DAY);

  const [
    curLeads,
    prevLeads,
    curTours,
    prevTours,
    adSpend,
    prevSpend,
    organic,
    prevOrganic,
    chats,
    prevChats,
    curApps,
    prevApps,
  ] = await Promise.all([
    prisma.lead.count({ where: { orgId, createdAt: { gte: since7d } } }),
    prisma.lead.count({ where: { orgId, createdAt: { gte: since14d, lt: since7d } } }),
    prisma.tour.count({ where: { lead: { orgId }, createdAt: { gte: since7d } } }),
    prisma.tour.count({ where: { lead: { orgId }, createdAt: { gte: since14d, lt: since7d } } }),
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: since7d } },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: since14d, lt: since7d } },
      _sum: { spendCents: true },
    }),
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: since7d } },
      _sum: { organicSessions: true },
    }),
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: since14d, lt: since7d } },
      _sum: { organicSessions: true },
    }),
    prisma.chatbotConversation.count({ where: { orgId, createdAt: { gte: since7d } } }),
    prisma.chatbotConversation.count({
      where: { orgId, createdAt: { gte: since14d, lt: since7d } },
    }),
    prisma.application.count({ where: { lead: { orgId }, createdAt: { gte: since7d } } }),
    prisma.application.count({ where: { lead: { orgId }, createdAt: { gte: since14d, lt: since7d } } }),
  ]);

  return {
    leads: { current: curLeads, previous: prevLeads, deltaPct: pct(curLeads, prevLeads) },
    tours: { current: curTours, previous: prevTours, deltaPct: pct(curTours, prevTours) },
    applications: { current: curApps, previous: prevApps, deltaPct: pct(curApps, prevApps) },
    adSpendUsd: {
      current: Math.round((adSpend._sum.spendCents ?? 0) / 100),
      previous: Math.round((prevSpend._sum.spendCents ?? 0) / 100),
      deltaPct: pct(adSpend._sum.spendCents ?? 0, prevSpend._sum.spendCents ?? 0),
    },
    organicSessions: {
      current: organic._sum.organicSessions ?? 0,
      previous: prevOrganic._sum.organicSessions ?? 0,
      deltaPct: pct(organic._sum.organicSessions ?? 0, prevOrganic._sum.organicSessions ?? 0),
    },
    chatbotConversations: {
      current: chats,
      previous: prevChats,
      deltaPct: pct(chats, prevChats),
    },
  };
}

const TERMINAL_LEAD_STATUSES = [
  LeadStatus.SIGNED,
  LeadStatus.LOST,
  LeadStatus.UNQUALIFIED,
];

export async function getAgingLeadsSummary(orgId: string): Promise<{
  fresh: number;
  aging: number;
  stale: number;
}> {
  const activeLeads = await prisma.lead.findMany({
    where: {
      orgId,
      status: { notIn: TERMINAL_LEAD_STATUSES },
    },
    select: { createdAt: true },
  });

  const now = Date.now();
  let fresh = 0;
  let aging = 0;
  let stale = 0;

  for (const { createdAt } of activeLeads) {
    const days = Math.floor((now - createdAt.getTime()) / 86_400_000);
    if (days < 7) fresh += 1;
    else if (days < 15) aging += 1;
    else stale += 1;
  }

  return { fresh, aging, stale };
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}
