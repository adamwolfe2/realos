import "server-only";
import { prisma } from "@/lib/db";
import { LeadStatus, TourStatus, ApplicationStatus } from "@prisma/client";
import { format } from "date-fns";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { marketableOrgClause } from "@/lib/tenancy/property-filter";
import { fetchDedupedSeoSnapshots, sumField } from "@/lib/seo/snapshot-supersede";

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

  // Every number in this email is scoped to the properties enabled in
  // LeaseStack. A connected AppFolio account imports the operator's whole
  // portfolio, so an ungated org-wide count emailed weekly numbers for
  // buildings they don't run here — and the top-properties leaderboard
  // even printed the EXCLUDED buildings' names.
  //   leadClause   — models with a NULLABLE propertyId (Lead): keep
  //                  unattributed captures.
  //   strictClause — models where propertyId is REQUIRED (Tour,
  //                  Application): no org-level rows exist to preserve.
  const [leadClause, strictClause] = await Promise.all([
    marketableOrgClause(orgId, "propertyId", { includeOrgLevel: true }),
    marketableOrgClause(orgId, "propertyId"),
  ]);

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
      where: { orgId, ...leadClause, createdAt: { gte: thisWeekStart, lt: now } },
    }),

    // Leads last week (for delta)
    prisma.lead.count({
      where: {
        orgId,
        ...leadClause,
        createdAt: { gte: lastWeekStart, lt: thisWeekStart },
      },
    }),

    // Tours this week: scheduled or completed, created or updated in window
    prisma.tour.count({
      where: {
        lead: { orgId },
        ...strictClause,
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        createdAt: { gte: thisWeekStart, lt: now },
      },
    }),

    // Tours last week
    prisma.tour.count({
      where: {
        lead: { orgId },
        ...strictClause,
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        createdAt: { gte: lastWeekStart, lt: thisWeekStart },
      },
    }),

    // Applications this week (submitted or approved)
    prisma.application.count({
      where: {
        lead: { orgId },
        ...strictClause,
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED] },
        createdAt: { gte: thisWeekStart, lt: now },
      },
    }),

    // Ad spend this week (sum across all campaigns). AdMetricDaily has no
    // propertyId of its own — it reaches one through its campaign, so the
    // gate has to be applied on the relation.
    prisma.adMetricDaily.aggregate({
      where: {
        orgId,
        campaign: leadClause,
        date: { gte: thisWeekStart, lt: now },
      },
      _sum: { spendCents: true },
    }),

    // Organic sessions this week (from SeoSnapshot). Org-wide read, so it
    // must apply the write-side supersede rule itself — see
    // lib/seo/snapshot-supersede.ts for why the write-side delete alone
    // isn't a strong enough guarantee against double-counting.
    fetchDedupedSeoSnapshots({
      orgId,
      ...leadClause,
      date: { gte: thisWeekStart, lt: now },
    }),

    // Open insights (status=open, not dismissed or acknowledged)
    prisma.insight.count({
      where: { orgId, ...leadClause, status: "open" },
    }),

    // Unread leads (status NEW)
    prisma.lead.count({
      where: { orgId, ...leadClause, status: LeadStatus.NEW },
    }),

    // Lead count per property this week
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        createdAt: { gte: thisWeekStart, lt: now },
        // NOTE: `propertyId: { not: null }` used to live here. Spreading
        // strictClause (which also keys on propertyId) BELOW it silently
        // clobbered the gate — object literals take the last key. The
        // marketable clause is already an explicit id list, so non-null is
        // implied; keep this as the single propertyId key in this where.
        ...strictClause,
      },
      _count: { _all: true },
    }),

    // Tour count per property this week
    prisma.tour.groupBy({
      by: ["propertyId"],
      where: {
        lead: { orgId },
        ...strictClause,
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        createdAt: { gte: thisWeekStart, lt: now },
      },
      _count: { _all: true },
    }),

    // Property names (for top-properties rollup)
    prisma.property.findMany({
      where: marketablePropertyWhere(orgId),
      select: { id: true, name: true },
    }),

    // Visitor sessions this week — fetch max pageviewCount for hotVisitorPeak
    prisma.visitorSession.findMany({
      where: {
        orgId,
        ...leadClause,
        startedAt: { gte: thisWeekStart, lt: now },
      },
      select: { pageviewCount: true },
      orderBy: { pageviewCount: "desc" },
      take: 1,
    }),
  ]);

  const adSpendCents = adSpendAgg._sum.spendCents ?? 0;
  const organicSessions = sumField(organicAgg, "organicSessions");

  // SEO Agent digest data. Pulled in a second batch so we don't bloat
  // the primary Promise.all above. Each is cheap (indexed reads).
  const [thisWeekScores, lastWeekScores, openRecs, pendingDrafts] =
    await Promise.all([
      prisma.seoScoreHistory.findMany({
        where: {
          orgId,
          ...leadClause,
          weekOf: { gte: thisWeekStart, lt: now },
        },
        select: { compositeScore: true },
      }),
      prisma.seoScoreHistory.findMany({
        where: {
          orgId,
          ...leadClause,
          weekOf: { gte: lastWeekStart, lt: thisWeekStart },
        },
        select: { compositeScore: true },
      }),
      // This one SELECTS `property.name` and the email renders it as
      // topRecommendations[].propertyName — so leaving it ungated printed
      // the names of buildings the customer never onboarded straight into
      // their inbox. Exactly the leaderboard defect this file's header
      // claims was fixed, 160 lines below the fix.
      prisma.seoActionRecommendation.findMany({
        where: { orgId, ...leadClause, status: "OPEN" },
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
          ...leadClause,
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
