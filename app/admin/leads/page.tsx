import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";

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
  const total = Array.from(totalsBySource.values()).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Leads</h1>
          <p className="text-sm opacity-60 mt-1">
            Every lead across every tenant in the last {days} days.
          </p>
        </div>
        <div className="text-xs opacity-60">
          {total} leads, {leads.length} shown
        </div>
      </header>

      <form
        action="/admin/leads"
        className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs"
      >
        <label className="flex flex-col gap-1">
          <span className="opacity-60">Days</span>
          <select
            name="days"
            defaultValue={String(days)}
            className="border rounded px-2 py-1.5 bg-background"
          >
            {[7, 30, 90, 180, 365].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-60">Source</span>
          <select
            name="source"
            defaultValue={sp.source ?? ""}
            className="border rounded px-2 py-1.5 bg-background"
          >
            <option value="">All</option>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-60">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="border rounded px-2 py-1.5 bg-background"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-60">Client</span>
          <select
            name="org"
            defaultValue={sp.org ?? ""}
            className="border rounded px-2 py-1.5 bg-background"
          >
            <option value="">All</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-full flex gap-2 mt-1">
          <button
            type="submit"
            className="bg-foreground text-background px-3 py-1.5 text-xs rounded"
          >
            Apply
          </button>
          <Link
            href="/admin/leads"
            className="text-xs opacity-60 px-3 py-1.5 border rounded"
          >
            Reset
          </Link>
        </div>
      </form>

      {leads.length === 0 ? (
        <p className="text-sm opacity-60 border rounded-md p-4">
          No leads match this filter.
        </p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-widest uppercase opacity-60">
              <tr>
                <th className="text-left px-4 py-2">Lead</th>
                <th className="text-left px-4 py-2">Client</th>
                <th className="text-left px-4 py-2">Property</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Score</th>
                <th className="text-right px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <div className="font-medium">
                      {l.firstName
                        ? `${l.firstName}${l.lastName ? " " + l.lastName : ""}`
                        : l.email ?? "Anonymous"}
                    </div>
                    {l.email ? (
                      <div className="text-[11px] opacity-60">{l.email}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <Link
                      href={`/admin/clients/${l.orgId}`}
                      className="underline underline-offset-2"
                    >
                      {l.org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs opacity-80">
                    {l.property?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">{l.source}</td>
                  <td className="px-4 py-2 text-xs">{l.status}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.score}
                  </td>
                  <td className="px-4 py-2 text-right text-xs opacity-60 whitespace-nowrap">
                    {formatDistanceToNow(l.createdAt, { addSuffix: true })}
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
