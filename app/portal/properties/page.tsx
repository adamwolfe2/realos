import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { PropertyFormDialog } from "@/components/properties/property-form-dialog";

export const metadata: Metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

export default async function PropertiesList() {
  const scope = await requireScope();
  const properties = await prisma.property.findMany({
    where: tenantWhere(scope),
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { listings: true, leads: true, tours: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Listings, leads, and tours for every property in your portfolio."
        actions={<PropertyFormDialog />}
      />

      {properties.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No properties set up yet. Add one manually below or wait for
            AppFolio sync to populate.
          </p>
          <PropertyFormDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/portal/properties/${p.id}`}
              className="block rounded-lg border border-border bg-card p-5 hover:border-foreground/20 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">
                  {p.name}
                </h2>
                {p.lastSyncedAt ? (
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Synced{" "}
                    {formatDistanceToNow(p.lastSyncedAt, { addSuffix: true })}
                  </span>
                ) : null}
              </div>
              {p.addressLine1 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {p.addressLine1}
                  {p.city ? `, ${p.city}` : ""}
                  {p.state ? `, ${p.state}` : ""}
                </p>
              ) : null}
              <dl className="grid grid-cols-3 mt-5 gap-2">
                <Stat label="Listings" value={p._count.listings} />
                <Stat label="Available" value={p.availableCount ?? 0} />
                <Stat label="Leads" value={p._count.leads} />
              </dl>
              {p.totalUnits ? (
                <p className="text-[11px] text-muted-foreground mt-3">
                  {p.totalUnits} total units
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground mt-0.5">
        {value}
      </dd>
    </div>
  );
}
