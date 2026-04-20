import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";

export const metadata: Metadata = { title: "Property detail" };
export const dynamic = "force-dynamic";

function centsToUsd(c: number | null | undefined): string {
  if (c == null) return "—";
  return `$${Math.round(c / 100).toLocaleString()}`;
}

export default async function PropertyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: {
      listings: { orderBy: [{ isAvailable: "desc" }, { unitType: "asc" }] },
      _count: { select: { leads: true, tours: true, applications: true } },
    },
  });
  if (!property) notFound();

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/portal/properties"
            className="text-xs opacity-60 hover:opacity-100"
          >
            ← All properties
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">{property.name}</h1>
          {property.addressLine1 ? (
            <p className="text-sm opacity-70 mt-1">
              {property.addressLine1}
              {property.city ? `, ${property.city}` : ""}
              {property.state ? `, ${property.state}` : ""}
              {property.postalCode ? ` ${property.postalCode}` : ""}
            </p>
          ) : null}
        </div>
        <Link
          href={`/portal/properties/${property.id}/appfolio`}
          className="text-xs px-3 py-2 border rounded"
        >
          AppFolio settings
        </Link>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MiniStat label="Listings" value={property.listings.length} />
        <MiniStat
          label="Available"
          value={property.listings.filter((l) => l.isAvailable).length}
        />
        <MiniStat label="Leads" value={property._count.leads} />
        <MiniStat label="Tours" value={property._count.tours} />
        <MiniStat label="Applications" value={property._count.applications} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel label="Property details">
          <Row k="Type" v={property.propertyType} />
          <Row
            k="Subtype"
            v={
              property.residentialSubtype ??
              property.commercialSubtype ??
              "—"
            }
          />
          <Row k="Total units" v={property.totalUnits?.toString() ?? "—"} />
          <Row k="Year built" v={property.yearBuilt?.toString() ?? "—"} />
          <Row k="Backend" v={property.backendPlatform} />
          <Row
            k="Backend property group"
            v={property.backendPropertyGroup ?? "—"}
          />
          <Row
            k="Last synced"
            v={
              property.lastSyncedAt
                ? new Date(property.lastSyncedAt).toLocaleString()
                : "Never"
            }
          />
        </Panel>

        <Panel label="Marketing">
          <Row k="Meta title" v={property.metaTitle ?? "—"} />
          <Row
            k="Meta description"
            v={property.metaDescription ?? "—"}
          />
          <Row
            k="Virtual tour"
            v={property.virtualTourUrl ?? "—"}
          />
          <Row
            k="Price range"
            v={
              property.priceMin || property.priceMax
                ? `${centsToUsd(property.priceMin)}–${centsToUsd(
                    property.priceMax
                  )}`
                : "—"
            }
          />
          {property.description ? (
            <div className="pt-2 border-t">
              <dt className="text-xs opacity-60 mb-1">Description</dt>
              <dd className="text-xs opacity-80 whitespace-pre-wrap">
                {property.description}
              </dd>
            </div>
          ) : null}
        </Panel>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-3">Listings</h2>
        {property.listings.length === 0 ? (
          <p className="text-sm opacity-60 border rounded-md p-6">
            No listings synced yet. Sprint 06 wires in the AppFolio sync.
          </p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] tracking-widest uppercase opacity-60">
                <tr>
                  <th className="text-left px-4 py-2">Unit</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-right px-4 py-2">Beds</th>
                  <th className="text-right px-4 py-2">Baths</th>
                  <th className="text-right px-4 py-2">Sqft</th>
                  <th className="text-right px-4 py-2">Price</th>
                  <th className="text-center px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {property.listings.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 text-xs">
                      {l.unitNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">{l.unitType ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.bedrooms ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.bathrooms ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.squareFeet ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {centsToUsd(l.priceCents)}
                    </td>
                    <td className="px-4 py-2 text-center text-[11px]">
                      {l.isAvailable ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Available
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Unavailable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-md p-4">
      <p className="text-[10px] tracking-widest uppercase opacity-60 mb-3">
        {label}
      </p>
      <dl className="space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs opacity-60">{k}</dt>
      <dd className="text-right truncate">{v}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-[10px] tracking-widest uppercase opacity-60">
        {label}
      </div>
      <div className="text-xl font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}
