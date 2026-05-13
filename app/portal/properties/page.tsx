import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { withMarketableLifecycle } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  isAccessDenied,
  parsePropertyFilter,
} from "@/lib/tenancy/property-filter";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { formatDistanceToNow } from "date-fns";
import { Building2, MapPin } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PropertyFormDialog } from "@/components/properties/property-form-dialog";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { DataTable, EntityCell } from "@/components/portal/ui/data-table";
import {
  EntityToolbar,
  type ToolbarView,
} from "@/components/portal/ui/entity-toolbar";
import { PillCell, NumberCell, EmptyCell } from "@/components/portal/ui/cells";
import { PropertiesSearch } from "@/components/portal/properties/properties-search";
import { PropertyAvatar } from "@/components/portal/properties/property-avatar";

export const metadata: Metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

// /portal/properties — Twenty-CRM-style dense table of every property
// in the portfolio. Replaces the previous card grid that took 200px+
// per row and made it impossible to scan a 100-property portfolio.
//
// View tabs filter the result set without leaving the URL, so the
// operator can flip between "everything", "has vacancies",
// "actively leasing", "recently synced" without losing context.

// Row shape after the May 2026 pagination refactor — _count is intentionally
// dropped because per-row leads/listings counts created N+1-style joins on
// every render and pushed page latency past 2s on portfolios with 500+ rows.
// Per-row drill-in still works via the entity link to /portal/properties/[id].
type PropertyRow = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  availableCount: number | null;
  totalUnits: number | null;
  lastSyncedAt: Date | null;
  // Image hierarchy on the avatar — heroImageUrl wins, then first
  // photoUrls entry, then logoUrl alone, then a Building icon fallback
  // (PropertyAvatar handles the cascade). logoUrl ALSO overlays the
  // hero as a small badge when both are present.
  heroImageUrl: string | null;
  photoUrls: Prisma.JsonValue;
  logoUrl: string | null;
};

