import "server-only";
import { prisma } from "@/lib/db";
import {
  AdPlatform,
  ApplicationStatus,
  ChatbotConversationStatus,
  LeadSource,
  LeadStatus,
  LeaseStatus,
  MentionSource,
  Prisma,
  ResidentStatus,
  Sentiment,
  TourStatus,
  VisitorIdentificationStatus,
} from "@prisma/client";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildPropertyUrlPatterns } from "@/lib/properties/queries";

// ---------------------------------------------------------------------------
// Report snapshot generator.
//
// Produces a frozen, serializable payload that captures every number shown on
// a weekly or monthly client report. Once stored on ClientReport.snapshot the
// view never recomputes, so operators can edit a headline in March without
// the numbers shifting underneath them.
//
// All queries here are tenant-scoped on orgId and parallel-safe: the public
// entry point fans them out via Promise.all.
// ---------------------------------------------------------------------------

export type ReportKind = "weekly" | "monthly" | "custom";

export type ReportKpis = {
  leads: number;
  tours: number;
  applications: number;
  costPerLead: number | null;
  adSpendUsd: number;
  organicSessions: number;
};

export type ReportKpiDeltas = {
  leadsPct: number | null;
  toursPct: number | null;
  applicationsPct: number | null;
  costPerLeadPct: number | null;
  adSpendUsdPct: number | null;
  organicSessionsPct: number | null;
};

export type ReportFunnelStage = { stage: string; count: number };

export type ReportLeadSource = {
  source: string;
  count: number;
  pct: number;
};

export type ReportAdRow = {
  platform: string;
  spendUsd: number;
  leads: number;
  cpl: number | null;
  conversionRate: number | null;
};

export type ReportTopPage = {
  url: string;
  sessions: number;
  clicks: number;
};

export type ReportTopQuery = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type ReportInsight = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
};

export type ReportChatbotStats = {
  conversations: number;
  leadsFromChat: number;
  avgMessageCount: number;
};

export type ReportPropertyRow = {
  id: string;
  name: string;
  leads: number;
  occupancyPct: number | null;
};

export type AiActionItem = {
  priority: "high" | "medium" | "low";
  title: string;
  observation: string;
  action: string;
};

export type AiAnalysis = {
  summary: string;
  actions: AiActionItem[];
};

export type ReportAttributionRow = {
  source: string;
  leads: number;
  tours: number;
  applications: number;
  signed: number;
};

export type ReportAiVisibility = {
  brandedClicks: number;
  brandedImpressions: number;
  brandedShare: number; // pct of total clicks that are branded (0-100)
  topBrandedTerms: string[];
};

// ---------------------------------------------------------------------------
// Reputation, occupancy, renewals, visitor stats — added in the 2026 report
// upgrade so the monthly client report reflects everything the operator
// dashboard now tracks. All sections render gracefully when the underlying
// data is empty (new tenants, no reviews yet, etc.).
// ---------------------------------------------------------------------------

export type ReportReputationSourceRow = {
  source: string;
  count: number;
  rating: number | null;
};

export type ReportReputationMention = {
  id: string;
  source: string;
  rating: number | null;
  title: string | null;
  excerpt: string;
  authorName: string | null;
  publishedAt: string | null;
  sourceUrl: string;
  sentiment: string | null;
  topics: string[] | null;
  flagged: boolean;
};

export type ReportReputationStats = {
  overallRating: number | null;
  totalReviews: number;
  newInPeriod: number;
  newInPeriodPct: number | null;
  positiveCount: number;
  negativeCount: number;
  responseRatePct: number | null;
  sourceBreakdown: ReportReputationSourceRow[];
  // Recent: chronological feed (last 12 in window)
  // Highlights: positive 5★ / sentiment=POSITIVE
  // Concerns:  negative reviews + sentiment=NEGATIVE/MIXED
  // Curated splits make the report scannable: highlights for the
  // marketing brag, concerns for the action list, recent for context.
  topMentions: ReportReputationMention[]; // legacy alias kept for older snapshots; mirrors `recent`
  recent: ReportReputationMention[];
  highlights: ReportReputationMention[];
  concerns: ReportReputationMention[];
};

export type ReportOccupancyStats = {
  totalUnits: number;
  leasedUnits: number;
  availableUnits: number;
  occupancyPct: number | null;
  onNotice: number;
  applicationsQueued: number;
  monthlyRentRollUsd: number;
  avgRentPerUnitUsd: number | null;
};

export type ReportRenewalStats = {
  activeLeases: number;
  expiringNext120: number;
  expiringNext30: number;
  expiringNext60: number;
  monthlyAtRiskUsd: number;
  pastDueCount: number;
  pastDueBalanceUsd: number;
};

export type ReportVisitorStats = {
  identifiedVisitors: number;
  identifiedNewInPeriod: number;
  withEmail: number;
  withPhone: number;
  identifiedWithLead: number;
  // Trend of *new* identifications per day across the period.
  identifiedTrend: number[];
};

export type ReportChatbotStatsExtended = ReportChatbotStats & {
  capturedRatePct: number | null;
  // Conversations that flipped to status=LEAD_CAPTURED in this window.
  capturedConversations: number;
};

// Persisted scope context so the rendered view can label which slice of
// the portfolio the snapshot represents.
export type ReportScope = {
  propertyId: string | null;
  propertyName: string | null;
  propertySlug: string | null;
};

