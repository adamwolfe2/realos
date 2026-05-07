import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { withMarketableLifecycle } from "@/lib/properties/marketable";
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

export const metadata: Metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

// /portal/properties — Twenty-CRM-style dense table of every property
// in the portfolio. Replaces the previous card grid that took 200px+
// per row and made it impossible to scan a 100-property portfolio.
//
// View tabs filter the result set without leaving the URL, so the
// operator can flip between "everything", "has vacancies",
// "actively leasing", "recently synced" without losing context.

type PropertyRow = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  availableCount: number | null;
  totalUnits: number | null;
  lastSyncedAt: Date | null;
  _count: { listings: number; leads: number; tours: number };
};

type ViewKey = "all" | "vacant" | "leasing" | "synced";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function PropertiesList({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const scope = await requireScope();
  const { view: rawView } = await searchParams;
  const view: ViewKey = (
    ["all", "vacant", "leasing", "synced"] as const
  ).includes(rawView as never)
    ? (rawView as ViewKey)
    : "all";

  // Fetch ALL marketable properties so the view counts in the toolbar
  // reflect the universe; filtering happens in-memory after. Excludes
  // parking/storage/sub-records and rows still in the curation queue
  // (lifecycle = IMPORTED). To review the queue, see
  // /portal/properties/curate.
  const [all, importedCount] = await Promise.all([
    prisma.property.findMany({
      where: withMarketableLifecycle(tenantWhere(scope)),
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { listings: true, leads: true, tours: true } },
      },
    }),
    prisma.property.count({
      where: { ...tenantWhere(scope), lifecycle: "IMPORTED" },
    }),
  ]);

  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  // Counts for each view so toolbar tabs render with accurate badges.
  const counts = {
    all: all.length,
    vacant: all.filter((p) => (p.availableCount ?? 0) > 0).length,
    leasing: all.filter(
      (p) => p._count.leads > 0 || p._count.listings > 0,
    ).length,
    synced: all.filter(
      (p) => p.lastSyncedAt && p.lastSyncedAt > sevenDaysAgo,
    ).length,
  };

  // Apply the active view filter
  const properties = all.filter((p) => {
    if (view === "vacant") return (p.availableCount ?? 0) > 0;
    if (view === "leasing")
      return p._count.leads > 0 || p._count.listings > 0;
    if (view === "synced")
      return p.lastSyncedAt && p.lastSyncedAt > sevenDaysAgo;
    return true;
  });

  // Portfolio-level stats so the header has actual context (always reflects
  // the full universe, not the filtered view — gives the operator the
  // baseline they can shrink against).
  const totalListings = all.reduce((s, p) => s + p._count.listings, 0);
  const totalAvailable = all.reduce(
    (s, p) => s + (p.availableCount ?? 0),
    0,
  );
  const totalLeads = all.reduce((s, p) => s + p._count.leads, 0);

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
      <PageHeader
        title="Properties"
        description={
          all.length === 0
            ? "Listings, leads, and tours for every property in your portfolio."
            : `${all.length.toLocaleString()} ${all.length === 1 ? "property" : "properties"} · ${totalListings.toLocaleString()} listings · ${totalAvailable.toLocaleString()} available · ${totalLeads.toLocaleString()} leads`
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
            {all.length >= 2 ? (
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

      {all.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-4 w-4" />}
          title="Add your first property to start tracking everything."
          body="Properties are the foundation — leads, tours, ad campaigns, chatbot transcripts, reputation scans, and traffic data all map back to a property."
          secondary={{
            label: "Sync from AppFolio",
            href: "/portal/settings/integrations",
          }}
        />
      ) : (
        <>
          <EntityToolbar views={views} />
          {properties.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
              No properties match this view.
            </div>
          ) : (
            <DataTable<PropertyRow>
              rows={properties as PropertyRow[]}
              getRowHref={(p) => `/portal/properties/${p.id}`}
              columns={[
                {
                  key: "name",
                  header: "Property",
                  accessor: (p) => (
                    <EntityCell
                      name={p.name}
                      seed={p.id}
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
                  ),
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
                  key: "listings",
                  header: "Listings",
                  align: "right",
                  accessor: (p) => <NumberCell value={p._count.listings} />,
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
                  key: "leads",
                  header: "Leads",
                  align: "right",
                  accessor: (p) =>
                    p._count.leads > 0 ? (
                      <NumberCell value={p._count.leads} bold />
                    ) : (
                      <EmptyCell />
                    ),
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
        </>
      )}
    </div>
  );
}
