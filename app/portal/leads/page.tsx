import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Users, Flame, CalendarCheck, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  isAccessDenied,
  parsePropertyFilter,
  propertyWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import {
  LeadKanban,
  type LeadKanbanItem,
} from "@/components/portal/lead-kanban";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import { humanLeadSource } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

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
  searchParams: Promise<{
    source?: string;
    property?: string;
    properties?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const propertyIds = parsePropertyFilter(sp);

  const where: Prisma.LeadWhereInput = {
    ...tenantWhere(scope),
    ...propertyWhereFragment(scope, propertyIds),
  };
  if (sp.source && (SOURCES as string[]).includes(sp.source)) {
    where.source = sp.source as LeadSource;
  }
  if (sp.q) {
    where.OR = [
      { firstName: { contains: sp.q, mode: "insensitive" } },
      { lastName: { contains: sp.q, mode: "insensitive" } },
      { email: { contains: sp.q, mode: "insensitive" } },
      { phone: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  // KPI strip queries — scoped to the same property + filter set so the
  // numbers above the kanban move in lockstep with what the operator sees
  // below. Each runs in parallel with the main page query; failures fall
  // through to 0 so a single bad lookup never blanks the page.
  const since28d = new Date(Date.now() - 28 * DAY);
  const kpiWhere: Prisma.LeadWhereInput = {
    ...tenantWhere(scope),
    ...propertyWhereFragment(scope, propertyIds),
  };

  const [
    leads,
    totalCount,
    properties,
    kpiLeads28d,
    kpiHotLeads,
    kpiToursScheduled,
    kpiSigned28d,
    sourceCounts,
  ] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      // Explicit select avoids pulling Lead.notes (Text) and
      // Lead.enrichedData (Json) which the kanban never renders.
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        source: true,
        status: true,
        score: true,
        createdAt: true,
        property: { select: { id: true, name: true } },
      },
    }),
    prisma.lead.count({ where }),
    prisma.property.findMany({
      where: marketablePropertyWhere(scope.orgId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead
      .count({ where: { ...kpiWhere, createdAt: { gte: since28d } } })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...kpiWhere,
          status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED] },
          score: { gte: 70 },
        },
      })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...kpiWhere,
          status: {
            in: [
              LeadStatus.TOUR_SCHEDULED,
              LeadStatus.TOURED,
              LeadStatus.APPLICATION_SENT,
              LeadStatus.APPLIED,
            ],
          },
        },
      })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...kpiWhere,
          status: LeadStatus.SIGNED,
          createdAt: { gte: since28d },
        },
      })
      .catch(() => 0),
    // Group all-time lead counts by source so we can hide filter chips
    // that have zero data. With low-volume tenants (e.g. day-1 launch
    // tenants with 4 leads) the full 12-source chip strip otherwise
    // reads as a UI shell — half the chips lead to empty boards.
    prisma.lead
      .groupBy({
        by: ["source"],
        where: kpiWhere,
        _count: { _all: true },
      })
      .catch(() => [] as Array<{ source: LeadSource; _count: { _all: number } }>),
  ]);

  // Build a Set of sources that have at least one lead. Includes the
  // currently-active source filter even if its count is zero so the
  // operator can always see/clear their own filter.
  const sourcesWithData = new Set<string>(
    sourceCounts.map((r) => r.source as string),
  );
  if (sp.source && (SOURCES as string[]).includes(sp.source)) {
    sourcesWithData.add(sp.source);
  }

  // Conversion rate (signed / leads created in the window). Falls to "—"
  // when the window has no leads so we don't render a divide-by-zero NaN.
  const conversionPct =
    kpiLeads28d > 0
      ? Math.round((kpiSigned28d / kpiLeads28d) * 1000) / 10
      : null;

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
    if (sp.properties) params.set("properties", sp.properties);
    else if (sp.property) params.set("property", sp.property);
    if (sp.q) params.set("q", sp.q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/portal/leads${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-3 ls-page-fade">
      <PageHeader
        title="Leads"
        description={
          <>
            Form + chatbot opt-ins captured on your site. Click any lead
            to see full detail, conversation history, tours, and
            applications.
            {/* Norman feedback (May 22): when a user clicks the
                dashboard's "Captured · 30d" hero and lands here, they
                expect to see ALL captured contacts — but this page
                only holds Lead-table rows (form + chatbot). Spell out
                where the rest live so they don't think the platform
                is lying. */}
            <span className="block mt-1 text-[12px] text-muted-foreground">
              Pixel-identified visitors live on{" "}
              <Link
                href="/portal/visitors"
                className="font-medium text-primary hover:underline"
              >
                /portal/visitors
              </Link>
              . Chatbot conversations live on{" "}
              <Link
                href="/portal/chatbot"
                className="font-medium text-primary hover:underline"
              >
                /portal/chatbot
              </Link>
              .
            </span>
          </>
        }
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <Suspense fallback={<div className="h-9 w-48 rounded-md border border-border bg-muted/40" />}>
              <PropertyMultiSelect
                properties={visibleProperties(scope, properties)}
                orgId={scope.orgId}
              />
            </Suspense>
            <span className="text-xs text-muted-foreground">
              {totalCount === 0
                ? "No leads"
                : `Showing ${rangeStart}–${rangeEnd} of ${totalCount} ${totalCount === 1 ? "lead" : "leads"}`}
            </span>
            <ExportButton href="/api/tenant/leads/export" />
          </div>
        }
      />

      {isAccessDenied(scope, propertyIds) ? (
        <PropertyAccessDeniedBanner pathname="/portal/leads" />
      ) : null}

      {/* KPI strip — anchors the page in the same vocabulary as /portal
          home. Numbers move with the property + source filter set the
          operator picks below so the strip is a real summary of the
          visible board, not a static org-wide widget. */}
      <section
        aria-label="Lead pipeline at a glance"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 ls-stagger"
      >
        <KpiTile
          label="New leads (28d)"
          value={kpiLeads28d.toLocaleString()}
          hint={`${totalCount.toLocaleString()} all-time`}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Hot leads"
          value={kpiHotLeads.toLocaleString()}
          hint="Score 70+, not yet contacted"
          icon={<Flame className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="In tour / app stage"
          value={kpiToursScheduled.toLocaleString()}
          hint="Active pipeline mid-funnel"
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Conversion (28d)"
          value={
            conversionPct != null ? `${conversionPct}%` : "—"
          }
          hint={`${kpiSigned28d} signed`}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Source-mix one-liner. Renders only when at least one lead
          exists and at least one source has data so it doesn't echo
          "0 leads from no sources" on day-one tenants. */}
      {totalCount > 0 && sourceCounts.length > 0 ? (
        <p className="text-[11.5px] text-muted-foreground">
          {totalCount.toLocaleString()}{" "}
          {totalCount === 1 ? "lead" : "leads"}
          {" · "}
          {sourceCounts
            .slice()
            .sort((a, b) => b._count._all - a._count._all)
            .map((r) => `${r._count._all} from ${humanLeadSource(r.source)}`)
            .join(" · ")}
        </p>
      ) : null}

      {/* Premium filter bar — search + pill-based source tabs */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
        {/* Search row */}
        <form action="/portal/leads" className="flex items-center gap-2">
          {/* Preserve active source + property scope through search submit */}
          {sp.source ? (
            <input type="hidden" name="source" value={sp.source} />
          ) : null}
          {sp.properties ? (
            <input type="hidden" name="properties" value={sp.properties} />
          ) : null}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search name, email, phone…"
              className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3.5 py-1.5 text-xs font-semibold"
          >
            Search
          </button>
          {(sp.source || sp.property || sp.properties || sp.q) ? (
            <Link
              href="/portal/leads"
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {/* Source filter pills — each is a link so no JS required */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-[0.14em] font-semibold text-muted-foreground shrink-0 mr-0.5 flex items-center gap-1">
            <SlidersHorizontal className="h-2.5 w-2.5" />
            Source
          </span>
          <SourcePill
            label="All"
            active={!sp.source}
            href={buildHref({ source: undefined, q: sp.q, properties: sp.properties })}
          />
          {SOURCES.filter((s) => sourcesWithData.has(s)).map((s) => (
            <SourcePill
              key={s}
              label={humanLeadSource(s)}
              active={sp.source === s}
              href={buildHref({ source: s, q: sp.q, properties: sp.properties })}
            />
          ))}
          {sourcesWithData.size === 0 ? (
            <span className="text-[11px] text-muted-foreground italic">
              No sources yet.
            </span>
          ) : null}
        </div>
      </div>

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build /portal/leads href preserving active filter params. */
function buildHref({
  source,
  q,
  properties,
}: {
  source: string | undefined;
  q?: string;
  properties?: string;
}): string {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (q) params.set("q", q);
  if (properties) params.set("properties", properties);
  const qs = params.toString();
  return `/portal/leads${qs ? `?${qs}` : ""}`;
}

/** Pill-style source filter chip. Renders as a plain <Link> — no JS. */
function SourcePill({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
      )}
    >
      {label}
    </Link>
  );
}

function EmptyLeadsState() {
  return (
    <EmptyState
      title="Your pipeline is empty."
      body="Leads from chatbot conversations, contact forms, ads, or AppFolio sync land here. Pick a starting point below."
      action={{ label: "Set up lead capture", href: "/portal/site-builder" }}
      secondary={{
        label: "Connect data sources",
        href: "/portal/settings/integrations",
      }}
    />
  );
}

