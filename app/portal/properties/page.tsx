import type { Metadata } from "next";
import { Suspense } from "react";
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
// PropertyFormDialog hidden in the actions row — see issue #69. Import
// kept commented so re-enabling is one line when the backend lands.
// import { PropertyFormDialog } from "@/components/properties/property-form-dialog";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { DataTable, EntityCell } from "@/components/portal/ui/data-table";
import {
  EntityToolbar,
  type ToolbarView,
} from "@/components/portal/ui/entity-toolbar";
import { PillCell, NumberCell, EmptyCell } from "@/components/portal/ui/cells";
import { PropertiesSearch } from "@/components/portal/properties/properties-search";
import { PropertyAvatar } from "@/components/portal/properties/property-avatar";
import {
  ASSET_CLASS_LABEL,
  SIZE_BAND_LABEL,
  type AssetClass,
  type SizeBand,
} from "@/lib/properties/attrs";

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
    // Norman feedback (issue #54): custom filter chips so operators can
    // slice the portfolio by Asset Class, Size band, or Profile tag.
    // All three are URL-bound so the chips form a shareable view.
    assetClass?: string;
    size?: string;
    tag?: string;
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
  // Active attribute filters — null means "no filter applied".
  const assetClassFilter = sp.assetClass?.trim() || null;
  const sizeFilter = sp.size?.trim() || null;
  const tagFilter = sp.tag?.trim() || null;
  const PAGE_SIZE = 50;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // Property gate: respect UserPropertyAccess so a property-restricted
  // user (Norman → Telegraph Commons only) cannot see sibling
  // properties even on the org-wide list.
  const requestedIds = await parsePropertyFilter(sp, scope.orgId);
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

  // Attribute filter fragments. Asset class + size band live as derived
  // values (computed from propertyType/subtype + totalUnits), so the SQL
  // form maps the filter token back to the underlying columns. Profile
  // tags use Postgres' has-any on the text[] column with the GIN index
  // added in the 20260520_property_attributes migration.
  const attrWhereFragments: Prisma.PropertyWhereInput[] = [];
  if (assetClassFilter) {
    // Reverse-map from canonical asset class → enum value(s) on the
    // existing residential/commercial subtype columns.
    const SUB_FOR_CLASS: Record<string, Prisma.PropertyWhereInput> = {
      STUDENT_HOUSING: { residentialSubtype: "STUDENT_HOUSING" },
      MULTIFAMILY: { residentialSubtype: "MULTIFAMILY" },
      SENIOR_LIVING: { residentialSubtype: "SENIOR_LIVING" },
      SINGLE_FAMILY: { residentialSubtype: "SINGLE_FAMILY_RENTAL" },
      CO_LIVING: { residentialSubtype: "CO_LIVING" },
      SHORT_TERM: { residentialSubtype: "SHORT_TERM_RENTAL" },
      OFFICE: { commercialSubtype: "OFFICE" },
      RETAIL: { commercialSubtype: "RETAIL" },
      INDUSTRIAL: { commercialSubtype: "INDUSTRIAL" },
      MIXED_USE: { commercialSubtype: "MIXED_USE" },
      FLEX_SPACE: { commercialSubtype: "FLEX_SPACE" },
      MEDICAL_OFFICE: { commercialSubtype: "MEDICAL_OFFICE" },
    };
    const frag = SUB_FOR_CLASS[assetClassFilter];
    if (frag) attrWhereFragments.push(frag);
  }
  if (sizeFilter) {
    // Numeric band → totalUnits range. Inclusive bounds match the
    // labels Norman gave in the bug report.
    const SIZE_RANGES: Record<string, { gte?: number; lte?: number }> = {
      XS: { lte: 25 },
      S: { gte: 26, lte: 50 },
      M: { gte: 51, lte: 100 },
      L: { gte: 101, lte: 250 },
      XL: { gte: 251, lte: 1000 },
    };
    const range = SIZE_RANGES[sizeFilter];
    if (range) attrWhereFragments.push({ totalUnits: range });
  }
  if (tagFilter) {
    attrWhereFragments.push({ profileTags: { has: tagFilter } });
  }

  const baseWhere: Prisma.PropertyWhereInput = {
    ...withMarketableLifecycle(tenantWhere(scope)),
    ...visibilityWhere,
  };
  const filteredWhere: Prisma.PropertyWhereInput = {
    AND: [
      baseWhere,
      viewWhereFragment(view),
      searchWhereFragment,
      ...attrWhereFragments,
    ],
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

  // Counts of hidden lifecycles so the empty state can honestly
  // explain "you have N properties — they're EXCLUDED (auto-classified
  // as parking/storage) or pending curation review." Without this the
  // empty state read as 'you have no properties' even for orgs whose
  // AppFolio sync pulled 100+ rows that the classifier excluded.
  // Header-strip totals (listings + leads) run in the SAME wave as the hidden-
  // lifecycle counts — all four are independent of each other and of the page
  // rows above, so one round-trip instead of two. (Codex perf.)
  const [excludedCount, totalAnyLifecycle, totalListings, totalLeads] =
    await Promise.all([
      prisma.property
        .count({
          where: { ...tenantWhere(scope), lifecycle: "EXCLUDED" },
        })
        .catch(() => 0),
      prisma.property
        .count({ where: tenantWhere(scope) })
        .catch(() => 0),
      prisma.listing.count({ where: { property: baseWhere } }),
      prisma.lead.count({ where: { property: baseWhere } }),
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
  const totalAvailable = portfolioStats._sum.availableCount ?? 0;
  const properties = pageRows;

  // Latest weekly composite SEO score per property. One query, indexed
  // by (orgId, weekOf). Sparse fact — many properties will have no row
  // yet (first snapshot lands every Monday 05:00 UTC). UI renders null
  // as a muted dash.
  const pageIds = properties.map((p) => p.id);
  const latestScores = await prisma.seoScoreHistory
    .findMany({
      where: { propertyId: { in: pageIds } },
      orderBy: { weekOf: "desc" },
      select: { propertyId: true, compositeScore: true, weekOf: true },
    })
    .catch(() => [] as Array<{ propertyId: string | null; compositeScore: number; weekOf: Date }>);
  const seoScoreByProperty = new Map<string, number>();
  for (const s of latestScores) {
    if (!s.propertyId) continue;
    if (!seoScoreByProperty.has(s.propertyId)) {
      seoScoreByProperty.set(s.propertyId, s.compositeScore);
    }
  }
  // Norman feedback (issue #67): the listings + available counts in the
  // header were misleading (AppFolio import shows 141 "listings" when only
  // a handful are live). Suppressed in the description string; queries
  // retained so the toolbar/counters stay correct.
  void totalAvailable;
  void totalListings;

  // View tabs. Norman feedback (issue #66): we're not focused on direct
  // leasing-related metrics, so "Has vacancies" and "Actively leasing" are
  // hidden until the data warrants them. Left in the URL contract (?view=)
  // so old deep links still work — they just don't surface a tab to click.
  const views: ToolbarView[] = [
    {
      label: "All properties",
      href: "?view=all",
      count: counts.all,
      active: view === "all",
    },
    {
      label: "Recently synced",
      href: "?view=synced",
      count: counts.synced,
      active: view === "synced",
    },
  ];
  // Suppress unused-variable warnings on the dropped counts. Keeping the
  // queries so toggling the views back on stays a one-line change.
  void counts.vacant;
  void counts.leasing;

  return (
    <div className="space-y-3 ls-page-fade">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      <PageHeader
        title="Properties"
        description={
          // Norman feedback (issue #67): the listings + available counts
          // weren't matching what operators expected (141 listings vs the
          // 5-7 they actually have live), so we lead with the property
          // count and a single trustworthy roll-up (leads) instead.
          countAll === 0
            ? "Listings, leads, and tours for every property in your portfolio."
            : `${countAll.toLocaleString()} ${countAll === 1 ? "property" : "properties"} · ${totalLeads.toLocaleString()} ${totalLeads === 1 ? "lead" : "leads"}`
        }
        actions={
          <div className="flex items-center gap-2">
            {importedCount > 0 ? (
              <Link
                href="/portal/properties/curate"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="View your full AppFolio portfolio and add properties to LeaseStack"
              >
                + {importedCount} more in AppFolio
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
            {/* Add-property dialog hidden (issue #69) until the add-property
                backend is fully built out; properties currently flow in
                from AppFolio sync so the manual path is misleading. */}
          </div>
        }
      />

      {countAll === 0 ? (
        // Distinguish three empty-state shapes so the operator never
        // sees "you have no properties" when reality is "you have 126
        // properties but they're all auto-excluded as parking lots."
        // Norman / SG Real Estate hit this exact confusion on
        // 2026-06-01 with 127 properties (1 ACTIVE + 126 EXCLUDED)
        // showing as 'Add your first property'.
        totalAnyLifecycle === 0 ? (
          <EmptyState
            icon={<Building2 className="h-4 w-4" />}
            title="Add your first property to start tracking everything."
            body="Properties are the foundation — leads, tours, ad campaigns, chatbot transcripts, reputation scans, and traffic data all map back to a property. The fastest path is to connect AppFolio so we sync your portfolio automatically."
            secondary={{
              label: "Sync from AppFolio",
              href: "/portal/connect",
            }}
          />
        ) : importedCount > 0 ? (
          <EmptyState
            icon={<Building2 className="h-4 w-4" />}
            title={`${importedCount} ${importedCount === 1 ? "property" : "properties"} pending review.`}
            body={`AppFolio synced ${totalAnyLifecycle} ${totalAnyLifecycle === 1 ? "row" : "rows"} from your account. ${importedCount} need your review before they count as active — the curation queue lets you mark each one as a real property or a sub-record (parking, storage, model unit, etc.).`}
            action={{
              label: `Review ${importedCount} pending`,
              href: "/portal/properties/curate",
            }}
          />
        ) : (
          <EmptyState
            icon={<Building2 className="h-4 w-4" />}
            title="No active properties to show."
            body={`We synced ${totalAnyLifecycle} ${totalAnyLifecycle === 1 ? "row" : "rows"} from AppFolio. ${excludedCount} ${excludedCount === 1 ? "is" : "are"} auto-excluded as sub-records (parking lots, storage units, model units, etc.) and don't count toward your portfolio total. Use the curation queue to promote any that were misclassified.`}
            action={{
              label: "Open curation queue",
              href: "/portal/properties/curate",
            }}
            secondary={{
              label: "Re-sync AppFolio",
              href: "/portal/connect",
            }}
          />
        )
      ) : (
        <>
          {/* Search row sits above the view tabs so it scopes the visible
              counts. The component is debounced and URL-bound so
              shareable links preserve the active query. */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <EntityToolbar views={views} />
            <Suspense fallback={<div className="h-9 w-56 rounded-md border border-border bg-secondary" />}>
              <PropertiesSearch initialValue={searchQuery} />
            </Suspense>
          </div>
          {/* Active filter chips (issue #54). Renders only when at least
              one attribute filter is in the URL — clicking the × clears
              that single dimension while preserving the others, view, and
              search. */}
          {(assetClassFilter || sizeFilter || tagFilter) ? (
            <ActiveFilterChips
              assetClass={assetClassFilter}
              size={sizeFilter}
              tag={tagFilter}
            />
          ) : null}
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
                  key: "seoScore",
                  header: "SEO",
                  align: "right",
                  hideOnMobile: true,
                  accessor: (p) => {
                    const score = seoScoreByProperty.get(p.id);
                    if (score == null) {
                      return (
                        <span className="text-[11px] text-muted-foreground">
                          —
                        </span>
                      );
                    }
                    const tone =
                      score >= 75
                        ? "bg-green-50 text-green-700"
                        : score >= 50
                          ? "bg-amber-50 text-amber-800"
                          : "bg-red-50 text-red-700";
                    return (
                      <Link
                        href={`/portal/seo/agent?propertyId=${p.id}`}
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-mono font-semibold tabular-nums hover:opacity-80 transition-opacity ${tone}`}
                        title="Open SEO Agent for this property"
                      >
                        {score}
                      </Link>
                    );
                  },
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
            assetClass={assetClassFilter}
            size={sizeFilter}
            tag={tagFilter}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveFilterChips — pill row that shows currently-applied attribute
// filters from the URL and lets the operator clear them one at a time.
// Server component (Link-only). The whole props.assetClass / size / tag
// path renders as plain anchors with a `?` query string that strips
// just that one parameter, so the navigation stays accessible + JS-free.
// Issue #54.
// ---------------------------------------------------------------------------
function ActiveFilterChips({
  assetClass,
  size,
  tag,
}: {
  assetClass: string | null;
  size: string | null;
  tag: string | null;
}) {
  // Strip a single key from a fresh URLSearchParams; keep the others
  // intact so closing one chip never collapses the rest.
  const buildHref = (drop: "assetClass" | "size" | "tag"): string => {
    const params = new URLSearchParams();
    if (assetClass && drop !== "assetClass") params.set("assetClass", assetClass);
    if (size && drop !== "size") params.set("size", size);
    if (tag && drop !== "tag") params.set("tag", tag);
    const qs = params.toString();
    return qs ? `/portal/properties?${qs}` : "/portal/properties";
  };

  const chip = (
    key: "assetClass" | "size" | "tag",
    label: string,
  ) => (
    <Link
      key={key}
      href={buildHref(key)}
      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/15 transition-colors"
      title={`Clear ${label}`}
    >
      <span>{label}</span>
      <span aria-hidden="true" className="text-primary/70">×</span>
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
        Filters
      </span>
      {assetClass
        ? chip(
            "assetClass",
            ASSET_CLASS_LABEL[assetClass as AssetClass] ?? assetClass,
          )
        : null}
      {size ? chip("size", SIZE_BAND_LABEL[size as SizeBand] ?? size) : null}
      {tag ? chip("tag", `Tag: ${tag}`) : null}
      <Link
        href="/portal/properties"
        className="text-[11px] text-muted-foreground hover:text-foreground ml-1 underline-offset-2 hover:underline"
      >
        Clear all
      </Link>
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
  assetClass,
  size,
  tag,
}: {
  page: number;
  pageSize: number;
  total: number;
  view: ViewKey;
  searchQuery: string;
  assetClass: string | null;
  size: string | null;
  tag: string | null;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (view !== "all") params.set("view", view);
    if (searchQuery) params.set("q", searchQuery);
    // Attribute filter chips are URL-bound — paging must carry them or
    // page 2 silently resets the operator's filtered view.
    if (assetClass) params.set("assetClass", assetClass);
    if (size) params.set("size", size);
    if (tag) params.set("tag", tag);
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
            className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
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
            className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
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