export type ReportSnapshot = {
  kind: ReportKind;
  // Optional on legacy snapshots (will be undefined for reports created
  // before this field shipped). Older rows continue to render as
  // org-wide because the absence of scope == portfolio-wide.
  scope?: ReportScope;
  periodStart: string;
  periodEnd: string;
  kpis: ReportKpis;
  kpiDeltas: ReportKpiDeltas;
  funnel: ReportFunnelStage[];
  leadSources: ReportLeadSource[];
  adPerformance: ReportAdRow[];
  topPages: ReportTopPage[];
  topQueries: ReportTopQuery[];
  insights: ReportInsight[];
  chatbotStats: ReportChatbotStats;
  // Optional extended chatbot block. Old snapshots stored before the upgrade
  // won't have this; the view falls back to chatbotStats in that case.
  chatbotStatsExtended?: ReportChatbotStatsExtended;
  properties: ReportPropertyRow[];
  trafficTrend: number[];
  attributionBySource: ReportAttributionRow[];
  aiVisibility: ReportAiVisibility | null;
  // New 2026 sections — all optional so old snapshots stay readable. The
  // view renders nothing when these are absent or empty.
  reputationStats?: ReportReputationStats;
  occupancyStats?: ReportOccupancyStats;
  renewalStats?: ReportRenewalStats;
  visitorStats?: ReportVisitorStats;
  aiAnalysis?: AiAnalysis;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  ORGANIC: "Organic search",
  CHATBOT: "Chatbot",
  FORM: "Website form",
  PIXEL_OUTREACH: "Pixel outreach",
  REFERRAL: "Referral",
  DIRECT: "Direct",
  EMAIL_CAMPAIGN: "Email campaign",
  COLD_EMAIL: "Cold email",
  MANUAL: "Manual",
  OTHER: "Other",
};

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TOUR_SCHEDULED: "Tour scheduled",
  TOURED: "Toured",
  APPLICATION_SENT: "Application sent",
  APPLIED: "Applied",
  APPROVED: "Approved",
  SIGNED: "Signed",
  LOST: "Lost",
  UNQUALIFIED: "Unqualified",
};

const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  GOOGLE_ADS: "Google Ads",
  META: "Meta Ads",
  LINKEDIN: "LinkedIn Ads",
  TIKTOK: "TikTok Ads",
  REDDIT: "Reddit Ads",
};

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

export function resolvePeriod(kind: ReportKind, now: Date = new Date()): {
  periodStart: Date;
  periodEnd: Date;
  priorStart: Date;
  priorEnd: Date;
} {
  const end = new Date(now);
  if (kind === "weekly") {
    const start = new Date(end.getTime() - 7 * DAY_MS);
    const priorEnd = new Date(start);
    const priorStart = new Date(priorEnd.getTime() - 7 * DAY_MS);
    return { periodStart: start, periodEnd: end, priorStart, priorEnd };
  }
  if (kind === "monthly") {
    const start = new Date(end.getTime() - 28 * DAY_MS);
    const priorEnd = new Date(start);
    const priorStart = new Date(priorEnd.getTime() - 28 * DAY_MS);
    return { periodStart: start, periodEnd: end, priorStart, priorEnd };
  }
  // Custom falls back to weekly shape.
  const start = new Date(end.getTime() - 7 * DAY_MS);
  const priorEnd = new Date(start);
  const priorStart = new Date(priorEnd.getTime() - 7 * DAY_MS);
  return { periodStart: start, periodEnd: end, priorStart, priorEnd };
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function bucketDaily(rows: Array<{ date: Date; value: number }>, days: number, periodEnd: Date): number[] {
  const buckets = new Array<number>(days).fill(0);
  const endMs = periodEnd.getTime();
  for (const row of rows) {
    const ageMs = endMs - row.date.getTime();
    if (ageMs < 0 || ageMs >= days * DAY_MS) continue;
    const idx = days - 1 - Math.floor(ageMs / DAY_MS);
    if (idx >= 0 && idx < days) buckets[idx] += row.value;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// AI visibility helpers
// ---------------------------------------------------------------------------

const GENERIC_HOUSING_TERMS = new Set([
  'apartments', 'housing', 'rooms', 'bedroom', 'studio', 'rent', 'rental',
  'available', 'near', 'affordable', 'student', 'dorms', 'university', 'college',
]);

function isBrandedQuery(query: string): boolean {
  const words = query.toLowerCase().split(/\s+/);
  const genericCount = words.filter(w => GENERIC_HOUSING_TERMS.has(w)).length;
  return genericCount < words.length / 2 && words.length <= 4;
}

// ---------------------------------------------------------------------------
// AI analysis
// ---------------------------------------------------------------------------

async function generateAiAnalysis(
  snapshot: Omit<ReportSnapshot, "aiAnalysis">,
): Promise<AiAnalysis | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const prompt = `You are analyzing property leasing marketing performance data. Provide 4-5 specific, actionable insights.

PERIOD: ${snapshot.kind} (${snapshot.periodStart} to ${snapshot.periodEnd})

KEY METRICS:
- Leads: ${snapshot.kpis.leads} (${snapshot.kpiDeltas.leadsPct != null ? snapshot.kpiDeltas.leadsPct + "% vs prior" : "no prior data"})
- Tours: ${snapshot.kpis.tours} (${snapshot.kpiDeltas.toursPct != null ? snapshot.kpiDeltas.toursPct + "% vs prior" : "no prior data"})
- Applications: ${snapshot.kpis.applications}
- Ad spend: $${snapshot.kpis.adSpendUsd} (${snapshot.kpiDeltas.adSpendUsdPct != null ? snapshot.kpiDeltas.adSpendUsdPct + "% vs prior" : "no prior data"})
- Cost per lead: ${snapshot.kpis.costPerLead != null ? "$" + snapshot.kpis.costPerLead : "n/a"}
- Organic sessions: ${snapshot.kpis.organicSessions} (${snapshot.kpiDeltas.organicSessionsPct != null ? snapshot.kpiDeltas.organicSessionsPct + "% vs prior" : "no prior data"})

FUNNEL:
${snapshot.funnel.map((s) => `- ${s.stage}: ${s.count}`).join("\n")}

LEAD SOURCES:
${snapshot.leadSources.map((s) => `- ${s.source}: ${s.count} (${s.pct}%)`).join("\n") || "- No leads this period"}

AD PERFORMANCE:
${snapshot.adPerformance.map((r) => `- ${r.platform}: $${r.spendUsd} spend, ${r.leads} leads, CPL ${r.cpl != null ? "$" + r.cpl : "n/a"}, conv rate ${r.conversionRate != null ? r.conversionRate + "%" : "n/a"}`).join("\n") || "- No ad data"}

TOP SEARCH QUERIES:
${snapshot.topQueries.slice(0, 5).map((q) => `- "${q.query}": ${q.clicks} clicks, pos ${q.position}`).join("\n") || "- No query data"}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "summary": "One sentence: what matters most this ${snapshot.kind}.",
  "actions": [
    {
      "priority": "high",
      "title": "Short action title (max 8 words)",
      "observation": "What the data shows (1 sentence)",
      "action": "What to do (1 sentence, specific)"
    }
  ]
}`;

    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 800,
    });
    return JSON.parse(text) as AiAnalysis;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Snapshot generator
// ---------------------------------------------------------------------------

export type GenerateReportOptions = {
  // When set, every query in the snapshot is scoped to this property. SEO
  // rows (which are URL-keyed, no propertyId) are matched by URL pattern
  // against the property's slug/name/bound domains. NULL = portfolio-wide.
  propertyId?: string | null;
  now?: Date;
};

// Internal scoped data resolved at the top of the function so every query
// can use a consistent set of filter clauses without re-checking `propertyId`
// throughout. When propertyId is null, all clauses degrade to {} (no extra
// filtering) — preserving the original org-wide behavior bit-for-bit.
type Scope = {
  propertyId: string | null;
  propertyName: string | null;
  propertySlug: string | null;
  // For Lead, Resident, Lease, Listing, etc. — direct column.
  propertyClause: { propertyId?: string };
  // For Tour, Application — they have no direct propertyId; we filter via
  // their `lead.propertyId` relation.
  leadRelClause: { lead?: { propertyId?: string } };
  // SEO URL-pattern matchers (computed once).
  seoLandingClause: Prisma.SeoLandingPageWhereInput;
  seoQueryClause: Prisma.SeoQueryWhereInput;
  // Snapshot signal — true means SEO scoping was actually applied.
  seoScoped: boolean;
};

async function buildScope(
  orgId: string,
  propertyId: string | null,
): Promise<Scope> {
  if (!propertyId) {
    return {
      propertyId: null,
      propertyName: null,
      propertySlug: null,
      propertyClause: {},
      leadRelClause: {},
      seoLandingClause: {},
      seoQueryClause: {},
      seoScoped: false,
    };
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId },
    select: { id: true, slug: true, name: true },
  });
  if (!property) {
    // Caller passed a property that doesn't belong to this org. Treat as
    // a no-op scope so we never accidentally render a portfolio-wide
    // report mislabeled as a single property.
    return {
      propertyId,
      propertyName: null,
      propertySlug: null,
      propertyClause: { propertyId },
      leadRelClause: { lead: { propertyId } },
      seoLandingClause: { url: { contains: "__no_match__" } },
      seoQueryClause: { query: { contains: "__no_match__" } },
      seoScoped: true,
    };
  }

  const domains = await prisma.domainBinding
    .findMany({ where: { orgId }, select: { hostname: true } })
    .catch(() => [] as Array<{ hostname: string }>);
  const patterns = buildPropertyUrlPatterns(
    property.slug,
    property.name,
    domains.map((d) => d.hostname),
  );

  const seoLandingClause: Prisma.SeoLandingPageWhereInput =
    patterns.length > 0
      ? {
          OR: patterns.map((p) => ({
            url: {
              contains: p.replace(/%/g, ""),
              mode: "insensitive" as const,
            },
          })),
        }
      : { url: { contains: "__no_match__" } };
  const seoQueryClause: Prisma.SeoQueryWhereInput =
    patterns.length > 0
      ? {
          OR: patterns.map((p) => ({
            query: {
              contains: p.replace(/%/g, ""),
              mode: "insensitive" as const,
            },
          })),
        }
      : { query: { contains: "__no_match__" } };

  return {
    propertyId,
    propertyName: property.name,
    propertySlug: property.slug,
    propertyClause: { propertyId },
    leadRelClause: { lead: { propertyId } },
    seoLandingClause,
    seoQueryClause,
    seoScoped: true,
  };
}

