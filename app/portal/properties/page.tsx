import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { formatDistanceToNow } from "date-fns";

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
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Properties</h1>
          <p className="text-sm opacity-60 mt-1">
            Listings, leads, and tours for every property in your portfolio.
          </p>
        </div>
      </header>

      {properties.length === 0 ? (
        <p className="text-sm opacity-60 border rounded-md p-6">
          No properties seeded yet. Your agency contact seeds these during the
          build. Ping us if one is missing.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/portal/properties/${p.id}`}
              className="block border rounded-md p-5 hover:bg-muted/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl font-bold truncate">
                  {p.name}
                </h2>
                {p.lastSyncedAt ? (
                  <span className="text-[11px] opacity-60 whitespace-nowrap">
                    Synced {formatDistanceToNow(p.lastSyncedAt, { addSuffix: true })}
                  </span>
                ) : null}
              </div>
              {p.addressLine1 ? (
                <p className="text-sm opacity-70 mt-0.5">
                  {p.addressLine1}
                  {p.city ? `, ${p.city}` : ""}
                  {p.state ? `, ${p.state}` : ""}
                </p>
              ) : null}
              <dl className="grid grid-cols-3 mt-4 text-xs">
                <div>
                  <dt className="opacity-60">Listings</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {p._count.listings}
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Available</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {p.availableCount ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Leads</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {p._count.leads}
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] opacity-60 mt-3">
                Backend: {p.backendPlatform}
                {p.totalUnits ? ` · ${p.totalUnits} total units` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
