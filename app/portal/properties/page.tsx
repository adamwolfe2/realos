import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { formatDistanceToNow } from "date-fns";
import { Building2, MapPin } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PropertyFormDialog } from "@/components/properties/property-form-dialog";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { DataTable, EntityCell } from "@/components/portal/ui/data-table";

export const metadata: Metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

// /portal/properties — Twenty-CRM-style dense table of every property
// in the portfolio. Replaces the previous card grid that took 200px+
// per row and made it impossible to scan a 100-property portfolio.
//
// Columns: Name · City · Listings · Available · Leads · Units · Synced.
// Each row links to the property detail. Avatars use a deterministic
// hash of the property id so each building gets a stable color chip.

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

export default async function PropertiesList() {
  const scope = await requireScope();
  const properties = await prisma.property.findMany({
    where: tenantWhere(scope),
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { listings: true, leads: true, tours: true } },
    },
  });

  // Portfolio-level stats so the header has actual context.
  const totalListings = properties.reduce(
    (s, p) => s + p._count.listings,
    0,
  );
  const totalAvailable = properties.reduce(
    (s, p) => s + (p.availableCount ?? 0),
    0,
  );
  const totalLeads = properties.reduce((s, p) => s + p._count.leads, 0);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Properties"
        description={
          properties.length === 0
            ? "Listings, leads, and tours for every property in your portfolio."
            : `${properties.length.toLocaleString()} ${properties.length === 1 ? "property" : "properties"} · ${totalListings.toLocaleString()} listings · ${totalAvailable.toLocaleString()} available · ${totalLeads.toLocaleString()} leads`
        }
        actions={
          <div className="flex items-center gap-2">
            {properties.length >= 2 ? (
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

      {properties.length === 0 ? (
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
                        <MapPin className="h-2.5 w-2.5 opacity-60" aria-hidden="true" />
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
              accessor: (p) =>
                [p.city, p.state].filter(Boolean).join(", ") || (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: "listings",
              header: "Listings",
              align: "right",
              accessor: (p) => p._count.listings.toLocaleString(),
            },
            {
              key: "available",
              header: "Available",
              align: "right",
              accessor: (p) => {
                const avail = p.availableCount ?? 0;
                return (
                  <span
                    className={
                      avail > 0
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {avail.toLocaleString()}
                  </span>
                );
              },
            },
            {
              key: "leads",
              header: "Leads",
              align: "right",
              accessor: (p) => p._count.leads.toLocaleString(),
            },
            {
              key: "units",
              header: "Units",
              align: "right",
              hideOnMobile: true,
              accessor: (p) =>
                p.totalUnits ? (
                  p.totalUnits.toLocaleString()
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: "synced",
              header: "Last synced",
              hideOnMobile: true,
              accessor: (p) =>
                p.lastSyncedAt ? (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatDistanceToNow(p.lastSyncedAt, { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    Never
                  </span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