type ViewKey = "all" | "vacant" | "leasing" | "synced";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function PropertiesList({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    property?: string;
    properties?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const rawView = sp.view;
  const view: ViewKey = (
    ["all", "vacant", "leasing", "synced"] as const
  ).includes(rawView as never)
    ? (rawView as ViewKey)
    : "all";
  const searchQuery = (sp.q ?? "").trim();
  const PAGE_SIZE = 50;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // Property gate: respect UserPropertyAccess so a property-restricted
  // user (Norman → Telegraph Commons only) cannot see sibling
  // properties even on the org-wide list.
  const requestedIds = parsePropertyFilter(sp);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);
  // Build the visibility constraint. If the user is restricted, filter
  // to their allowed set even when no URL selection was made.
  const visibilityWhere =
    effectiveIds && effectiveIds.length > 0
      ? { id: { in: effectiveIds } }
      : effectiveIds && effectiveIds.length === 0 && scope.allowedPropertyIds
        ? // Restricted user requested properties they don't have. Force
          // empty result rather than widening to org.
          { id: "__no_property_access__" }
        : {};

  // -------------------------------------------------------------------
  // Pagination + database-side filtering refactor (May 2026).
  //
  // Previously we fetched ALL marketable rows + 3 _count subqueries each
  // and filtered in memory. That was fine at 100 properties; painful at
  // 1,000; broken at 5,000. The new shape:
  //   1. Build a single WHERE matching visibility + view + search.
  //   2. Run cheap parallel count() queries for each view tab so the
  //      toolbar still shows real numbers.
  //   3. Run aggregate(_sum) for the header strip totals.
  //   4. Run findMany() with skip/take for THIS page only.
  //
  // The _count include is dropped from the page query — leads/tours/
  // listings totals are best surfaced in the header (portfolio-level)
  // and on individual property detail pages, not as per-row badges on
  // the table (which forced N+1-style joins on every render).
  // -------------------------------------------------------------------

  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  // View-specific WHERE fragments. Each maps the toolbar tab to the
  // database constraint that defines membership.
  const viewWhereFragment = (v: ViewKey): Prisma.PropertyWhereInput => {
    if (v === "vacant") return { availableCount: { gt: 0 } };
    if (v === "leasing") {
      return {
        OR: [
          { leads: { some: {} } },
          { listings: { some: {} } },
        ],
      };
    }
    if (v === "synced") return { lastSyncedAt: { gte: sevenDaysAgo } };
    return {};
  };

  // Search WHERE — case-insensitive match on the columns the table
  // surfaces. Postgres ILIKE works through Prisma's `mode: "insensitive"`
  // string filter without needing a separate full-text index. For very
  // large portfolios consider a pg_trgm index on (name, addressLine1).
  const searchWhereFragment: Prisma.PropertyWhereInput = searchQuery
    ? {
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { addressLine1: { contains: searchQuery, mode: "insensitive" } },
          { city: { contains: searchQuery, mode: "insensitive" } },
          { state: { contains: searchQuery, mode: "insensitive" } },
        ],
      }
    : {};

  const baseWhere: Prisma.PropertyWhereInput = {
    ...withMarketableLifecycle(tenantWhere(scope)),
    ...visibilityWhere,
  };
  const filteredWhere: Prisma.PropertyWhereInput = {
    AND: [baseWhere, viewWhereFragment(view), searchWhereFragment],
  };

  // Parallel queries: per-view counts (toolbar), portfolio totals,
  // current page rows, total filtered count for pagination, and the
  // pending-curation badge.
  const [
    countAll,
    countVacant,
    countLeasing,
    countSynced,
    portfolioStats,
    pageRows,
    filteredTotal,
    importedCount,
  ] = await Promise.all([
    prisma.property.count({ where: baseWhere }),
    prisma.property.count({
      where: { AND: [baseWhere, viewWhereFragment("vacant")] },
    }),
    prisma.property.count({
      where: { AND: [baseWhere, viewWhereFragment("leasing")] },
    }),
    prisma.property.count({
      where: { AND: [baseWhere, viewWhereFragment("synced")] },
    }),
    // Portfolio-wide totals for the header. _sum runs in one round-trip
    // against the indexed `availableCount`. Listings + leads totals are
    // surfaced via separate count() queries below to keep the same
    // header copy semantics without per-row joins.
    prisma.property.aggregate({
      where: baseWhere,
      _sum: { availableCount: true },
    }),
    // The actual table page. Note: _count is intentionally OFF here so
    // we don't pay the per-row subquery cost for thousands of rows.
    // If we need leads/listings counts in the table later we can add a
    // single denormalized column or a materialised view.
    prisma.property.findMany({
      where: filteredWhere,
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.property.count({ where: filteredWhere }),
    prisma.property.count({
      where: {
        ...tenantWhere(scope),
        lifecycle: "IMPORTED",
        ...visibilityWhere,
      },
    }),
  ]);

  const counts = {
    all: countAll,
    vacant: countVacant,
    leasing: countLeasing,
    synced: countSynced,
  };

  // Top-line totals for the header strip. Listings + leads aggregates
  // require separate scoped count() queries because Prisma doesn't
  // support `_sum` on related _count fields. These run in parallel to
  // the rest above so wall-clock impact is one extra round-trip.
  const [totalListings, totalLeads] = await Promise.all([
    prisma.listing.count({ where: { property: baseWhere } }),
    prisma.lead.count({ where: { property: baseWhere } }),
  ]);
  const totalAvailable = portfolioStats._sum.availableCount ?? 0;
  const properties = pageRows;

  const views: ToolbarView[] = [
    {
      label: "All properties",
      href: "?view=all",
      count: counts.all,
      active: view === "all",
    },
    {
      label: "Has vacancies",
      href: "?view=vacant",
      count: counts.vacant,
      active: view === "vacant",
    },
    {
      label: "Actively leasing",
      href: "?view=leasing",
      count: counts.leasing,
      active: view === "leasing",
    },
    {
      label: "Recently synced",
      href: "?view=synced",
      count: counts.synced,
      active: view === "synced",
    },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      <PageHeader
        title="Properties"
        description={
          countAll === 0
            ? "Listings, leads, and tours for every property in your portfolio."
            : `${countAll.toLocaleString()} ${countAll === 1 ? "property" : "properties"} · ${totalListings.toLocaleString()} listings · ${totalAvailable.toLocaleString()} available · ${totalLeads.toLocaleString()} leads`
        }
        actions={
          <div className="flex items-center gap-2">
            {importedCount > 0 ? (
              <Link
                href="/portal/properties/curate"
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                title="Review AppFolio-imported rows that haven't been classified yet"
              >
                Review {importedCount} pending
              </Link>
            ) : null}
            {countAll >= 2 ? (
              <Link
                href="/portal/properties/compare"
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Compare
              </Link>
            ) : null}
            <PropertyFormDialog />
          </div>
        }
      />

      {countAll === 0 ? (
        <EmptyState
          icon={<Building2 className="h-4 w-4" />}
          title="Add your first property to start tracking everything."
          body="Properties are the foundation — leads, tours, ad campaigns, chatbot transcripts, reputation scans, and traffic data all map back to a property. The fastest path is to connect AppFolio so we sync your portfolio automatically."
          secondary={{
            label: "Sync from AppFolio",
            href: "/portal/connect",
          }}
        />
      ) : (
        <>
          {/* Search row sits above the view tabs so it scopes the visible
              counts. The component is debounced and URL-bound so
              shareable links preserve the active query. */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <EntityToolbar views={views} />
            <PropertiesSearch initialValue={searchQuery} />
          </div>
          {properties.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-4 w-4" />}
              title={
                searchQuery
                  ? `No properties match "${searchQuery}"`
                  : "No properties match this view."
              }
              body={
                searchQuery
                  ? "Try a different search term, or clear the search to see all properties in this view."
                  : undefined
              }
              variant="bare"
            />
          ) : (
            <DataTable<PropertyRow>
              rows={properties as PropertyRow[]}
              getRowHref={(p) => `/portal/properties/${p.id}`}
              columns={[
                {
                  key: "name",
                  header: "Property",
                  accessor: (p) => {
                    // Pick the best-available image. photoUrls is a JSON
                    // column (string[] from AppFolio sync) — coerce safely
                    // so a malformed row never crashes the row map.
                    const photoFallback = (() => {
                      const arr = p.photoUrls;
                      if (Array.isArray(arr) && arr.length > 0) {
                        const first = arr[0];
                        return typeof first === "string" && first.length > 0
                          ? first
                          : null;
                      }
                      return null;
                    })();
                    const avatarSrc = p.heroImageUrl ?? photoFallback;
                    return (
                      <EntityCell
                        name={p.name}
                        seed={p.id}
                        avatar={
                          <PropertyAvatar
                            src={avatarSrc}
                            logoSrc={p.logoUrl}
                            size="sm"
                          />
                        }
                        secondary={
                          p.addressLine1 ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin
                                className="h-2.5 w-2.5 opacity-60"
                                aria-hidden="true"
                              />
                              {[p.addressLine1, p.city]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          ) : null
                        }
                      />
                    );
                  },
                },
                {
                  key: "location",
                  header: "Location",
                  hideOnMobile: true,
                  accessor: (p) => {
                    const loc = [p.city, p.state].filter(Boolean).join(", ");
                    return loc ? (
                      <PillCell tone="muted">{loc}</PillCell>
                    ) : (
                      <EmptyCell />
                    );
                  },
                },
                {
                  key: "available",
                  header: "Available",
                  align: "right",
                  accessor: (p) => {
                    const avail = p.availableCount ?? 0;
                    return avail > 0 ? (
                      <PillCell tone="warning">{avail} open</PillCell>
                    ) : (
                      <EmptyCell />
                    );
                  },
                },
                {
                  key: "units",
                  header: "Units",
                  align: "right",
                  hideOnMobile: true,
                  accessor: (p) =>
                    p.totalUnits ? (
                      <NumberCell value={p.totalUnits} />
                    ) : (
                      <EmptyCell />
                    ),
                },
                {
                  key: "synced",
                  header: "Last synced",
                  hideOnMobile: true,
                  accessor: (p) =>
                    p.lastSyncedAt ? (
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatDistanceToNow(p.lastSyncedAt, {
                          addSuffix: true,
                        })}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Never
                      </span>
                    ),
                },
              ]}
            />
          )}

          {/* Pagination — only renders when there's more than one page worth
              of filtered results. Cursor-based pagination would be cleaner
              but skip/take is fine for the realistic upper bound here
              (tens of thousands of properties at most). */}
          <PropertiesPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filteredTotal}
            view={view}
            searchQuery={searchQuery}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination — server-rendered prev/next with the current view + search
// preserved so deep links to /portal/properties?view=vacant&q=foo&page=3
// keep working. Hidden when there's only one page worth of results so
// small portfolios don't see a meaningless "Page 1 of 1" footer.
// ---------------------------------------------------------------------------
function PropertiesPagination({
  page,
  pageSize,
  total,
  view,
  searchQuery,
}: {
  page: number;
  pageSize: number;
  total: number;
  view: ViewKey;
  searchQuery: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (view !== "all") params.set("view", view);
    if (searchQuery) params.set("q", searchQuery);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/portal/properties?${qs}` : "/portal/properties";
  };

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Properties pagination"
      className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"
    >
      <div>
        Showing <span className="font-medium text-foreground">{start.toLocaleString()}</span>
        –<span className="font-medium text-foreground">{end.toLocaleString()}</span> of{" "}
        <span className="font-medium text-foreground">{total.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            ← Previous
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground/60">
            ← Previous
          </span>
        )}
        <span className="px-2 tabular-nums">
          Page {page.toLocaleString()} of {totalPages.toLocaleString()}
        </span>
        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            Next →
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground/60">
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}