export async function generateReportSnapshot(
  orgId: string,
  kind: ReportKind,
  options: GenerateReportOptions = {},
): Promise<ReportSnapshot> {
  const now = options.now ?? new Date();
  const propertyId = options.propertyId ?? null;
  const scope = await buildScope(orgId, propertyId);
  const { periodStart, periodEnd, priorStart, priorEnd } = resolvePeriod(kind, now);
  const days = kind === "weekly" ? 7 : 28;

  const [
    leadsCount,
    priorLeadsCount,
    toursCount,
    priorToursCount,
    applicationsCount,
    priorApplicationsCount,
    adSpendCurrent,
    adSpendPrior,
    adSpendDaily,
    organicCurrent,
    organicPrior,
    organicDaily,
    leadStatusGroups,
    leadSourceGroups,
    totalLeadsForSource,
    adPerfGroups,
    adLeadGroups,
    topPagesRows,
    topQueriesRows,
    insightsRows,
    chatbotAgg,
    chatbotLeadsCount,
    propertiesList,
    propertyLeadGroups,
  ] = await Promise.all([
    // KPI counts — scope.propertyClause is `{}` for org-wide (legacy
    // behavior) or `{ propertyId }` for per-property reports.
    prisma.lead.count({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.lead.count({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: priorStart, lt: priorEnd },
      },
    }),
    prisma.tour.count({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        lead: { orgId, ...(scope.leadRelClause.lead ?? {}) },
      },
    }),
    prisma.tour.count({
      where: {
        createdAt: { gte: priorStart, lt: priorEnd },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        lead: { orgId, ...(scope.leadRelClause.lead ?? {}) },
      },
    }),
    prisma.application.count({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED] },
        lead: { orgId, ...(scope.leadRelClause.lead ?? {}) },
      },
    }),
    prisma.application.count({
      where: {
        createdAt: { gte: priorStart, lt: priorEnd },
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED] },
        lead: { orgId, ...(scope.leadRelClause.lead ?? {}) },
      },
    }),
    // Ad spend — AdMetricDaily has no propertyId; we filter via the
    // campaign relation when scoped.
    prisma.adMetricDaily.aggregate({
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        ...(scope.propertyId
          ? { campaign: { propertyId: scope.propertyId } }
          : {}),
      },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.aggregate({
      where: {
        orgId,
        date: { gte: priorStart, lt: priorEnd },
        ...(scope.propertyId
          ? { campaign: { propertyId: scope.propertyId } }
          : {}),
      },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.groupBy({
      by: ["date"],
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        ...(scope.propertyId
          ? { campaign: { propertyId: scope.propertyId } }
          : {}),
      },
      _sum: { spendCents: true },
      orderBy: { date: "asc" },
    }),
    // Organic sessions — when scoped to a property, pull from
    // SeoLandingPage rows whose URL matches the property's slug/name/
    // domain patterns (URL-keyed = the only way to attribute organic
    // traffic to a single building). When org-wide, use the SeoSnapshot
    // rollup which is faster (already aggregated daily across the
    // tenant). Behavior is identical for the org-wide path; the bug
    // pre-fix was showing the org-wide rollup on property reports.
    scope.propertyId
      ? prisma.seoLandingPage.aggregate({
          where: {
            orgId,
            ...scope.seoLandingClause,
            date: { gte: periodStart, lt: periodEnd },
          },
          _sum: { sessions: true },
        }).then((r) => ({ _sum: { organicSessions: r._sum.sessions ?? 0 } }))
      : prisma.seoSnapshot.aggregate({
          where: { orgId, date: { gte: periodStart, lt: periodEnd } },
          _sum: { organicSessions: true },
        }),
    scope.propertyId
      ? prisma.seoLandingPage.aggregate({
          where: {
            orgId,
            ...scope.seoLandingClause,
            date: { gte: priorStart, lt: priorEnd },
          },
          _sum: { sessions: true },
        }).then((r) => ({ _sum: { organicSessions: r._sum.sessions ?? 0 } }))
      : prisma.seoSnapshot.aggregate({
          where: { orgId, date: { gte: priorStart, lt: priorEnd } },
          _sum: { organicSessions: true },
        }),
    scope.propertyId
      ? prisma.seoLandingPage
          .groupBy({
            by: ["date"],
            where: {
              orgId,
              ...scope.seoLandingClause,
              date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { sessions: true },
            orderBy: { date: "asc" },
          })
          .then((rows) =>
            rows.map((r) => ({
              date: r.date,
              organicSessions: r._sum.sessions ?? 0,
            })),
          )
      : prisma.seoSnapshot.findMany({
          where: { orgId, date: { gte: periodStart, lt: periodEnd } },
          select: { date: true, organicSessions: true },
          orderBy: { date: "asc" },
        }),
    // Funnel from LeadStatus groupBy
    prisma.lead.groupBy({
      by: ["status"],
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
    }),
    // Lead sources
    prisma.lead.groupBy({
      by: ["source"],
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
    }),
    prisma.lead.count({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    // Ad perf by platform (join metrics -> campaign for platform)
    prisma.adCampaign.findMany({
      where: { orgId, ...scope.propertyClause },
      select: {
        id: true,
        platform: true,
        metricsDaily: {
          where: { date: { gte: periodStart, lt: periodEnd } },
          select: { spendCents: true, conversions: true, clicks: true },
        },
      },
    }),
    // Ad leads per platform (via source)
    prisma.lead.groupBy({
      by: ["source"],
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
        source: { in: [LeadSource.GOOGLE_ADS, LeadSource.META_ADS] },
      },
      _count: { _all: true },
    }),
    // SEO top pages — when scoped to a property, only URLs matching the
    // property's slug/name/domain patterns are returned.
    prisma.seoLandingPage.groupBy({
      by: ["url"],
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        ...scope.seoLandingClause,
      },
      _sum: { sessions: true },
      orderBy: { _sum: { sessions: "desc" } },
      take: 10,
    }),
    // SEO top queries — same URL-pattern scoping logic.
    prisma.seoQuery.groupBy({
      by: ["query"],
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        ...scope.seoQueryClause,
      },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
      orderBy: { _sum: { clicks: "desc" } },
      take: 10,
    }),
    // Insights opened within window
    prisma.insight.findMany({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        kind: true,
        severity: true,
        title: true,
        body: true,
      },
    }),
    // Chatbot stats
    prisma.chatbotConversation.aggregate({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
      _avg: { messageCount: true },
    }),
    prisma.lead.count({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
        source: LeadSource.CHATBOT,
      },
    }),
    // Property rollup — when scoped, this collapses to the single
    // property the report is for. No fake/seeded data ever — pure
    // Property table reads.
    prisma.property.findMany({
      where: { orgId, ...(scope.propertyId ? { id: scope.propertyId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: scope.propertyId ? 1 : 20,
      select: {
        id: true,
        name: true,
        totalUnits: true,
        availableCount: true,
      },
    }),
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        ...(scope.propertyId
          ? { propertyId: scope.propertyId }
          : { propertyId: { not: null } }),
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
    }),
  ]);

  // KPIs
  const adSpendCents = adSpendCurrent._sum.spendCents ?? 0;
  const priorAdSpendCents = adSpendPrior._sum.spendCents ?? 0;
  const adSpendUsd = Math.round(adSpendCents / 100);
  const priorAdSpendUsd = Math.round(priorAdSpendCents / 100);
  const organicSessions = organicCurrent._sum.organicSessions ?? 0;
  const priorOrganicSessions = organicPrior._sum.organicSessions ?? 0;

  // CPL must only divide by *paid* leads. Including chatbot/organic/referral
  // leads in the denominator made CPL look great on properties whose leads
  // mostly came from non-paid channels — and made paid-channel performance
  // unreadable. paidLeadsCount = sum of leads attributed to GOOGLE_ADS or
  // META_ADS sources for the same scope/period as adSpend.
  const paidLeadsCount = adLeadGroups.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const costPerLead =
    paidLeadsCount > 0 && adSpendUsd > 0
      ? Math.round((adSpendUsd / paidLeadsCount) * 100) / 100
      : null;
  // Prior-period CPL — we only have ad-leads by source for the current
  // period in this query block, so prior CPL falls back to the old
  // total-leads denom. Better than nothing for direction-of-change context.
  const priorCostPerLead =
    priorLeadsCount > 0 && priorAdSpendUsd > 0
      ? priorAdSpendUsd / priorLeadsCount
      : null;

  const kpis: ReportKpis = {
    leads: leadsCount,
    tours: toursCount,
    applications: applicationsCount,
    costPerLead,
    adSpendUsd,
    organicSessions,
  };

  const kpiDeltas: ReportKpiDeltas = {
    leadsPct: pctChange(leadsCount, priorLeadsCount),
    toursPct: pctChange(toursCount, priorToursCount),
    applicationsPct: pctChange(applicationsCount, priorApplicationsCount),
    costPerLeadPct:
      priorCostPerLead != null && costPerLead != null
        ? Math.round(((costPerLead - priorCostPerLead) / priorCostPerLead) * 100)
        : null,
    adSpendUsdPct: pctChange(adSpendUsd, priorAdSpendUsd),
    organicSessionsPct: pctChange(organicSessions, priorOrganicSessions),
  };

  // Funnel
  const statusByKey = new Map<LeadStatus, number>();
  for (const row of leadStatusGroups) {
    statusByKey.set(row.status, row._count._all);
  }
  const funnelOrder: LeadStatus[] = [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.TOURED,
    LeadStatus.APPLIED,
    LeadStatus.APPROVED,
    LeadStatus.SIGNED,
  ];
  const funnel: ReportFunnelStage[] = funnelOrder.map((s) => ({
    stage: LEAD_STATUS_LABELS[s],
    count: statusByKey.get(s) ?? 0,
  }));

  // Lead sources
  const totalSourceLeads = totalLeadsForSource || 1;
  const leadSources: ReportLeadSource[] = leadSourceGroups
    .map((row) => ({
      source: LEAD_SOURCE_LABELS[row.source] ?? row.source,
      count: row._count._all,
      pct: Math.round((row._count._all / totalSourceLeads) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Ad performance by platform
  const perfByPlatform = new Map<AdPlatform, { spendCents: number; conversions: number; clicks: number }>();
  for (const c of adPerfGroups) {
    const agg = perfByPlatform.get(c.platform) ?? { spendCents: 0, conversions: 0, clicks: 0 };
    for (const m of c.metricsDaily) {
      agg.spendCents += m.spendCents;
      agg.conversions += m.conversions;
      agg.clicks += m.clicks;
    }
    perfByPlatform.set(c.platform, agg);
  }
  const leadsByPlatform = new Map<AdPlatform, number>();
  for (const row of adLeadGroups) {
    const platform =
      row.source === LeadSource.GOOGLE_ADS
        ? AdPlatform.GOOGLE_ADS
        : row.source === LeadSource.META_ADS
          ? AdPlatform.META
          : null;
    if (platform) leadsByPlatform.set(platform, row._count._all);
  }
  const adPerformance: ReportAdRow[] = Array.from(perfByPlatform.entries()).map(([platform, agg]) => {
    const spendUsd = Math.round(agg.spendCents / 100);
    const leads = leadsByPlatform.get(platform) ?? 0;
    const cpl = leads > 0 ? Math.round((spendUsd / leads) * 100) / 100 : null;
    const conversionRate =
      agg.clicks > 0 ? Math.round((agg.conversions / agg.clicks) * 10000) / 100 : null;
    return {
      platform: AD_PLATFORM_LABELS[platform] ?? platform,
      spendUsd,
      leads,
      cpl,
      conversionRate,
    };
  });

  // Top pages
  const topPages: ReportTopPage[] = topPagesRows.map((row) => ({
    url: row.url,
    sessions: row._sum.sessions ?? 0,
    clicks: 0,
  }));

  // Top queries
  const topQueries: ReportTopQuery[] = topQueriesRows.map((row) => ({
    query: row.query,
    clicks: row._sum.clicks ?? 0,
    impressions: row._sum.impressions ?? 0,
    position: row._avg.position ? Math.round(row._avg.position * 10) / 10 : 0,
  }));

  // Insights
  const insights: ReportInsight[] = insightsRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    body: row.body,
  }));

  // Chatbot
  const chatbotStats: ReportChatbotStats = {
    conversations: chatbotAgg._count._all ?? 0,
    leadsFromChat: chatbotLeadsCount,
    avgMessageCount: chatbotAgg._avg.messageCount
      ? Math.round((chatbotAgg._avg.messageCount as number) * 10) / 10
      : 0,
  };

  // Property rollup
  const leadsByProperty = new Map<string, number>();
  for (const row of propertyLeadGroups) {
    if (!row.propertyId) continue;
    leadsByProperty.set(row.propertyId, row._count._all);
  }

  // Per-property occupancy — same priority order as buildOccupancyStats:
  // active lease count first, then available listings, then the legacy
  // denorm. Don't surface a number we can't trust; render null when no
  // signal exists.
  const propertyIds = propertiesList.map((p) => p.id);
  const [activeLeasesByProp, availableListingsByProp] = propertyIds.length > 0
    ? await Promise.all([
        prisma.lease.groupBy({
          by: ["propertyId"],
          where: {
            orgId,
            propertyId: { in: propertyIds },
            status: LeaseStatus.ACTIVE,
          },
          _count: { _all: true },
        }),
        prisma.listing.groupBy({
          by: ["propertyId"],
          where: {
            propertyId: { in: propertyIds },
            isAvailable: true,
          },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const leaseCountByPropId = new Map<string, number>();
  for (const r of activeLeasesByProp) {
    if (r.propertyId) leaseCountByPropId.set(r.propertyId, r._count._all);
  }
  const availListingByPropId = new Map<string, number>();
  for (const r of availableListingsByProp) {
    if (r.propertyId) availListingByPropId.set(r.propertyId, r._count._all);
  }

  const properties: ReportPropertyRow[] = propertiesList.map((p) => {
    const total = p.totalUnits ?? 0;
    let occupancyPct: number | null = null;
    if (total > 0) {
      const activeLeases = leaseCountByPropId.get(p.id) ?? 0;
      const availListings = availListingByPropId.get(p.id) ?? 0;
      const denormAvailable = p.availableCount ?? 0;
      if (activeLeases > 0) {
        occupancyPct = Math.round(
          (Math.min(total, activeLeases) / total) * 100,
        );
      } else if (availListings > 0) {
        occupancyPct = Math.round(
          (Math.max(0, total - availListings) / total) * 100,
        );
      } else if (denormAvailable > 0) {
        occupancyPct = Math.round(
          (Math.max(0, total - denormAvailable) / total) * 100,
        );
      }
      // else: no signal → null (don't lie with 100%)
    }
    return {
      id: p.id,
      name: p.name,
      leads: leadsByProperty.get(p.id) ?? 0,
      occupancyPct,
    };
  });

  // Traffic trend (daily organic sessions across the period)
  const trafficTrend = bucketDaily(
    organicDaily.map((r) => ({ date: r.date, value: r.organicSessions ?? 0 })),
    days,
    periodEnd,
  );

  // If no SEO data, fall back to ad spend shape so the chart isn't flat-zero.
  const trafficFallback =
    trafficTrend.every((v) => v === 0) && adSpendDaily.length > 0
      ? bucketDaily(
          adSpendDaily.map((r) => ({
            date: r.date,
            value: (r._sum.spendCents ?? 0) / 100,
          })),
          days,
          periodEnd,
        )
      : trafficTrend;

  // Attribution by source — load leads with id/source/status, then join tours and apps
  const allLeadsInPeriod = await prisma.lead.findMany({
    where: {
      orgId,
      ...scope.propertyClause,
      createdAt: { gte: periodStart, lt: periodEnd },
    },
    select: { id: true, source: true, status: true },
  });

  const leadIds = allLeadsInPeriod.map(l => l.id);

  const [toursForLeads, appsForLeads] = await Promise.all([
    leadIds.length > 0
      ? prisma.tour.findMany({
          where: { leadId: { in: leadIds } },
          select: { leadId: true },
        })
      : Promise.resolve([]),
    leadIds.length > 0
      ? prisma.application.findMany({
          where: { leadId: { in: leadIds } },
          select: { leadId: true },
        })
      : Promise.resolve([]),
  ]);

  const toursByLeadId = new Set(toursForLeads.map(t => t.leadId));
  const appsByLeadId = new Set(appsForLeads.map(a => a.leadId));

  const sourceMap = new Map<string, ReportAttributionRow>();
  for (const lead of allLeadsInPeriod) {
    const label = LEAD_SOURCE_LABELS[lead.source] ?? lead.source;
    const row = sourceMap.get(label) ?? { source: label, leads: 0, tours: 0, applications: 0, signed: 0 };
    row.leads++;
    if (toursByLeadId.has(lead.id)) row.tours++;
    if (appsByLeadId.has(lead.id)) row.applications++;
    if (lead.status === LeadStatus.SIGNED) row.signed++;
    sourceMap.set(label, row);
  }
  const attributionBySource: ReportAttributionRow[] = Array.from(sourceMap.values())
    .filter(r => r.leads > 0)
    .sort((a, b) => b.signed - a.signed || b.leads - a.leads);

  // AI visibility — classify branded vs. generic search queries
  const totalClicks = topQueriesRows.reduce((s, q) => s + (q._sum.clicks ?? 0), 0);
  const brandedQueryRows = topQueriesRows.filter(q => isBrandedQuery(q.query));
  const brandedClicks = brandedQueryRows.reduce((s, q) => s + (q._sum.clicks ?? 0), 0);
  const brandedImpressions = brandedQueryRows.reduce((s, q) => s + (q._sum.impressions ?? 0), 0);

  const aiVisibility: ReportAiVisibility | null = totalClicks > 0
    ? {
        brandedClicks,
        brandedImpressions,
        brandedShare: Math.round((brandedClicks / totalClicks) * 100),
        topBrandedTerms: brandedQueryRows
          .sort((a, b) => (b._sum.clicks ?? 0) - (a._sum.clicks ?? 0))
          .slice(0, 5)
          .map(q => q.query),
      }
    : null;

  // -------------------------------------------------------------------------
  // 2026 sections — reputation, occupancy, renewals, visitor identification.
  // Each block is independently try/caught so an empty/missing data source
  // (new tenant, schema not migrated, integration not configured) never
  // blocks the rest of the report from generating.
  // -------------------------------------------------------------------------

  // Reputation — always lifetime + delta vs prior period.
  const reputationStats = await buildReputationStats(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
    priorStart,
    priorEnd,
  ).catch(() => undefined);

  // Occupancy — point-in-time snapshot. Scoped to the property when set.
  const occupancyStats = await buildOccupancyStats(orgId, scope.propertyId).catch(
    () => undefined,
  );

  // Renewals — forward-looking 120-day window from periodEnd.
  const renewalStats = await buildRenewalStats(
    orgId,
    scope.propertyId,
    periodEnd,
  ).catch(() => undefined);

  // Visitor identification — pixel-driven, period-scoped.
  const visitorStats = await buildVisitorStats(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
    days,
  ).catch(() => undefined);

  // Chatbot extended — captured-rate breakdown for the report.
  const chatbotStatsExtended = await buildChatbotExtended(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
    chatbotStats,
  ).catch(() => undefined);

  const baseSnapshot: Omit<ReportSnapshot, "aiAnalysis"> = {
    kind,
    scope: {
      propertyId: scope.propertyId,
      propertyName: scope.propertyName,
      propertySlug: scope.propertySlug,
    },
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    kpis,
    kpiDeltas,
    funnel,
    leadSources,
    adPerformance,
    topPages,
    topQueries,
    insights,
    chatbotStats,
    chatbotStatsExtended,
    properties,
    trafficTrend: trafficFallback,
    attributionBySource,
    aiVisibility,
    reputationStats,
    occupancyStats,
    renewalStats,
    visitorStats,
  };

  const aiAnalysis = await generateAiAnalysis(baseSnapshot);

  return {
    ...baseSnapshot,
    ...(aiAnalysis ? { aiAnalysis } : {}),
  };
}

// ---------------------------------------------------------------------------
// Section builders — each is independent so reports keep generating when
// an integration is missing or the schema migration hasn't run yet.
// ---------------------------------------------------------------------------

const MENTION_SOURCE_LABELS: Record<MentionSource, string> = {
  GOOGLE_REVIEW: "Google",
  REDDIT: "Reddit",
  YELP: "Yelp",
  TAVILY_WEB: "Web",
  FACEBOOK_PUBLIC: "Facebook",
  OTHER: "Other",
};

async function buildReputationStats(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
  priorStart: Date,
  priorEnd: Date,
): Promise<ReportReputationStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};

  // Full mention payload — title, author, sentiment, topics, flagged
  // — so the report renderer (and the email) can show real Reddit
  // threads / Google reviews / Yelp posts with attribution + click-
  // through links instead of bare snippet stubs.
  const FULL_SELECT = {
    id: true,
    source: true,
    rating: true,
    title: true,
    excerpt: true,
    authorName: true,
    publishedAt: true,
    sourceUrl: true,
    sentiment: true,
    topics: true,
    flagged: true,
  } as const;

  const [
    lifetime,
    sourceGroups,
    periodNew,
    priorNew,
    sentimentGroups,
    recentRows,
    highlightRows,
    concernRows,
    reviewedAgg,
  ] = await Promise.all([
    prisma.propertyMention.aggregate({
      where: { orgId, ...propertyClause },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["source"],
      where: { orgId, ...propertyClause },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.propertyMention.count({
      where: {
        orgId,
        ...propertyClause,
        publishedAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.propertyMention.count({
      where: {
        orgId,
        ...propertyClause,
        publishedAt: { gte: priorStart, lt: priorEnd },
      },
    }),
    prisma.propertyMention.groupBy({
      by: ["sentiment"],
      where: { orgId, ...propertyClause },
      _count: { _all: true },
    }),
    // Recent feed — most recent 12 across all sources. Drives the
    // "Recent mentions" timeline in the report.
    prisma.propertyMention.findMany({
      where: { orgId, ...propertyClause },
      orderBy: { publishedAt: "desc" },
      take: 12,
      select: FULL_SELECT,
    }),
    // Highlights — 5★ Google/Yelp OR sentiment=POSITIVE. Drives the
    // "What residents are loving" section in the report.
    prisma.propertyMention.findMany({
      where: {
        orgId,
        ...propertyClause,
        OR: [
          { rating: { gte: 4.5 } },
          { sentiment: Sentiment.POSITIVE },
        ],
      },
      orderBy: [{ rating: "desc" }, { publishedAt: "desc" }],
      take: 6,
      select: FULL_SELECT,
    }),
    // Concerns — low-star reviews OR sentiment=NEGATIVE/MIXED. Drives
    // the "What needs attention" section.
    prisma.propertyMention.findMany({
      where: {
        orgId,
        ...propertyClause,
        OR: [
          { rating: { lte: 3 } },
          { sentiment: { in: [Sentiment.NEGATIVE, Sentiment.MIXED] } },
          { flagged: true },
        ],
      },
      orderBy: [{ rating: "asc" }, { publishedAt: "desc" }],
      take: 6,
      select: FULL_SELECT,
    }),
    // Response rate proxy — operator-marked "reviewed" mentions divided by
    // the overall mention count. We don't track per-mention replies as
    // first-class data yet, so this is the best signal available.
    prisma.propertyMention.count({
      where: { orgId, ...propertyClause, reviewedByUserId: { not: null } },
    }),
  ]);

  const totalReviews = lifetime._count._all;
  if (totalReviews === 0) return undefined;

  const positiveCount =
    sentimentGroups.find((s) => s.sentiment === Sentiment.POSITIVE)?._count
      ._all ?? 0;
  const negativeCount =
    sentimentGroups.find((s) => s.sentiment === Sentiment.NEGATIVE)?._count
      ._all ?? 0;

  function toMention(
    m: (typeof recentRows)[number],
  ): ReportReputationMention {
    return {
      id: m.id,
      source: MENTION_SOURCE_LABELS[m.source] ?? m.source,
      rating: m.rating,
      title: m.title,
      excerpt: m.excerpt,
      authorName: m.authorName,
      publishedAt: m.publishedAt ? m.publishedAt.toISOString() : null,
      sourceUrl: m.sourceUrl,
      sentiment: m.sentiment,
      topics: Array.isArray(m.topics) ? (m.topics as string[]) : null,
      flagged: m.flagged,
    };
  }

  const recent = recentRows.map(toMention);
  const highlights = highlightRows.map(toMention);
  // Dedupe concerns vs highlights — a 4.5★ MIXED-sentiment review
  // could land in both buckets and we don't want to print it twice.
  const highlightIds = new Set(highlights.map((h) => h.id));
  const concerns = concernRows
    .filter((m) => !highlightIds.has(m.id))
    .map(toMention);

  return {
    overallRating:
      lifetime._avg.rating != null
        ? Math.round(lifetime._avg.rating * 10) / 10
        : null,
    totalReviews,
    newInPeriod: periodNew,
    newInPeriodPct: pctChange(periodNew, priorNew),
    positiveCount,
    negativeCount,
    responseRatePct:
      totalReviews > 0 ? Math.round((reviewedAgg / totalReviews) * 100) : null,
    sourceBreakdown: sourceGroups
      .map((g) => ({
        source: MENTION_SOURCE_LABELS[g.source] ?? g.source,
        count: g._count._all,
        rating:
          g._avg.rating != null ? Math.round(g._avg.rating * 10) / 10 : null,
      }))
      .sort((a, b) => b.count - a.count),
    // topMentions kept as alias for backwards compat with older
    // snapshots already persisted as JSON.
    topMentions: recent,
    recent,
    highlights,
    concerns,
  };
}

async function buildOccupancyStats(
  orgId: string,
  propertyId: string | null,
): Promise<ReportOccupancyStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};
  const [propertyAgg, residentNoticeCount, applicationsQueued, rentRoll, activeListings] =
    await Promise.all([
      prisma.property.aggregate({
        where: { orgId, ...(propertyId ? { id: propertyId } : {}) },
        _sum: { totalUnits: true, availableCount: true },
      }),
      prisma.resident.count({
        where: {
          orgId,
          ...propertyClause,
          status: ResidentStatus.NOTICE_GIVEN,
        },
      }),
      prisma.application.count({
        where: {
          status: ApplicationStatus.SUBMITTED,
          lead: { orgId, ...(propertyId ? { propertyId } : {}) },
        },
      }),
      prisma.lease.aggregate({
        where: { orgId, ...propertyClause, status: LeaseStatus.ACTIVE },
        _sum: { monthlyRentCents: true },
        _count: { _all: true },
      }),
      // Listings flagged available — fallback signal for tenants with no
      // active Lease rows synced yet.
      prisma.listing.count({
        where: {
          property: { orgId, ...(propertyId ? { id: propertyId } : {}) },
          isAvailable: true,
        },
      }),
    ]);

  const totalUnits = propertyAgg._sum.totalUnits ?? 0;
  if (totalUnits === 0) return undefined;

  // Occupancy source-of-truth (in priority order):
  //
  //   1. Active lease count (most reliable — comes from AppFolio rent roll
  //      via the REST sync's tenant_directory + lease_history reports).
  //   2. Listings flagged isAvailable=true (the embed-fallback path uses
  //      this; works for tenants without REST creds).
  //   3. Property.availableCount (legacy denorm field, only updated by
  //      syncListingsForOrg → not reliable for REST-synced tenants).
  //
  // The previous report version used #3 alone, which silently defaulted to
  // 0 for every REST tenant and produced fake "100% occupied" on every
  // property. We now prefer #1 → #2 → #3 in that order.
  const activeLeaseCount = rentRoll._count._all;
  let leasedUnits: number;
  let occupancySource: "leases" | "listings" | "denorm";
  if (activeLeaseCount > 0) {
    leasedUnits = Math.min(totalUnits, activeLeaseCount);
    occupancySource = "leases";
  } else if (activeListings > 0) {
    leasedUnits = Math.max(0, totalUnits - activeListings);
    occupancySource = "listings";
  } else {
    const denormAvailable = Math.max(
      0,
      Math.min(totalUnits, propertyAgg._sum.availableCount ?? 0),
    );
    leasedUnits = Math.max(0, totalUnits - denormAvailable);
    occupancySource = "denorm";
  }

  const availableUnits = Math.max(0, totalUnits - leasedUnits);
  const monthlyRentRollUsd = Math.round(
    (rentRoll._sum.monthlyRentCents ?? 0) / 100,
  );

  // If we have no active leases AND no available listings AND no denorm,
  // we don't know occupancy. Don't lie — render "—".
  const hasAnyOccupancySignal =
    activeLeaseCount > 0 ||
    activeListings > 0 ||
    (propertyAgg._sum.availableCount ?? 0) > 0;
  const occupancyPct =
    hasAnyOccupancySignal && totalUnits > 0
      ? Math.round((leasedUnits / totalUnits) * 100)
      : null;
  void occupancySource; // reserved for future debug surfacing

  return {
    totalUnits,
    leasedUnits,
    availableUnits,
    occupancyPct,
    onNotice: residentNoticeCount,
    applicationsQueued,
    monthlyRentRollUsd,
    avgRentPerUnitUsd:
      activeLeaseCount > 0
        ? Math.round(monthlyRentRollUsd / activeLeaseCount)
        : null,
  };
}

async function buildRenewalStats(
  orgId: string,
  propertyId: string | null,
  periodEnd: Date,
): Promise<ReportRenewalStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};
  const next30 = new Date(periodEnd.getTime() + 30 * DAY_MS);
  const next60 = new Date(periodEnd.getTime() + 60 * DAY_MS);
  const next120 = new Date(periodEnd.getTime() + 120 * DAY_MS);

  const [
    activeCount,
    next30Count,
    next60Count,
    next120Leases,
    pastDue,
  ] = await Promise.all([
    prisma.lease.count({
      where: { orgId, ...propertyClause, status: LeaseStatus.ACTIVE },
    }),
    prisma.lease.count({
      where: {
        orgId,
        ...propertyClause,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: periodEnd, lt: next30 },
      },
    }),
    prisma.lease.count({
      where: {
        orgId,
        ...propertyClause,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: periodEnd, lt: next60 },
      },
    }),
    prisma.lease.findMany({
      where: {
        orgId,
        ...propertyClause,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: periodEnd, lte: next120 },
      },
      select: { monthlyRentCents: true },
    }),
    prisma.lease.aggregate({
      where: { orgId, ...propertyClause, isPastDue: true },
      _sum: { currentBalanceCents: true },
      _count: { _all: true },
    }),
  ]);

  if (activeCount === 0 && next120Leases.length === 0) return undefined;

  const monthlyAtRiskCents = next120Leases.reduce(
    (sum, l) => sum + (l.monthlyRentCents ?? 0),
    0,
  );

  return {
    activeLeases: activeCount,
    expiringNext120: next120Leases.length,
    expiringNext30: next30Count,
    expiringNext60: next60Count,
    monthlyAtRiskUsd: Math.round(monthlyAtRiskCents / 100),
    pastDueCount: pastDue._count._all,
    pastDueBalanceUsd: Math.round((pastDue._sum.currentBalanceCents ?? 0) / 100),
  };
}

