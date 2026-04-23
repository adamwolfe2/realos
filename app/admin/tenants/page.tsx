import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { humanTenantStatus, tenantStatusTone } from "@/lib/format";

export const metadata: Metadata = { title: "Tenants + domains" };
export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  await requireAgency();

  const tenants = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      domains: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      _count: { select: { properties: true, users: true } },
    },
    take: 500,
  });

  const totalDomains = tenants.reduce((acc, t) => acc + t.domains.length, 0);
  const launched = tenants.filter((t) => t.launchedAt).length;
  const dnsConfigured = tenants.reduce(
    (acc, t) => acc + t.domains.filter((d) => d.dnsConfigured).length,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants + domains"
        description="Every client tenant on the platform with their custom domains and SSL status."
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat label="Total tenants" value={tenants.length} />
        <Stat label="Launched" value={launched} />
        <Stat label="Custom domains" value={totalDomains} />
        <Stat label="DNS configured" value={dnsConfigured} />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Tenant</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Domains</th>
              <th className="px-4 py-3 text-right font-medium">Properties</th>
              <th className="px-4 py-3 text-right font-medium">Users</th>
              <th className="px-4 py-3 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No tenants yet. New tenants land here once an intake converts.
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clients/${t.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {t.name}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={tenantStatusTone(t.status)}>
                      {humanTenantStatus(t.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    {t.domains.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Subdomain only
                      </span>
                    ) : (
                      <div className="space-y-1">
                        {t.domains.map((d) => (
                          <DomainRow key={d.id} domain={d} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t._count.properties}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t._count.users}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(t.createdAt, { addSuffix: true })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function DomainRow({
  domain,
}: {
  domain: {
    hostname: string;
    isPrimary: boolean;
    sslStatus: string | null;
    dnsConfigured: boolean;
  };
}) {
  const sslOk = domain.sslStatus === "active";
  return (
    <div className="flex items-center gap-2">
      <code className="text-xs font-mono">{domain.hostname}</code>
      {domain.isPrimary ? (
        <span className="text-[10px] uppercase tracking-wide bg-foreground/10 px-1.5 py-0.5 rounded">
          Primary
        </span>
      ) : null}
      <span
        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
          sslOk
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
        title={`SSL: ${domain.sslStatus ?? "unknown"}`}
      >
        {sslOk ? "SSL" : domain.sslStatus ?? "Pending"}
      </span>
      {!domain.dnsConfigured ? (
        <span className="text-[10px] uppercase tracking-wide bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">
          DNS
        </span>
      ) : null}
    </div>
  );
}
