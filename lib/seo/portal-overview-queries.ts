import "server-only";
import { prisma } from "@/lib/db";
import { tenantWhere, type ScopedContext } from "@/lib/tenancy/scope";
import { propertyWhereFragment } from "@/lib/tenancy/property-filter";
import { dedupeSupersededByDate } from "@/lib/seo/snapshot-supersede";

// ---------------------------------------------------------------------------
// Portal SEO overview — property-scoped aggregate reads for /portal/seo.
//
// SeoSnapshot/SeoQuery/SeoLandingPage carry a propertyId column (Wave 3
// Phase 5): NULL = org-wide row, populated = one property's data. A
// property-restricted user (scope.allowedPropertyIds !== null) must NEVER
// see NULL rows — those can aggregate properties outside their grant.
// The canonical propertyWhereFragment() (lib/tenancy/property-filter.ts)
// enforces that, and — unlike a bespoke local copy — also returns the
// repo-wide `__no_property_access__` deny sentinel instead of fail-open
// when a restricted user's selection is fully out of grant. Unrestricted
// users keep the page's existing behavior (no propertyId filter unless
// one is selected).
// ---------------------------------------------------------------------------

type DateRange = { start: Date; end: Date };

export async function fetchSeoSnapshots(
  scope: ScopedContext,
  effectiveIds: string[] | null,
  range: DateRange,
) {
  const rows = await prisma.seoSnapshot.findMany({
    where: {
      ...tenantWhere(scope),
      date: { gte: range.start, lte: range.end },
      ...propertyWhereFragment(scope, effectiveIds),
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      propertyId: true,
      totalClicks: true,
      totalImpressions: true,
      avgCtr: true,
      avgPosition: true,
    },
  });
  // Org-wide (unrestricted, no selection) reads can otherwise sum a
  // legacy NULL-propertyId row and a property-scoped row for the same
  // date — see lib/seo/snapshot-supersede.ts. No-op when the fragment
  // above already constrained to specific propertyIds.
  return dedupeSupersededByDate(rows);
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
      ...propertyWhereFragment(scope, effectiveIds),
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
      ...propertyWhereFragment(scope, effectiveIds),
    },
    _sum: { sessions: true, users: true },
    orderBy: { _sum: { sessions: "desc" } },
    take: 12,
  });
}

/**
 * SeoActionRecommendation.propertyId is also nullable, same as the three
 * fetchers above — a restricted user must never see a NULL-propertyId
 * (org-wide) or out-of-grant recommendation title.
 */
export async function fetchSeoActionRecommendations(
  scope: ScopedContext,
  effectiveIds: string[] | null,
) {
  return prisma.seoActionRecommendation.findMany({
    where: {
      ...tenantWhere(scope),
      severity: { in: ["HIGH", "CRITICAL"] },
      ...propertyWhereFragment(scope, effectiveIds),
    },
    orderBy: { generatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      severity: true,
      generatedAt: true,
    },
  });
}
