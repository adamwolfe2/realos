import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus, PropertyType, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  // Per-client insight counts — surfaces "this client has 3 critical
  // insights" inline on the table so the agency can triage without
  // clicking into each one. Uses the same 14-day window as
  // /admin/insights so the numbers match.
  const insightWindow = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const insightCountsByOrg = new Map<
    string,
    { critical: number; warning: number }
  >();
  if (clients.length > 0) {
    const [leadGroups, insightGroups] = await Promise.all([
      prisma.lead.groupBy({
        by: ["orgId"],
        where: {
          createdAt: { gte: since },
          orgId: { in: clients.map((c) => c.id) },
        },
        _count: { _all: true },
      }),
      prisma.insight.groupBy({
        by: ["orgId", "severity"],
        where: {
          orgId: { in: clients.map((c) => c.id) },
          status: { in: ["open", "acknowledged"] },
          createdAt: { gte: insightWindow },
          severity: { in: ["critical", "warning"] },
          OR: [{ snoozeUntil: null }, { snoozeUntil: { lt: new Date() } }],
        },
        _count: { _all: true },
      }),
    ]);
    for (const g of leadGroups) {
      leadCountsByOrg.set(g.orgId, g._count._all);
    }
    for (const g of insightGroups) {
      const existing = insightCountsByOrg.get(g.orgId) ?? {
        critical: 0,
        warning: 0,
      };
      if (g.severity === "critical") existing.critical += g._count._all;
      if (g.severity === "warning") existing.warning += g._count._all;
      insightCountsByOrg.set(g.orgId, existing);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Every client organization. Click in for full detail and impersonation."
      />

      <form action="/admin/clients" className="flex flex-wrap items-center gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name"
          className="w-56"
        />
        <Button type="submit" size="sm">
          Search
        </Button>
        {q ? (
          <Button asChild variant="ghost" size="sm">
            <Link
              href={status ? `/admin/clients?status=${status}` : "/admin/clients"}
            >
              Clear
            </Link>
          </Button>
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
        <div className="rounded-lg border border-border bg-card p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {status || type || q
              ? "No clients match these filters."
              : "No client organizations yet."}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {status || type || q
              ? "Try clearing the filter or widening the search."
              : "Approve an intake submission from the queue to provision the first client org. Or hand-create one from /admin/clients/new."}
          </p>
          {status || type || q ? (
            <Link
              href="/admin/clients"
              className="inline-flex items-center mt-2 text-xs font-semibold text-primary hover:underline"
            >
              Clear filters →
            </Link>
          ) : (
            <Link
              href="/admin/intakes"
              className="inline-flex items-center mt-2 text-xs font-semibold text-primary hover:underline"
            >
              Open intake queue →
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Properties
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Leads&nbsp;30d
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Insights&nbsp;14d
                  </th>
                  <th className="px-4 py-3 text-right font-medium">MRR</th>
                  <th className="px-4 py-3 text-right font-medium">Updated</th>
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
                      className="hover:bg-muted/20 transition-colors"
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
                      <td className="px-4 py-3 text-right">
                        <InsightCountCell
                          counts={
                            insightCountsByOrg.get(c.id) ?? {
                              critical: 0,
                              warning: 0,
                            }
                          }
                          orgId={c.id}
                        />
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

function InsightCountCell({
  counts,
  orgId,
}: {
  counts: { critical: number; warning: number };
  orgId: string;
}) {
  const total = counts.critical + counts.warning;
  if (total === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <Link
      href={`/admin/insights?org=${orgId}`}
      className="inline-flex items-center gap-1.5 hover:underline"
    >
      {counts.critical > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
          {counts.critical} crit
        </span>
      ) : null}
      {counts.warning > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {counts.warning} warn
        </span>
      ) : null}
    </Link>
  );
}
