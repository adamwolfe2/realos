import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  humanLeadSource,
  humanLeadStatus,
  leadStatusTone,
} from "@/lib/format";

export const metadata: Metadata = { title: "Leads, cross-tenant" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = Object.values(LeadStatus);
const SOURCE_OPTIONS = Object.values(LeadSource);

export default async function CrossTenantLeads({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    source?: string;
    org?: string;
    days?: string;
  }>;
}) {
  await requireAgency();

  const sp = await searchParams;
  const statusFilter =
    sp.status && sp.status in LeadStatus ? (sp.status as LeadStatus) : undefined;
  const sourceFilter =
    sp.source && sp.source in LeadSource ? (sp.source as LeadSource) : undefined;
  const orgFilter = sp.org;
  const days = sp.days ? parseInt(sp.days, 10) : 30;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Prisma.LeadWhereInput = {
    createdAt: { gte: since },
  };
  if (statusFilter) where.status = statusFilter;
  if (sourceFilter) where.source = sourceFilter;
  if (orgFilter) where.orgId = orgFilter;

  const [leads, clients, counts] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        org: { select: { id: true, name: true, slug: true } },
        property: { select: { id: true, name: true } },
      },
    }),
    prisma.organization.findMany({
      where: { orgType: "CLIENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.lead.groupBy({
      by: ["source"],
      _count: { _all: true },
      where: { createdAt: { gte: since } },
    }),
  ]);

  const totalsBySource = new Map<LeadSource, number>();
  for (const c of counts) {
    totalsBySource.set(c.source, c._count._all);
  }
  const total = Array.from(totalsBySource.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={`Every lead across every tenant in the last ${days} days.`}
        actions={
          <div className="text-xs text-muted-foreground">
            {total} total · {leads.length} shown
          </div>
        }
      />

      <form
        action="/admin/leads"
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SelectField
            label="Days"
            name="days"
            defaultValue={String(days)}
            options={[7, 30, 90, 180, 365].map((d) => ({
              value: String(d),
              label: `Last ${d} days`,
            }))}
          />
          <SelectField
            label="Source"
            name="source"
            defaultValue={sp.source ?? ""}
            options={[
              { value: "", label: "All sources" },
              ...SOURCE_OPTIONS.map((s) => ({
                value: s,
                label: humanLeadSource(s),
              })),
            ]}
          />
          <SelectField
            label="Status"
            name="status"
            defaultValue={sp.status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...STATUS_OPTIONS.map((s) => ({
                value: s,
                label: humanLeadStatus(s),
              })),
            ]}
          />
          <SelectField
            label="Client"
            name="org"
            defaultValue={sp.org ?? ""}
            options={[
              { value: "", label: "All clients" },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Apply filters
          </button>
          <Link
            href="/admin/leads"
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Reset
          </Link>
        </div>
      </form>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No leads match this filter.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <Th>Lead</Th>
                  <Th>Client</Th>
                  <Th>Property</Th>
                  <Th>Source</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Score</Th>
                  <Th className="text-right">Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {l.firstName
                          ? `${l.firstName}${l.lastName ? " " + l.lastName : ""}`
                          : (l.email ?? "Anonymous")}
                      </div>
                      {l.email ? (
                        <div className="text-[11px] text-muted-foreground">
                          {l.email}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Link
                        href={`/admin/clients/${l.orgId}`}
                        className="text-primary hover:underline underline-offset-2 font-medium"
                      >
                        {l.org.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {l.property?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {humanLeadSource(l.source)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={leadStatusTone(l.status)}>
                        {humanLeadStatus(l.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                      {l.score}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(l.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
