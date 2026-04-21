import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Read helpers for Insight rows. Used by the Command Center, /portal/insights
// listing page, and the dashboard inline card.
// ---------------------------------------------------------------------------

export type InsightRow = Awaited<ReturnType<typeof getOpenInsights>>[number];

export async function getOpenInsights(
  orgId: string,
  opts: { propertyId?: string; limit?: number } = {},
) {
  const now = new Date();
  return prisma.insight.findMany({
    where: {
      orgId,
      ...(opts.propertyId ? { propertyId: opts.propertyId } : {}),
      status: { in: ["open", "acknowledged"] },
      OR: [{ snoozeUntil: null }, { snoozeUntil: { lt: now } }],
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 50,
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
}

export async function getInsightCounts(orgId: string) {
  const rows = await prisma.insight.groupBy({
    by: ["severity", "status"],
    where: { orgId, status: { in: ["open", "acknowledged"] } },
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
  return prisma.insight.findMany({
    where: {
      orgId,
      status: { in: ["open", "acknowledged"] },
      createdAt: { gte: since },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: limit,
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
}
