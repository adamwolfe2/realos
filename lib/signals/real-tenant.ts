import "server-only";

import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  COMPUTE_VERSION,
  scopeKey,
  type AeoSignal,
  type ChatbotSignal,
  type LeadsSignal,
  type ReputationSignal,
  type SeoSignal,
  type SignalSnapshot,
  type TenantScope,
  type TrafficSignal,
} from "./types";
import { loadPortfolioReputationMetrics } from "@/lib/reputation/portfolio";
import {
  getChatbotSummary,
  getLeadStatusCounts,
  getOrganicSessionsKpi,
} from "@/lib/dashboard/queries";

// ----------------------------------------------------------------------------
// computeRealTenantSignals — the production tenant snapshot. Replaces the old
// mock generator. EVERY number here comes from a real table; a signal section
// is returned `null` (honest "not connected / no data yet" state in the UI)
// when the underlying data genuinely doesn't exist — never fabricated.
//
// Data sources:
//   reputation → loadPortfolioReputationMetrics() + PropertyMention
//   leads      → Lead + getLeadStatusCounts()
//   chatbot    → getChatbotSummary() + ChatbotConversation aggregates
//   traffic    → getOrganicSessionsKpi() (GA4-gated) + SeoLandingPage
//   seo        → RankedKeyword + SeoSnapshot (GSC) + BacklinkSummary
//   aeo        → AeoCitationCheck
// ----------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const QUALIFIED_STATUSES: LeadStatus[] = [
  LeadStatus.TOUR_SCHEDULED,
  LeadStatus.TOURED,
  LeadStatus.APPLICATION_SENT,
  LeadStatus.APPLIED,
  LeadStatus.APPROVED,
  LeadStatus.SIGNED,
];

