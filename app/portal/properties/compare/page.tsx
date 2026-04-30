import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import {
  Building2,
  ArrowRight,
  Star,
  CheckCircle2,
  Megaphone,
  Users,
  Calendar,
  Home,
  AlertTriangle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import {
  TourStatus,
  ApplicationStatus,
  LeadStatus,
} from "@prisma/client";

export const metadata: Metadata = { title: "Compare properties" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/properties/compare?ids=A,B[,C…]
//
// Side-by-side comparison of up to 4 properties: occupancy, leads, tour
// completion, applications, ad spend (active campaigns), reputation. Lets
// the operator answer "which property is performing best/worst?" in one
// glance instead of clicking through 4 separate detail pages.
// ---------------------------------------------------------------------------

const MAX_COMPARE = 4;

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(num: number | null) {
  if (num == null) return "—";
  return `${Math.round(num)}%`;
}

export default async function ComparePropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const idsParam = sp.ids?.trim() ?? "";
  const requestedIds = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_COMPARE)
    : [];

  // Always show all properties as picker options.
  const allProperties = await prisma.property.findMany({
    where: tenantWhere(scope),
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, state: true },
  });

  if (requestedIds.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow={
            <Link href="/portal/properties" className="hover:underline">
              ← Properties
            </Link>
          }
          title="Compare properties"
          description="Pick up to four properties to view side-by-side performance, occupancy, and reputation."
        />
        <PropertyPicker
          properties={allProperties}
          selectedIds={[]}
          maxCompare={MAX_COMPARE}
        />
      </div>
    );
  }

  const since28d = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  const properties = await prisma.property.findMany({
    where: { id: { in: requestedIds }, orgId: scope.orgId },
    select: {
      id: true,
      name: true,
      addressLine1: true,
      city: true,
      state: true,
      heroImageUrl: true,
      totalUnits: true,
      availableCount: true,
      googleAggRating: true,
      googleAggReviewCount: true,
      yearBuilt: true,
      lastSyncedAt: true,
    },
  });

  // Re-order to match URL order
  const orderedProperties = requestedIds
    .map((id) => properties.find((p) => p.id === id))
    .filter((p): p is (typeof properties)[number] => Boolean(p));

  if (orderedProperties.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow={
            <Link href="/portal/properties" className="hover:underline">
              ← Properties
            </Link>
          }
          title="Compare properties"
        />
        <p className="text-sm text-muted-foreground">
          None of those properties were found in your portfolio. Pick from the list below.
        </p>
        <PropertyPicker
          properties={allProperties}
          selectedIds={[]}
          maxCompare={MAX_COMPARE}
        />
      </div>
    );
  }

  const propertyIds = orderedProperties.map((p) => p.id);

  // Run all aggregates in parallel
  const [
    leadsByProp,
    leadsSignedByProp,
    toursByProp,
    toursCompletedByProp,
    appsByProp,
    appsApprovedByProp,
    activeCampaignsByProp,
    spendByProp,
    listingsByProp,
    mentionsByProp,
    mentionsNegativeByProp,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: { orgId: scope.orgId, propertyId: { in: propertyIds }, createdAt: { gte: since28d } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        orgId: scope.orgId,
        propertyId: { in: propertyIds },
        status: LeadStatus.SIGNED,
      },
      _count: { _all: true },
    }),
    prisma.tour.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: propertyIds }, lead: tenantWhere(scope) },
      _count: { _all: true },
    }),
    prisma.tour.groupBy({
      by: ["propertyId"],
      where: {
        propertyId: { in: propertyIds },
        status: TourStatus.COMPLETED,
        lead: tenantWhere(scope),
      },
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: propertyIds }, lead: tenantWhere(scope) },
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ["propertyId"],
      where: {
        propertyId: { in: propertyIds },
        status: ApplicationStatus.APPROVED,
        lead: tenantWhere(scope),
      },
      _count: { _all: true },
    }),
    prisma.adCampaign.groupBy({
      by: ["propertyId"],
      where: {
        orgId: scope.orgId,
        propertyId: { in: propertyIds },
        status: { in: ["ENABLED", "ACTIVE"] },
      },
      _count: { _all: true },
    }),
    // Spend roll-up: sum the denormalized spendToDateCents on AdCampaign
    // grouped by property. Approximation of "ad spend per property" without
    // joining AdMetricDaily.
    prisma.adCampaign.groupBy({
      by: ["propertyId"],
      where: {
        orgId: scope.orgId,
        propertyId: { in: propertyIds },
      },
      _sum: { spendToDateCents: true },
    }),
    prisma.listing.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: propertyIds } },
      _count: { _all: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["propertyId"],
      where: { orgId: scope.orgId, propertyId: { in: propertyIds } },
      _count: { _all: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["propertyId"],
      where: {
        orgId: scope.orgId,
        propertyId: { in: propertyIds },
        sentiment: "NEGATIVE",
      },
      _count: { _all: true },
    }),
  ]);

  function asMap<T extends { propertyId: string | null }>(rows: T[]) {
    const m = new Map<string, T>();
    for (const r of rows) {
      if (r.propertyId) m.set(r.propertyId, r);
    }
    return m;
  }

  const leadsMap = asMap(leadsByProp);
  const leadsSignedMap = asMap(leadsSignedByProp);
  const toursMap = asMap(toursByProp);
  const toursDoneMap = asMap(toursCompletedByProp);
  const appsMap = asMap(appsByProp);
  const appsApprovedMap = asMap(appsApprovedByProp);
  const campaignsMap = asMap(activeCampaignsByProp);
  const spendMap = asMap(spendByProp);
  const listingsMap = asMap(listingsByProp);
  const mentionsMap = asMap(mentionsByProp);
  const mentionsNegMap = asMap(mentionsNegativeByProp);

  type Row = {
    label: string;
    icon: React.ReactNode;
    value: (id: string) => React.ReactNode;
    isHigherBetter?: boolean;
    raw?: (id: string) => number | null;
    formatter?: "money" | "percent" | "number";
  };

  const rows: Row[] = [
    {
      label: "Address",
      icon: <Home className="h-3.5 w-3.5" />,
      value: (id) => {
        const p = orderedProperties.find((x) => x.id === id);
        if (!p) return "—";
        return (
          <span className="text-foreground">
            {[p.addressLine1, p.city, p.state].filter(Boolean).join(", ") || "—"}
          </span>
        );
      },
    },
    {
      label: "Total units",
      icon: <Building2 className="h-3.5 w-3.5" />,
      value: (id) => {
        const p = orderedProperties.find((x) => x.id === id);
        return p?.totalUnits?.toLocaleString() ?? "—";
      },
      raw: (id) =>
        orderedProperties.find((x) => x.id === id)?.totalUnits ?? null,
      isHigherBetter: true,
    },
    {
      label: "Occupancy",
      icon: <Building2 className="h-3.5 w-3.5" />,
      value: (id) => {
        const p = orderedProperties.find((x) => x.id === id);
        if (!p?.totalUnits) return "—";
        const occupied = p.totalUnits - (p.availableCount ?? 0);
        const pct = (occupied / p.totalUnits) * 100;
        return `${Math.round(pct)}%`;
      },
      raw: (id) => {
        const p = orderedProperties.find((x) => x.id === id);
        if (!p?.totalUnits) return null;
        const occupied = p.totalUnits - (p.availableCount ?? 0);
        return (occupied / p.totalUnits) * 100;
      },
      isHigherBetter: true,
    },
    {
      label: "Active listings",
      icon: <Building2 className="h-3.5 w-3.5" />,
      value: (id) =>
        listingsMap.get(id)?._count._all.toLocaleString() ?? "0",
      raw: (id) => listingsMap.get(id)?._count._all ?? 0,
      isHigherBetter: true,
    },
    {
      label: "Leads (28d)",
      icon: <Users className="h-3.5 w-3.5" />,
      value: (id) =>
        leadsMap.get(id)?._count._all.toLocaleString() ?? "0",
      raw: (id) => leadsMap.get(id)?._count._all ?? 0,
      isHigherBetter: true,
    },
    {
      label: "Total tours",
      icon: <Calendar className="h-3.5 w-3.5" />,
      value: (id) =>
        toursMap.get(id)?._count._all.toLocaleString() ?? "0",
      raw: (id) => toursMap.get(id)?._count._all ?? 0,
      isHigherBetter: true,
    },
    {
      label: "Tours completed",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      value: (id) =>
        toursDoneMap.get(id)?._count._all.toLocaleString() ?? "0",
      raw: (id) => toursDoneMap.get(id)?._count._all ?? 0,
      isHigherBetter: true,
    },
    {
      label: "Applications",
      icon: <Users className="h-3.5 w-3.5" />,
      value: (id) =>
        appsMap.get(id)?._count._all.toLocaleString() ?? "0",
      raw: (id) => appsMap.get(id)?._count._all ?? 0,
      isHigherBetter: true,
    },
    {
      label: "Approval rate",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      value: (id) => {
        const total = appsMap.get(id)?._count._all ?? 0;
        const approved = appsApprovedMap.get(id)?._count._all ?? 0;
        if (total === 0) return "—";
        return `${Math.round((approved / total) * 100)}%`;
      },
      raw: (id) => {
        const total = appsMap.get(id)?._count._all ?? 0;
        const approved = appsApprovedMap.get(id)?._count._all ?? 0;
        if (total === 0) return null;
        return (approved / total) * 100;
      },
      isHigherBetter: true,
    },
    {
      label: "Signed leads",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      value: (id) =>
        leadsSignedMap.get(id)?._count._all.toLocaleString() ?? "0",
      raw: (id) => leadsSignedMap.get(id)?._count._all ?? 0,
      isHigherBetter: true,
    },
    {
      label: "Active campaigns",
      icon: <Megaphone className="h-3.5 w-3.5" />,
      value: (id) =>
        campaignsMap.get(id)?._count._all.toLocaleString() ?? "0",
      raw: (id) => campaignsMap.get(id)?._count._all ?? 0,
      isHigherBetter: true,
    },
    {
      label: "Ad spend (28d)",
      icon: <Megaphone className="h-3.5 w-3.5" />,
      value: (id) => fmtMoney(spendMap.get(id)?._sum.spendToDateCents ?? 0),
      raw: (id) => spendMap.get(id)?._sum.spendToDateCents ?? 0,
      isHigherBetter: false,
    },
    {
      label: "Cost per lead (28d)",
      icon: <Megaphone className="h-3.5 w-3.5" />,
      value: (id) => {
        const spend = spendMap.get(id)?._sum.spendToDateCents ?? 0;
        const leadCount = leadsMap.get(id)?._count._all ?? 0;
        if (leadCount === 0 || spend === 0) return "—";
        return fmtMoney(Math.round(spend / leadCount));
      },
      raw: (id) => {
        const spend = spendMap.get(id)?._sum.spendToDateCents ?? 0;
        const leadCount = leadsMap.get(id)?._count._all ?? 0;
        if (leadCount === 0 || spend === 0) return null;
        return spend / leadCount;
      },
      isHigherBetter: false,
    },
    {
      label: "Google rating",
      icon: <Star className="h-3.5 w-3.5" />,
      value: (id) => {
        const p = orderedProperties.find((x) => x.id === id);
        if (typeof p?.googleAggRating !== "number") return "—";
        return (
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-current text-amber-500" />
            {p.googleAggRating.toFixed(1)}
            {p.googleAggReviewCount ? (
              <span className="text-muted-foreground text-[10px] ml-1">
                ({p.googleAggReviewCount})
              </span>
            ) : null}
          </span>
        );
      },
      raw: (id) =>
        orderedProperties.find((x) => x.id === id)?.googleAggRating ?? null,
      isHigherBetter: true,
    },
    {
      label: "Total mentions",
      icon: <Star className="h-3.5 w-3.5" />,
      value: (id) =>
        mentionsMap.get(id)?._count._all.toLocaleString() ?? "0",
      raw: (id) => mentionsMap.get(id)?._count._all ?? 0,
      isHigherBetter: true,
    },
    {
      label: "Negative mentions",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      value: (id) => {
        const c = mentionsNegMap.get(id)?._count._all ?? 0;
        if (c === 0) return "0";
        return <span className="text-rose-700 font-medium">{c}</span>;
      },
      raw: (id) => mentionsNegMap.get(id)?._count._all ?? 0,
      isHigherBetter: false,
    },
    {
      label: "Year built",
      icon: <Building2 className="h-3.5 w-3.5" />,
      value: (id) => {
        const p = orderedProperties.find((x) => x.id === id);
        return p?.yearBuilt ? String(p.yearBuilt) : "—";
      },
    },
    {
      label: "Last AppFolio sync",
      icon: <Calendar className="h-3.5 w-3.5" />,
      value: (id) => {
        const p = orderedProperties.find((x) => x.id === id);
        return p?.lastSyncedAt ? format(p.lastSyncedAt, "MMM d, yyyy") : "Never";
      },
    },
  ];

  function bestId(row: Row): string | null {
    if (row.raw == null) return null;
    if (row.isHigherBetter == null) return null;
    let best: { id: string; v: number } | null = null;
    for (const p of orderedProperties) {
      const v = row.raw(p.id);
      if (v == null) continue;
      if (
        !best ||
        (row.isHigherBetter ? v > best.v : v < best.v)
      ) {
        best = { id: p.id, v };
      }
    }
    return best?.id ?? null;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <Link href="/portal/properties" className="hover:underline">
            ← Properties
          </Link>
        }
        title={`Compare ${orderedProperties.length} ${
          orderedProperties.length === 1 ? "property" : "properties"
        }`}
        description="Best value in each row is highlighted. Negative metrics (cost, neg mentions) flip the highlight."
        actions={
          <Link
            href="/portal/properties/compare"
            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Pick different properties
          </Link>
        }
      />

      <div className="overflow-x-auto -mx-4 md:mx-0">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground w-[180px]">
                Metric
              </th>
              {orderedProperties.map((p) => (
                <th
                  key={p.id}
                  className="text-left px-4 py-3"
                >
                  <Link
                    href={`/portal/properties/${p.id}`}
                    className="block group min-w-0"
                  >
                    {p.heroImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.heroImageUrl}
                        alt=""
                        className="h-12 w-full object-cover rounded-md mb-2"
                      />
                    ) : null}
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                    </p>
                    <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-muted-foreground group-hover:text-foreground">
                      Open <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const winnerId = bestId(row);
              return (
                <tr key={row.label} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span className="text-muted-foreground">{row.icon}</span>
                    {row.label}
                  </td>
                  {orderedProperties.map((p) => (
                    <td
                      key={p.id}
                      className={`px-4 py-2.5 text-sm tabular-nums ${
                        winnerId === p.id
                          ? "bg-emerald-50/60 font-semibold text-emerald-900"
                          : "text-foreground"
                      }`}
                    >
                      {row.value(p.id)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DashboardSection
        title="Add or change properties"
        eyebrow="Compare up to 4"
        description="Toggle properties to update the comparison."
      >
        <PropertyPicker
          properties={allProperties}
          selectedIds={requestedIds}
          maxCompare={MAX_COMPARE}
        />
      </DashboardSection>
    </div>
  );
}

function PropertyPicker({
  properties,
  selectedIds,
  maxCompare,
}: {
  properties: Array<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  }>;
  selectedIds: string[];
  maxCompare: number;
}) {
  function hrefFor(id: string) {
    const set = new Set(selectedIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      if (set.size >= maxCompare) return null;
      set.add(id);
    }
    if (set.size === 0) return "/portal/properties/compare";
    return `/portal/properties/compare?ids=${Array.from(set).join(",")}`;
  }

  if (properties.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        You don&apos;t have any properties yet.{" "}
        <Link href="/portal/properties" className="underline">
          Add one
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {properties.map((p) => {
        const selected = selectedIds.includes(p.id);
        const href = hrefFor(p.id);
        const disabled = !href;
        return (
          <Link
            key={p.id}
            href={href ?? "#"}
            scroll={false}
            aria-disabled={disabled}
            className={`block rounded-md border px-3 py-2 transition-colors ${
              selected
                ? "border-primary bg-primary/10 text-primary"
                : disabled
                  ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <p className="text-xs font-semibold truncate">{p.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {[p.city, p.state].filter(Boolean).join(", ") || "No address"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
