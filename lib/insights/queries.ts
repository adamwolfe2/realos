import "server-only";
import { prisma } from "@/lib/db";
import { propertyIdsToWhere } from "@/lib/tenancy/property-filter";

// ---------------------------------------------------------------------------
// Read helpers for Insight rows. Used by the Command Center, /portal/insights
// listing page, and the dashboard inline card.
// ---------------------------------------------------------------------------

export type InsightRow = Awaited<ReturnType<typeof getOpenInsights>>[number];

// Rank used to sort insights by severity correctly.
//
// Reporter bug #59 (Norman): the dashboard showed "46 critical · 3 warning"
// in the header but the three cards rendered below were all WARNING. Root
// cause: `severity` is a string column ("critical" | "warning" | "info")
// and `orderBy: { severity: "desc" }` does an alphabetical sort, which
// produces [warning, info, critical] — exactly the opposite of what the
// product needs. Switched to a fetch-then-rank approach so critical
// always lands first regardless of the column's string value.
const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function rankSeverity(s: string): number {
  return SEVERITY_RANK[s] ?? 99;
}

// Norman bug #71: rent-roll insights (renewal cliffs, occupancy
// vacancy alerts, rent-vs-portfolio comparisons) belong to PMS territory
// — LeaseStack is positioned as marketing intelligence, not a renewal
// pipeline. The detectors keep firing (data still flows into the
// Insight table for historical analysis + reporting) but the operator-
// facing surfaces filter them out so the dashboard/property pages
// don't mix marketing signal with leasing operations. Flip back by
// passing { includeRentRoll: true } when we re-enable Operations.
const RENT_ROLL_KINDS = new Set([
  "renewal_cliff",
  "vacancy_needs_boost",
  "leasing_velocity_drop",
]);
const RENT_ROLL_CATEGORIES = new Set(["renewals", "occupancy"]);

export async function getOpenInsights(
  orgId: string,
  opts: {
    propertyId?: string;
    limit?: number;
    /** Default false. Pass true to bypass the rent-roll filter (admin /
     * reports surfaces that explicitly want every detector). */
    includeRentRoll?: boolean;
  } = {},
) {
  const now = new Date();
  const limit = opts.limit ?? 50;
  // Pull a wider candidate window so the in-memory severity sort has
  // enough rows to surface the highest-severity items before we slice
  // down to the caller's limit. 4× headroom is enough for any realistic
  // dashboard render (limit 3-50) and stays well under any expensive
  // query budget.
  const candidates = await prisma.insight.findMany({
    where: {
      orgId,
      ...(opts.propertyId ? { propertyId: opts.propertyId } : {}),
      status: { in: ["open", "acknowledged"] },
      OR: [{ snoozeUntil: null }, { snoozeUntil: { lt: now } }],
      ...(opts.includeRentRoll
        ? {}
        : {
            kind: { notIn: Array.from(RENT_ROLL_KINDS) },
            category: { notIn: Array.from(RENT_ROLL_CATEGORIES) },
          }),
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(limit * 4, 200),
    select: {
      id: true,
      kind: true,
      category: true,
      severity: true,
      title: true,
      body: true,
      suggestedAction: true,
      href: true,
      context: true,
      status: true,
      createdAt: true,
      propertyId: true,
      entityType: true,
      entityId: true,
      acknowledgedAt: true,
      property: { select: { id: true, name: true } },
    },
  });

  const sorted = [...candidates].sort((a, b) => {
    const rankDelta = rankSeverity(a.severity) - rankSeverity(b.severity);
    if (rankDelta !== 0) return rankDelta;
    // Same severity → newest first (matches createdAt: "desc" prefilter).
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return sorted.slice(0, limit);
}

export async function getInsightCounts(
  orgId: string,
  options: { propertyIds?: string[] | null; includeRentRoll?: boolean } = {},
) {
  const rows = await prisma.insight.groupBy({
    by: ["severity", "status"],
    where: {
      orgId,
      status: { in: ["open", "acknowledged"] },
      ...propertyIdsToWhere(options.propertyIds ?? null),
      // Match the getOpenInsights filter (Norman bug #71) so the counts
      // the badge shows and the rows the panel renders stay in sync.
      ...(options.includeRentRoll
        ? {}
        : {
            kind: { notIn: Array.from(RENT_ROLL_KINDS) },
            category: { notIn: Array.from(RENT_ROLL_CATEGORIES) },
          }),
    },
    _count: true,
  });

  const counts = {
    critical: 0,
    warning: 0,
    info: 0,
    open: 0,
    acknowledged: 0,
    total: 0,
  };

  for (const r of rows) {
    if (r.severity === "critical") counts.critical += r._count;
    else if (r.severity === "warning") counts.warning += r._count;
    else counts.info += r._count;

    if (r.status === "open") counts.open += r._count;
    else if (r.status === "acknowledged") counts.acknowledged += r._count;

    counts.total += r._count;
  }

  return counts;
}

export async function getRecentInsightsForBriefing(
  orgId: string,
  sinceViewedAt: Date | null,
  limit = 20,
) {
  const since = sinceViewedAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Same severity-rank workaround as getOpenInsights — see SEVERITY_RANK
  // comment. Postgres' string sort on "critical/warning/info" lands
  // critical at the bottom which is the opposite of what we want.
  const rows = await prisma.insight.findMany({
    where: {
      orgId,
      status: { in: ["open", "acknowledged"] },
      createdAt: { gte: since },
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(limit * 4, 200),
    select: {
      id: true,
      kind: true,
      category: true,
      severity: true,
      title: true,
      body: true,
      suggestedAction: true,
      href: true,
      context: true,
      createdAt: true,
      property: { select: { id: true, name: true } },
    },
  });
  return [...rows]
    .sort((a, b) => {
      const rankDelta = rankSeverity(a.severity) - rankSeverity(b.severity);
      if (rankDelta !== 0) return rankDelta;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, limit);
}
