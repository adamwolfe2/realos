import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus, PropertyType, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  humanTenantStatus,
  tenantStatusTone,
  humanPropertyType,
  humanResidentialSubtype,
  humanCommercialSubtype,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string }>;
}) {
  await requireAgency();
  const { status, type, q } = await searchParams;

  const where: Prisma.OrganizationWhereInput = { orgType: OrgType.CLIENT };
  if (status && status in TenantStatus) {
    where.status = status as TenantStatus;
  }
  if (type && type in PropertyType) {
    where.propertyType = type as PropertyType;
  }
  if (q) {
    where.name = { contains: q, mode: "insensitive" };
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
  if (clients.length > 0) {
    const leadGroups = await prisma.lead.groupBy({
      by: ["orgId"],
      where: { createdAt: { gte: since }, orgId: { in: clients.map((c) => c.id) } },
      _count: { _all: true },
    });
    for (const g of leadGroups) {
      leadCountsByOrg.set(g.orgId, g._count._all);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Every client organization. Click in for full detail and impersonation."
      />

      <form action="/admin/clients" className="flex flex-wrap items-center gap-3">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-56"
        />
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Search
        </button>
        {q ? (
          <Link
            href={status ? `/admin/clients?status=${status}` : "/admin/clients"}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <nav className="flex flex-wrap gap-1.5" aria-label="Filter by status">
        <StatusLink current={status} value="" label="All" q={q} />
        {Object.values(TenantStatus).map((s) => (
          <StatusLink
            key={s}
            current={status}
            value={s}
            label={humanTenantStatus(s)}
            q={q}
          />
        ))}
      </nav>

      {clients.length === 0 ? (
        <div className="border border-border bg-card rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No clients match this filter.
          </p>
        </div>
      ) : (
        <div className="border border-border bg-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                    Client
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                    Properties
                  </th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                    Leads&nbsp;30d
                  </th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                    MRR
                  </th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((c) => {
                  const subtype = c.residentialSubtype
                    ? humanResidentialSubtype(c.residentialSubtype)
                    : c.commercialSubtype
                      ? humanCommercialSubtype(c.commercialSubtype)
                      : null;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {c.name}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          {c.slug}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {humanPropertyType(c.propertyType)}
                        {subtype ? ` · ${subtype}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={tenantStatusTone(c.status)}>
                          {humanTenantStatus(c.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                        {c._count.properties}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                        {leadCountsByOrg.get(c.id) ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                        {c.mrrCents != null && c.mrrCents > 0
                          ? `$${Math.round(c.mrrCents / 100).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(c.updatedAt, { addSuffix: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusLink({
  current,
  value,
  label,
  q,
}: {
  current: string | undefined;
  value: string;
  label: string;
  q?: string;
}) {
  const active = (current ?? "") === value;
  const params = new URLSearchParams();
  if (value) params.set("status", value);
  if (q) params.set("q", q);
  const qs = params.toString();
  const href = `/admin/clients${qs ? `?${qs}` : ""}`;
  return (
    <Link
      href={href}
      className={cn(
        "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-muted/50"
      )}
    >
      {label}
    </Link>
  );
}