// Sistrix-derived CTR-by-position (multifamily-adjusted) — same table the
// prospect path uses so tenant + prospect traffic estimates stay comparable.
const CTR_BY_POSITION: Record<number, number> = {
  1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.07,
  6: 0.05, 7: 0.04, 8: 0.03, 9: 0.025, 10: 0.02,
};
function ctrFor(position: number): number {
  if (position <= 0) return 0;
  if (position <= 10) return CTR_BY_POSITION[position] ?? 0.02;
  if (position <= 20) return 0.012;
  if (position <= 30) return 0.005;
  return 0.001;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
function todayUtcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function computeRealTenantSignals(
  scope: TenantScope,
): Promise<SignalSnapshot> {
  const startedAt = Date.now();
  const { orgId } = scope;
  const since7d = new Date(Date.now() - 7 * DAY_MS);
  const since28d = new Date(Date.now() - 28 * DAY_MS);
  const since30d = new Date(Date.now() - 30 * DAY_MS);

  const [reputation, leads, chatbot, traffic, seo, aeo] = await Promise.all([
    buildReputation(orgId, since7d),
    buildLeads(orgId, since28d),
    buildChatbot(orgId, since28d),
    buildTraffic(orgId, since28d),
    buildSeo(orgId),
    buildAeo(orgId, since30d),
  ]);

  const overallScore = weightedOverall({ seo, aeo, reputation, chatbot, leads, traffic });

  return {
    capturedOn: todayUtcDateString(),
    scopeKey: scopeKey(scope),
    seo,
    aeo,
    reputation,
    chatbot,
    leads,
    traffic,
    overallScore,
    // Deltas need a prior persisted snapshot to diff against; the persist
    // layer can backfill these once a 7-day history exists. Honest null
    // until then rather than a fabricated movement.
    deltas7d: null,
    computeMs: Date.now() - startedAt,
    computeVersion: COMPUTE_VERSION,
  };
}

// --- Reputation -------------------------------------------------------------
async function buildReputation(
  orgId: string,
  since7d: Date,
): Promise<ReputationSignal | null> {
  const [metrics, newNegative7d, recent] = await Promise.all([
    loadPortfolioReputationMetrics(orgId).catch(() => null),
    prisma.propertyMention
      .count({ where: { orgId, sentiment: "NEGATIVE", createdAt: { gte: since7d } } })
      .catch(() => 0),
    prisma.propertyMention
      .findMany({
        where: { orgId },
        select: { topics: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
      .catch(() => [] as Array<{ topics: unknown }>),
  ]);

  if (!metrics) return null;
  const hasData = metrics.totalMentions > 0 || metrics.googleReviewCount > 0;
  if (!hasData) return null;

  // Sentiment mix from the classified breakdown (MIXED folds into neutral).
  let pos = 0,
    neu = 0,
    neg = 0;
  for (const s of metrics.sentimentBreakdown) {
    if (s.sentiment === "POSITIVE") pos += s.count;
    else if (s.sentiment === "NEGATIVE") neg += s.count;
    else if (s.sentiment === "NEUTRAL" || s.sentiment === "MIXED") neu += s.count;
  }
  const classified = pos + neu + neg;
  const sentimentMix =
    classified > 0
      ? {
          positive: round(pos / classified, 2),
          neutral: round(neu / classified, 2),
          negative: round(neg / classified, 2),
        }
      : { positive: 0, neutral: 1, negative: 0 };

  // Top themes — flatten the `topics` arrays from recent mentions, count, top 4.
  const themeCounts = new Map<string, number>();
  for (const m of recent) {
    if (!Array.isArray(m.topics)) continue;
    for (const t of m.topics) {
      if (typeof t !== "string") continue;
      const key = t.toLowerCase();
      themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1);
    }
  }
  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => t);

  // Score: rating-anchored when reviews exist, sentiment-adjusted.
  let score: number;
  if (metrics.googleAvgRating != null) {
    score = (metrics.googleAvgRating / 5) * 100;
    score += sentimentMix.positive * 10 - sentimentMix.negative * 25;
  } else {
    score = 70 + sentimentMix.positive * 30 - sentimentMix.negative * 60;
  }

  return {
    totalMentions: metrics.totalMentions,
    avgRating: metrics.googleAvgRating,
    sentimentMix,
    newNegative7d,
    topThemes,
    score: clampScore(score),
  };
}

// --- Leads ------------------------------------------------------------------
async function buildLeads(
  orgId: string,
  since28d: Date,
): Promise<LeadsSignal | null> {
  const [newLeads, statusCounts] = await Promise.all([
    prisma.lead.count({ where: { orgId, createdAt: { gte: since28d } } }),
    getLeadStatusCounts(orgId).catch(() => new Map<LeadStatus, number>()),
  ]);

  let total = 0;
  for (const v of statusCounts.values()) total += v;
  if (total === 0 && newLeads === 0) return null;

  const qualified = QUALIFIED_STATUSES.reduce(
    (acc, s) => acc + (statusCounts.get(s) ?? 0),
    0,
  );
  const signed = statusCounts.get(LeadStatus.SIGNED) ?? 0;
  const conversionRate = total > 0 ? round(signed / total, 2) : 0;

  // Score: pipeline shape — reward qualified ratio + signed conversion.
  const qualifiedRatio = total > 0 ? qualified / total : 0;
  const score = clampScore(35 + qualifiedRatio * 45 + conversionRate * 120);

  return {
    newLeads,
    qualified,
    // No per-lead dollar value or attributed ad spend in the schema today —
    // honest nulls/zero rather than an invented number.
    cpl: null,
    conversionRate,
    pipelineValue: 0,
    score,
  };
}

// --- Chatbot ----------------------------------------------------------------
async function buildChatbot(
  orgId: string,
  since28d: Date,
): Promise<ChatbotSignal | null> {
  const [summary, agg, engagedCount] = await Promise.all([
    getChatbotSummary(orgId).catch(() => null),
    prisma.chatbotConversation
      .aggregate({
        _avg: { messageCount: true },
        where: { orgId, createdAt: { gte: since28d } },
      })
      .catch(() => ({ _avg: { messageCount: null } })),
    prisma.chatbotConversation
      .count({
        where: { orgId, createdAt: { gte: since28d }, messageCount: { gte: 3 } },
      })
      .catch(() => 0),
  ]);

  if (!summary || summary.conversations28d === 0) return null;

  const conversations = summary.conversations28d;
  const engagedRate = round(engagedCount / conversations, 2);
  const leadConversion = round(summary.leadsCaptured28d / conversations, 2);
  const avgMessages = round(agg._avg.messageCount ?? 0, 1);
  const score = clampScore(35 + leadConversion * 160 + engagedRate * 25);

  return { conversations, engagedRate, avgMessages, leadConversion, score };
}

// --- Traffic ----------------------------------------------------------------
async function buildTraffic(
  orgId: string,
  since28d: Date,
): Promise<TrafficSignal | null> {
  const kpi = await getOrganicSessionsKpi(orgId).catch(() => null);
  if (!kpi || kpi.sessions <= 0) return null;

  const pages = await prisma.seoLandingPage
    .findMany({
      where: { orgId, date: { gte: since28d } },
      select: { url: true, sessions: true, bounceRate: true },
      orderBy: { sessions: "desc" },
      take: 5,
    })
    .catch(() => [] as Array<{ url: string; sessions: number; bounceRate: number }>);

  const topPages = pages.map((p) => ({ url: p.url, visits: p.sessions }));
  const bounceVals = pages.map((p) => p.bounceRate).filter((b) => b > 0);
  const bounceRate =
    bounceVals.length > 0
      ? round(bounceVals.reduce((a, b) => a + b, 0) / bounceVals.length, 2)
      : null;

  let score = 30;
  if (kpi.sessions > 10_000) score = 90;
  else if (kpi.sessions > 1_000) score = 70;
  else if (kpi.sessions > 100) score = 50;

  return {
    sessions: kpi.sessions,
    source: "ga",
    bounceRate,
    topPages,
    score: clampScore(score),
  };
}

// --- SEO --------------------------------------------------------------------
async function buildSeo(orgId: string): Promise<SeoSignal | null> {
  const [latestKw, gsc, backlinks] = await Promise.all([
    prisma.rankedKeyword
      .findFirst({ where: { orgId }, orderBy: { date: "desc" }, select: { date: true } })
      .catch(() => null),
    prisma.seoSnapshot
      .findFirst({ where: { orgId }, orderBy: { date: "desc" } })
      .catch(() => null),
    prisma.backlinkSummary
      .findFirst({ where: { orgId }, orderBy: { date: "desc" } })
      .catch(() => null),
  ]);

  let organicKeywords = 0;
  let top10Count = 0;
  let avgPosition: number | null = null;
  let estimatedTraffic = 0;

  if (latestKw) {
    const kws = await prisma.rankedKeyword
      .findMany({
        where: { orgId, date: latestKw.date },
        select: { position: true, searchVolume: true },
      })
      .catch(() => [] as Array<{ position: number; searchVolume: number | null }>);
    organicKeywords = kws.length;
    top10Count = kws.filter((k) => k.position <= 10).length;
    const positions = kws.map((k) => k.position).filter((p) => p > 0);
    avgPosition =
      positions.length > 0
        ? round(positions.reduce((a, b) => a + b, 0) / positions.length, 1)
        : null;
    estimatedTraffic = Math.round(
      kws.reduce((acc, k) => acc + (k.searchVolume ?? 0) * ctrFor(k.position), 0),
    );
  }

  // GSC weighted position is a real signal even when DataForSEO Labs hasn't
  // indexed the (often brand-new) property domain yet.
  if (avgPosition == null && gsc && gsc.avgPosition > 0) {
    avgPosition = round(gsc.avgPosition, 1);
  }

  const hasData = organicKeywords > 0 || (gsc != null && gsc.totalImpressions > 0);
  if (!hasData) return null;

  // Score from the real components we have. Graded so a genuine mid-pack
  // property (ranks for many terms at middling positions) reads as "room to
  // grow", not "broken". Each part contributes only when its data is present.
  const parts: number[] = [];
  // SERP position — gentle slope: pos 1→100, 10→~80, 20→~58, 30→~36.
  if (avgPosition != null) parts.push(clampScore(100 - (avgPosition - 1) * 2.2));
  // Keyword breadth — ranking for many terms is real organic visibility.
  if (organicKeywords > 0) {
    parts.push(
      organicKeywords >= 200
        ? 90
        : organicKeywords >= 100
          ? 75
          : organicKeywords >= 50
            ? 60
            : organicKeywords >= 20
              ? 45
              : 30,
    );
  }
  // Share of top-10 placements.
  if (organicKeywords > 0)
    parts.push(clampScore((top10Count / organicKeywords) * 300));
  if (backlinks) {
    const rd = backlinks.referringDomains ?? 0;
    parts.push(rd >= 100 ? 85 : rd >= 30 ? 70 : rd >= 10 ? 55 : 40);
  }
  const score =
    parts.length > 0
      ? clampScore(parts.reduce((a, b) => a + b, 0) / parts.length)
      : 50;

  return {
    organicKeywords,
    top10Count,
    avgPosition,
    estimatedTraffic,
    lighthouseScore: null,
    backlinks: backlinks?.backlinks ?? 0,
    referringDomains: backlinks?.referringDomains ?? 0,
    topMovers: [],
    score,
  };
}

// --- AEO --------------------------------------------------------------------
async function buildAeo(orgId: string, since30d: Date): Promise<AeoSignal | null> {
  const checks = await prisma.aeoCitationCheck
    .findMany({
      where: { orgId, queryRunAt: { gte: since30d } },
      select: { engine: true, status: true, citedUrl: true },
    })
    .catch(() => [] as Array<{ engine: string; status: string; citedUrl: string | null }>);

  if (checks.length === 0) return null;

  const engineKey: Record<string, keyof AeoSignal["byEngine"]> = {
    CLAUDE: "claude",
    CHATGPT: "chatgpt",
    GEMINI: "gemini",
    PERPLEXITY: "perplexity",
  };
  const byEngine: AeoSignal["byEngine"] = {};
  for (const [enumName, key] of Object.entries(engineKey)) {
    const rows = checks.filter((c) => c.engine === enumName);
    if (rows.length === 0) continue;
    const cited = rows.some((c) => c.status === "CITED");
    const sources = rows
      .filter((c) => c.citedUrl)
      .map((c) => c.citedUrl as string);
    byEngine[key] = { cited, sources: [...new Set(sources)] };
  }

  const enginesChecked = Object.keys(byEngine).length;
  if (enginesChecked === 0) return null;
  const citationsFound = Object.values(byEngine).filter((e) => e?.cited).length;
  const citationRate = round(citationsFound / enginesChecked, 2);
  const score = clampScore(20 + citationRate * 80);

  return { enginesChecked, citationsFound, citationRate, byEngine, score };
}

// --- Overall ----------------------------------------------------------------
const SECTION_WEIGHTS = {
  seo: 30,
  aeo: 20,
  reputation: 20,
  chatbot: 10,
  leads: 15,
  traffic: 5,
} as const;

function weightedOverall(s: {
  seo: SeoSignal | null;
  aeo: AeoSignal | null;
  reputation: ReputationSignal | null;
  chatbot: ChatbotSignal | null;
  leads: LeadsSignal | null;
  traffic: TrafficSignal | null;
}): number {
  let weight = 0;
  let acc = 0;
  for (const k of Object.keys(SECTION_WEIGHTS) as Array<keyof typeof SECTION_WEIGHTS>) {
    const section = s[k];
    if (!section) continue;
    acc += section.score * SECTION_WEIGHTS[k];
    weight += SECTION_WEIGHTS[k];
  }
  return weight === 0 ? 0 : Math.round(acc / weight);
}
