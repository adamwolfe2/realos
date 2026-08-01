import "server-only";
import { prisma } from "@/lib/db";
import { tenantWhere, type ScopedContext } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Portal SEO overview — property-scoped aggregate reads for /portal/seo.
//
// SeoSnapshot/SeoQuery/SeoLandingPage carry a propertyId column (Wave 3
// Phase 5): NULL = org-wide row, populated = one property's data. A
// property-restricted user (scope.allowedPropertyIds !== null) must NEVER
// see NULL rows — those can aggregate properties outside their grant.
// seoPropertyWhereFragment() enforces that. Unrestricted users keep the
// page's existing behavior (no propertyId filter unless one is selected).
// ---------------------------------------------------------------------------

export function seoPropertyWhereFragment(
  scope: ScopedContext,
  effectiveIds: string[] | null,
): Record<string, unknown> {
  if (effectiveIds && effectiveIds.length > 0) {
    return { propertyId: { in: effectiveIds } };
  }
  if (scope.allowedPropertyIds !== null) {
    // Restricted user with no (or a fully-denied) selection — fall back to
    // their full allowed set. Never `{}` here: that would let a NULL
    // (org-wide) row leak through to a restricted user.
    return { propertyId: { in: scope.allowedPropertyIds } };
  }
  return {};
}

type DateRange = { start: Date; end: Date };

export async function fetchSeoSnapshots(
  scope: ScopedContext,
  effectiveIds: string[] | null,
  range: DateRange,
) {
  return prisma.seoSnapshot.findMany({
    where: {
      ...tenantWhere(scope),
      date: { gte: range.start, lte: range.end },
      ...seoPropertyWhereFragment(scope, effectiveIds),
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      totalClicks: true,
      totalImpressions: true,
      avgCtr: true,
      avgPosition: true,
    },
  });
}

export async function fetchSeoTopQueries(
  scope: ScopedContext,
  effectiveIds: string[] | null,
  range: DateRange,
) {
  return prisma.seoQuery.groupBy({
    by: ["query"],
    where: {
      ...tenantWhere(scope),
      date: { gte: range.start, lte: range.end },
      ...seoPropertyWhereFragment(scope, effectiveIds),
    },
    _sum: { clicks: true, impressions: true },
    orderBy: { _sum: { clicks: "desc" } },
    take: 12,
  });
}

export async function fetchSeoTopPages(
  scope: ScopedContext,
  effectiveIds: string[] | null,
  range: DateRange,
) {
  return prisma.seoLandingPage.groupBy({
    by: ["url"],
    where: {
      ...tenantWhere(scope),
      date: { gte: range.start, lte: range.end },
      ...seoPropertyWhereFragment(scope, effectiveIds),
    },
    _sum: { sessions: true, users: true },
    orderBy: { _sum: { sessions: "desc" } },
    take: 12,
  });
}