async function buildVisitorStats(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
  days: number,
): Promise<ReportVisitorStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};
  const [identifiedTotal, identifiedNew, withEmail, withPhone, identifiedDaily, identifiedWithLead] =
    await Promise.all([
      prisma.visitor.count({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
        },
      }),
      prisma.visitor.count({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
          firstSeenAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.visitor.count({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
          email: { not: null },
        },
      }),
      prisma.visitor.count({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
          phone: { not: null },
        },
      }),
      prisma.visitor.findMany({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
          firstSeenAt: { gte: periodStart, lt: periodEnd },
        },
        select: { firstSeenAt: true },
        orderBy: { firstSeenAt: "asc" },
      }),
      // Visitors whose email also appears on a Lead — proxy for "pixel-
      // identified visitor that has a real lead row now". Scoped further
      // to the property when set so the count reflects that asset only.
      propertyId
        ? prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `select count(distinct v.id) as count
             from "Visitor" v
             join "Lead" l on l."orgId" = v."orgId" and l.email is not null and v.email is not null and lower(l.email) = lower(v.email)
             where v."orgId" = $1 and v.status = 'IDENTIFIED' and v."propertyId" = $2 and l."propertyId" = $2`,
            orgId,
            propertyId,
          )
        : prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `select count(distinct v.id) as count
             from "Visitor" v
             join "Lead" l on l."orgId" = v."orgId" and l.email is not null and v.email is not null and lower(l.email) = lower(v.email)
             where v."orgId" = $1 and v.status = 'IDENTIFIED'`,
            orgId,
          ),
    ]);

  if (identifiedTotal === 0) return undefined;

  const identifiedTrend = bucketDaily(
    identifiedDaily.map((v) => ({ date: v.firstSeenAt, value: 1 })),
    days,
    periodEnd,
  );

  const matched = identifiedWithLead[0]?.count
    ? Number(identifiedWithLead[0].count)
    : 0;

  return {
    identifiedVisitors: identifiedTotal,
    identifiedNewInPeriod: identifiedNew,
    withEmail,
    withPhone,
    identifiedWithLead: matched,
    identifiedTrend,
  };
}

async function buildChatbotExtended(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
  baseStats: ReportChatbotStats,
): Promise<ReportChatbotStatsExtended | undefined> {
  if (baseStats.conversations === 0) return undefined;
  const captured = await prisma.chatbotConversation.count({
    where: {
      orgId,
      ...(propertyId ? { propertyId } : {}),
      createdAt: { gte: periodStart, lt: periodEnd },
      status: ChatbotConversationStatus.LEAD_CAPTURED,
    },
  });
  return {
    ...baseStats,
    capturedConversations: captured,
    capturedRatePct:
      baseStats.conversations > 0
        ? Math.round((captured / baseStats.conversations) * 100)
        : null,
  };
}
