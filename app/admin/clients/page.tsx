import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus, PropertyType, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  await requireAgency();
  const { status, type } = await searchParams;

  const where: Prisma.OrganizationWhereInput = { orgType: OrgType.CLIENT };
  if (status && status in TenantStatus) {
    where.status = status as TenantStatus;
  }
  if (type && type in PropertyType) {
    where.propertyType = type as PropertyType;
  }

  const clients = await prisma.organization.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { properties: true, leads: true, users: true } },
    },
    take: 500,
  });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const leadCountsByOrg = new Map<string, number>();
  const leadGroups = await prisma.lead.groupBy({
    by: ["orgId"],
    where: { createdAt: { gte: since }, orgId: { in: clients.map((c) => c.id) } },
    _count: { _all: true },
  });
  for (const g of leadGroups) {
    leadCountsByOrg.set(g.orgId, g._count._all);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Clients</h1>
          <p className="text-sm opacity-60 mt-1">
            Every CLIENT organization. Click in for full detail and impersonate.
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 text-xs">
        <StatusLink current={status} value="" label="All" />
        {Object.values(TenantStatus).map((s) => (
          <StatusLink key={s} current={status} value={s} label={s} />
        ))}
      </nav>

      {clients.length === 0 ? (
        <p className="text-sm opacity-60 border rounded-md p-4">
          No clients match this filter yet.
        </p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-widest uppercase opacity-60">
              <tr>
                <th className="text-left px-4 py-2">Client</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Properties</th>
                <th className="text-right px-4 py-2">Leads 30d</th>
                <th className="text-right px-4 py-2">MRR</th>
                <th className="text-right px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {c.name}
                    </Link>
                    <div className="text-[11px] opacity-60">{c.slug}</div>
                  </td>
                  <td className="px-4 py-2 text-xs opacity-80">
                    {c.propertyType}
                    {c.residentialSubtype
                      ? `, ${c.residentialSubtype}`
                      : c.commercialSubtype
                      ? `, ${c.commercialSubtype}`
                      : ""}
                  </td>
                  <td className="px-4 py-2 text-xs">{c.status}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c._count.properties}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {leadCountsByOrg.get(c.id) ?? 0}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.mrrCents != null
                      ? `$${Math.round(c.mrrCents / 100).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-xs opacity-60 whitespace-nowrap">
                    {formatDistanceToNow(c.updatedAt, { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusLink({
  current,
  value,
  label,
}: {
  current: string | undefined;
  value: string;
  label: string;
}) {
  const active = (current ?? "") === value;
  return (
    <Link
      href={value ? `/admin/clients?status=${value}` : "/admin/clients"}
      className={`px-2 py-1 border rounded ${
        active ? "bg-foreground text-background" : ""
      }`}
    >
      {label}
    </Link>
  );
}
