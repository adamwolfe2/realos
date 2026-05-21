import "server-only";
import { prisma } from "@/lib/db";
import { LeadStatus, TourStatus, ApplicationStatus } from "@prisma/client";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// WeeklyDigest type
// ---------------------------------------------------------------------------

export type WeeklyDigest = {
  orgName: string;
  orgId: string;
  weekLabel: string;
  hasData: boolean;
  metrics: {
    leadsThisWeek: number;
    leadsDelta: number;
    toursThisWeek: number;
    toursDelta: number;
    applicationsThisWeek: number;
    adSpendCents: number;
    organicSessions: number;
    hotVisitorPeak: number;
  };
  topProperties: Array<{
    name: string;
    leads: number;
    tours: number;
  }>;
  openInsights: number;
  unreadLeads: number;
  // SEO Agent digest — average composite score this week, delta vs prior,
  // top 3 open recommendations across the portfolio. Surfaces "your
  // average score moved +4pts" and the actions to keep moving.
  seo: {
    avgScoreThisWeek: number | null;
    avgScoreLastWeek: number | null;
    scoreDelta: number | null;
    openRecsCritical: number;
    openRecsHigh: number;
    topRecommendations: Array<{
      title: string;
      severity: string;
      propertyName: string | null;
    }>;
    pendingDrafts: number;
  };
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function weekLabel(start: Date, end: Date): string {
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

// ---------------------------------------------------------------------------
// buildWeeklyDigest
//
// Returns real data from Prisma for a single org. hasData is false when all
// three primary signal sources have zero activity, which suppresses sending.
// ---------------------------------------------------------------------------

export async function buildWeeklyDigest(orgId: string): Promise<WeeklyDigest> {
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * DAY_MS);
  const lastWeekStart = new Date(now.getTime() - 14 * DAY_MS);

  const [
    org,
    leadsThisWeek,
    leadsLastWeek,
    toursThisWeek,
    toursLastWeek,
    applicationsThisWeek,
    adSpendAgg,
    organicAgg,
    openInsightsCount,
    unreadLeadsCount,
    propertyLeadGroups,
    propertyTourGroups,
    propertiesList,
    // Hot visitor peak: max pageviewCount in any single VisitorSession this week
    visitorSessions,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    }),

    // Leads this week
    prisma.lead.count({
      where: { orgId, createdAt: { gte: thisWeekStart, lt: now } },
    }),

    // Leads last week (for delta)
    prisma.lead.count({
      where: { orgId, createdAt: { gte: lastWeekStart, lt: thisWeekStart } },
    }),

    // Tours this week: scheduled or completed, created or updated in window
    prisma.tour.count({
      where: {
        lead: { orgId },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        createdAt: { gte: thisWeekStart, lt: now },
      },
    }),

    // Tours last week
    prisma.tour.count({
      where: {
        lead: { orgId },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        createdAt: { gte: lastWeekStart, lt: thisWeekStart },
      },
    }),

    // Applications this week (submitted or approved)
    prisma.application.count({
      where: {
        lead: { orgId },
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED] },
        createdAt: { gte: thisWeekStart, lt: now },
      },
    }),

    // Ad spend this week (sum across all campaigns)
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: thisWeekStart, lt: now } },
      _sum: { spendCents: true },
    }),

    // Organic sessions this week (from SeoSnapshot)
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: thisWeekStart, lt: now } },
      _sum: { organicSessions: true },
    }),

    // Open insights (status=open, not dismissed or acknowledged)
    prisma.insight.count({
      where: { orgId, status: "open" },
    }),

    // Unread leads (status NEW)
    prisma.lead.count({
      where: { orgId, status: LeadStatus.NEW },
    }),

    // Lead count per property this week
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        createdAt: { gte: thisWeekStart, lt: now },
        propertyId: { not: null },
      },
      _count: { _all: true },
    }),

    // Tour count per property this week
    prisma.tour.groupBy({
      by: ["propertyId"],
      where: {
        lead: { orgId },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        createdAt: { gte: thisWeekStart, lt: now },
      },
      _count: { _all: true },
    }),

    // Property names (for top-properties rollup)
    prisma.property.findMany({
      where: { orgId },
      select: { id: true, name: true },
    }),

    // Visitor sessions this week — fetch max pageviewCount for hotVisitorPeak
    prisma.visitorSession.findMany({
      where: { orgId, startedAt: { gte: thisWeekStart, lt: now } },
      select: { pageviewCount: true },
      orderBy: { pageviewCount: "desc" },
      take: 1,
    }),
  ]);

  const adSpendCents = adSpendAgg._sum.spendCents ?? 0;
  const organicSessions = organicAgg._sum.organicSessions ?? 0;

  // SEO Agent digest data. Pulled in a second batch so we don't bloat
  // the primary Promise.all above. Each is cheap (indexed reads).
  const [thisWeekScores, lastWeekScores, openRecs, pendingDrafts] =
    await Promise.all([
      prisma.seoScoreHistory.findMany({
        where: { orgId, weekOf: { gte: thisWeekStart, lt: now } },
        select: { compositeScore: true },
      }),
      prisma.seoScoreHistory.findMany({
        where: { orgId, weekOf: { gte: lastWeekStart, lt: thisWeekStart } },
        select: { compositeScore: true },
      }),
      prisma.seoActionRecommendation.findMany({
        where: { orgId, status: "OPEN" },
        orderBy: [{ severity: "asc" }, { score: "desc" }],
        take: 12,
        select: {
          severity: true,
          title: true,
          property: { select: { name: true } },
        },
      }),
      prisma.contentDraft.count({
        where: {
          orgId,
          status: { in: ["PENDING_REVIEW", "GENERATING", "CHANGES_REQUESTED"] },
        },
      }),
    ]);

  function avgScore(rows: Array<{ compositeScore: number }>): number | null {
    if (rows.length === 0) return null;
    const sum = rows.reduce((acc, r) => acc + r.compositeScore, 0);
    return Math.round(sum / rows.length);
  }
  const avgScoreThisWeek = avgScore(thisWeekScores);
  const avgScoreLastWeek = avgScore(lastWeekScores);
  const scoreDelta =
    avgScoreThisWeek != null && avgScoreLastWeek != null
      ? avgScoreThisWeek - avgScoreLastWeek
      : null;

  const openRecsCritical = openRecs.filter((r) => r.severity === "CRITICAL").length;
  const openRecsHigh = openRecs.filter((r) => r.severity === "HIGH").length;
  const topRecommendations = openRecs.slice(0, 3).map((r) => ({
    title: r.title,
    severity: r.severity,
    propertyName: r.property?.name ?? null,
  }));

  const hotVisitorPeak =
    visitorSessions.length > 0 ? visitorSessions[0].pageviewCount : 0;

  // Build property name lookup
  const propNameById = new Map<string, string>(
    propertiesList.map((p) => [p.id, p.name])
  );

  // Build per-property lead/tour maps
  const leadsByProp = new Map<string, number>();
  for (const row of propertyLeadGroups) {
    if (row.propertyId) leadsByProp.set(row.propertyId, row._count._all);
  }

  const toursByProp = new Map<string, number>();
  for (const row of propertyTourGroups) {
    toursByProp.set(row.propertyId, row._count._all);
  }

  // Merge into topProperties — include only properties with at least 1 lead or tour
  const allPropIds = new Set([...leadsByProp.keys(), ...toursByProp.keys()]);
  const topProperties = Array.from(allPropIds)
    .map((pid) => ({
      name: propNameById.get(pid) ?? "Unknown property",
      leads: leadsByProp.get(pid) ?? 0,
      tours: toursByProp.get(pid) ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads || b.tours - a.tours)
    .slice(0, 5);

  const hasData =
    leadsThisWeek > 0 ||
    adSpendCents > 0 ||
    organicSessions > 0 ||
    avgScoreThisWeek != null ||
    openRecsCritical + openRecsHigh > 0;

  return {
    orgName: org?.name ?? orgId,
    orgId,
    weekLabel: weekLabel(thisWeekStart, now),
    hasData,
    metrics: {
      leadsThisWeek,
      leadsDelta: leadsThisWeek - leadsLastWeek,
      toursThisWeek,
      toursDelta: toursThisWeek - toursLastWeek,
      applicationsThisWeek,
      adSpendCents,
      organicSessions,
      hotVisitorPeak,
    },
    topProperties,
    openInsights: openInsightsCount,
    unreadLeads: unreadLeadsCount,
    seo: {
      avgScoreThisWeek,
      avgScoreLastWeek,
      scoreDelta,
      openRecsCritical,
      openRecsHigh,
      topRecommendations,
      pendingDrafts,
    },
  };
}
