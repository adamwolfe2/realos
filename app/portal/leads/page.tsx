import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { LeadSource, Prisma } from "@prisma/client";
import {
  LeadKanban,
  type LeadKanbanItem,
} from "@/components/portal/lead-kanban";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import { humanLeadSource } from "@/lib/format";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

const SOURCES = Object.values(LeadSource);
const PAGE_SIZE = 50;

function parsePage(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : 1;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function LeadsKanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; property?: string; q?: string; page?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const where: Prisma.LeadWhereInput = { ...tenantWhere(scope) };
  if (sp.source && (SOURCES as string[]).includes(sp.source)) {
    where.source = sp.source as LeadSource;
  }
  if (sp.property) where.propertyId = sp.property;
  if (sp.q) {
    where.OR = [
      { firstName: { contains: sp.q, mode: "insensitive" } },
      { lastName: { contains: sp.q, mode: "insensitive" } },
      { email: { contains: sp.q, mode: "insensitive" } },
      { phone: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const [leads, totalCount, properties] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { property: { select: { id: true, name: true } } },
    }),
    prisma.lead.count({ where }),
    prisma.property.findMany({
      where: tenantWhere(scope),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const items: LeadKanbanItem[] = leads.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    phone: l.phone,
    source: l.source,
    status: l.status,
    score: l.score,
    propertyName: l.property?.name ?? null,
    createdAt: l.createdAt.toISOString(),
  }));

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Build a query string that preserves active filters and sets the page
  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (sp.source) params.set("source", sp.source);
    if (sp.property) params.set("property", sp.property);
    if (sp.q) params.set("q", sp.q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/portal/leads${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Leads"
        description="Click any lead to see full detail, conversation history, tours, and applications."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {totalCount === 0
                ? "No leads"
                : `Showing ${rangeStart}–${rangeEnd} of ${totalCount} ${totalCount === 1 ? "lead" : "leads"}`}
            </span>
            <ExportButton href="/api/tenant/leads/export" />
          </div>
        }
      />

      <form
        action="/portal/leads"
        className="rounded-lg border border-border bg-card px-3 py-2 flex flex-wrap items-center gap-2"
      >
        <label className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground shrink-0">
            Source
          </span>
          <select
            name="source"
            defaultValue={sp.source ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="">All</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {humanLeadSource(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground shrink-0">
            Property
          </span>
          <select
            name="property"
            defaultValue={sp.property ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs max-w-[200px]"
          >
            <option value="">All</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, email, phone…"
          className="rounded-md border border-border bg-background px-2 py-1 text-xs flex-1 min-w-[180px]"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-3 py-1 text-xs font-semibold hover:opacity-90"
        >
          Apply
        </button>
        {(sp.source || sp.property || sp.q) ? (
          <Link
            href="/portal/leads"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Previous
              </Link>
            ) : (
              <span className="px-3 py-2 border border-border rounded-md opacity-40 cursor-not-allowed select-none" aria-disabled="true">
                Previous
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Next
              </Link>
            ) : (
              <span className="px-3 py-2 border border-border rounded-md opacity-40 cursor-not-allowed select-none" aria-disabled="true">
                Next
              </span>
            )}
          </div>
        </div>
      )}

      {totalCount === 0 ? (
        <EmptyLeadsState />
      ) : (
        <LeadKanban items={items} />
      )}
    </div>
  );
}

function EmptyLeadsState() {
  return (
    <EmptyState
      title="Your pipeline is empty."
      body="Leads from chatbot conversations, contact forms, ads, or AppFolio sync land here. Pick a starting point below."
      action={{ label: "Set up lead capture", href: "/portal/site-builder" }}
      secondary={{
        label: "Connect AppFolio",
        href: "/portal/settings/integrations",
      }}
    />
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
