import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { LeadSource, Prisma } from "@prisma/client";
import {
  LeadKanban,
  type LeadKanbanItem,
} from "@/components/portal/lead-kanban";

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
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Leads</h1>
          <p className="text-sm opacity-60 mt-1">
            Move cards between columns to update status. Click a card for
            full lead detail, conversation history, tours, and applications.
          </p>
        </div>
        <div className="text-xs opacity-60">
          {leads.length} leads shown
        </div>
      </header>

      <form
        action="/portal/leads"
        className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs"
      >
        <label className="flex flex-col gap-1">
          <span className="opacity-60">Source</span>
          <select
            name="source"
            defaultValue={sp.source ?? ""}
            className="border rounded px-2 py-1.5 bg-background"
          >
            <option value="">All</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-60">Property</span>
          <select
            name="property"
            defaultValue={sp.property ?? ""}
            className="border rounded px-2 py-1.5 bg-background"
          >
            <option value="">All</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <span className="opacity-60">Search</span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Name, email, phone"
            className="border rounded px-2 py-1.5 bg-background"
          />
        </label>
        <div className="col-span-full flex gap-2 mt-1">
          <button
            type="submit"
            className="bg-foreground text-background px-3 py-1.5 text-xs rounded"
          >
            Apply
          </button>
          <Link
            href="/portal/leads"
            className="text-xs opacity-60 px-3 py-1.5 border rounded"
          >
            Reset
          </Link>
        </div>
      </form>

      <LeadKanban items={items} />
    </div>
  );
}
