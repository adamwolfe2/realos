import "server-only";
import { prisma } from "@/lib/db";
import {
  AdPlatform,
  ApplicationStatus,
  LeadSource,
  LeadStatus,
  TourStatus,
} from "@prisma/client";

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

export type ReportSnapshot = {
  kind: ReportKind;
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
  properties: ReportPropertyRow[];
  trafficTrend: number[];
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
// Snapshot generator
// ---------------------------------------------------------------------------

export async function generateReportSnapshot(
  orgId: string,
  kind: ReportKind,
  now: Date = new Date(),
): Promise<ReportSnapshot> {
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
    // KPI counts
    prisma.lead.count({
      where: { orgId, createdAt: { gte: periodStart, lt: periodEnd } },
    }),
    prisma.lead.count({
      where: { orgId, createdAt: { gte: priorStart, lt: priorEnd } },
    }),
    prisma.tour.count({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        lead: { orgId },
      },
    }),
    prisma.tour.count({
      where: {
        createdAt: { gte: priorStart, lt: priorEnd },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        lead: { orgId },
      },
    }),
    prisma.application.count({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED] },
        lead: { orgId },
      },
    }),
    prisma.application.count({
      where: {
        createdAt: { gte: priorStart, lt: priorEnd },
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED] },
        lead: { orgId },
      },
    }),
    // Ad spend
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: priorStart, lt: priorEnd } },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.groupBy({
      by: ["date"],
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { spendCents: true },
      orderBy: { date: "asc" },
    }),
    // Organic sessions
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { organicSessions: true },
    }),
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: priorStart, lt: priorEnd } },
      _sum: { organicSessions: true },
    }),
    prisma.seoSnapshot.findMany({
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      select: { date: true, organicSessions: true },
      orderBy: { date: "asc" },
    }),
    // Funnel from LeadStatus groupBy
    prisma.lead.groupBy({
      by: ["status"],
      where: { orgId, createdAt: { gte: periodStart, lt: periodEnd } },
      _count: { _all: true },
    }),
    // Lead sources
    prisma.lead.groupBy({
      by: ["source"],
      where: { orgId, createdAt: { gte: periodStart, lt: periodEnd } },
      _count: { _all: true },
    }),
    prisma.lead.count({
      where: { orgId, createdAt: { gte: periodStart, lt: periodEnd } },
    }),
    // Ad perf by platform (join metrics -> campaign for platform)
    prisma.adCampaign.findMany({
      where: { orgId },
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
        createdAt: { gte: periodStart, lt: periodEnd },
        source: { in: [LeadSource.GOOGLE_ADS, LeadSource.META_ADS] },
      },
      _count: { _all: true },
    }),
    // SEO top pages (sum sessions/clicks over window per url)
    prisma.seoLandingPage.groupBy({
      by: ["url"],
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { sessions: true },
      orderBy: { _sum: { sessions: "desc" } },
      take: 10,
    }),
    // SEO top queries
    prisma.seoQuery.groupBy({
      by: ["query"],
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
      orderBy: { _sum: { clicks: "desc" } },
      take: 10,
    }),
    // Insights opened within window
    prisma.insight.findMany({
      where: {
        orgId,
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
      where: { orgId, createdAt: { gte: periodStart, lt: periodEnd } },
      _count: { _all: true },
      _avg: { messageCount: true },
    }),
    prisma.lead.count({
      where: {
        orgId,
        createdAt: { gte: periodStart, lt: periodEnd },
        source: LeadSource.CHATBOT,
      },
    }),
    // Property rollup
    prisma.property.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      take: 20,
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
        createdAt: { gte: periodStart, lt: periodEnd },
        propertyId: { not: null },
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

  const costPerLead = leadsCount > 0 ? Math.round((adSpendUsd / leadsCount) * 100) / 100 : null;
  const priorCostPerLead = priorLeadsCount > 0 ? priorAdSpendUsd / priorLeadsCount : null;

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
  const properties: ReportPropertyRow[] = propertiesList.map((p) => ({
    id: p.id,
    name: p.name,
    leads: leadsByProperty.get(p.id) ?? 0,
    occupancyPct:
      p.totalUnits && p.totalUnits > 0
        ? Math.round(((p.totalUnits - (p.availableCount ?? 0)) / p.totalUnits) * 100)
        : null,
  }));

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

  return {
    kind,
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
    properties,
    trafficTrend: trafficFallback,
  };
}
