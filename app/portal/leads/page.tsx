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
import { ExportButton } from "@/components/ui/export-button";
import { humanLeadSource } from "@/lib/format";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

const SOURCES = Object.values(LeadSource);

export default async function LeadsKanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; property?: string; q?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;

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

  const [leads, properties] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      take: 500,
      include: { property: { select: { id: true, name: true } } },
    }),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Move cards between columns to update status. Click a card for full lead detail, conversation history, tours, and applications."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {leads.length} {leads.length === 1 ? "lead" : "leads"} shown
            </span>
            <ExportButton href="/api/tenant/leads/export" />
          </div>
        }
      />

      <form
        action="/portal/leads"
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <SelectField
            label="Source"
            name="source"
            defaultValue={sp.source ?? ""}
            options={[
              { value: "", label: "All sources" },
              ...SOURCES.map((s) => ({ value: s, label: humanLeadSource(s) })),
            ]}
          />
          <SelectField
            label="Property"
            name="property"
            defaultValue={sp.property ?? ""}
            options={[
              { value: "", label: "All properties" },
              ...properties.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-foreground">Search</span>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Name, email, phone"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Apply filters
          </button>
          <Link
            href="/portal/leads"
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Reset
          </Link>
        </div>
      </form>

      <LeadKanban items={items} />
    </div>
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
