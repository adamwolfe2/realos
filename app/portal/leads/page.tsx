import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { resolveWindow, pctChange } from "@/lib/dashboard/window";
import { DateRangePicker } from "@/components/portal/date-range-picker";
import { SourceMark } from "@/components/portal/source-mark";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  isAccessDenied,
  marketableScopedPropertyClause,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import {
  LeadKanban,
  type LeadKanbanItem,
} from "@/components/portal/lead-kanban";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import { ALLOWED_WRITE_ROLES } from "@/lib/auth/write-roles";
import { humanLeadSource } from "@/lib/format";
import { cn } from "@/lib/utils";
import { soft } from "@/lib/soft";


export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

const SOURCES = Object.values(LeadSource);
const PAGE_SIZE = 50;

// Cross-signal filter chips. Each maps to a per-lead boolean computed
// in the page query: "chatbot" → lead has a ChatbotConversation row;
// "popup" → lead has a PopupEvent with type=CONVERTED; "application" →
// lead has any Application row. Adding to URL as ?signal= so each chip is
// a plain Link / no JS.
const SIGNAL_KEYS = ["chatbot", "popup", "application"] as const;
type SignalKey = (typeof SIGNAL_KEYS)[number];
function isSignalKey(v: string | undefined): v is SignalKey {
  return !!v && (SIGNAL_KEYS as readonly string[]).includes(v);
}

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
    signal?: string;
    property?: string;
    properties?: string;
    q?: string;
    page?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const propertyIds = await parsePropertyFilter(sp, scope.orgId);
  const signalFilter: SignalKey | null = isSignalKey(sp.signal)
    ? sp.signal
    : null;

  // Default (no selection) scopes to enabled properties; org-level leads
  // (propertyId=null — unattributed captures) stay visible. AND-wrapped
  // because the search filter below assigns `where.OR` — a top-level OR
  // from this clause would be clobbered.
  const leadPropertyClause = await marketableScopedPropertyClause(
    scope,
    propertyIds,
    "propertyId",
    { defaultIncludesOrgRows: true },
  );
  const where: Prisma.LeadWhereInput = {
    ...tenantWhere(scope),
    AND: [leadPropertyClause],
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

  // Signal filter — when set, restricts the visible leads to those that
  // have the corresponding cross-product touchpoint. Lead's Prisma
  // relations cover conversations + applications; popups are
  // a one-way link (PopupEvent.leadId with no Lead backref) so we
  // pre-fetch the leadId set when needed.
  if (signalFilter === "chatbot") {
    where.conversations = { some: {} };
  } else if (signalFilter === "application") {
    where.applications = { some: {} };
  } else if (signalFilter === "popup") {
    const popupLeadIds = await prisma.popupEvent
      .findMany({
        where: {
          orgId: scope.orgId,
          type: "CONVERTED",
          leadId: { not: null },
        },
        select: { leadId: true },
        distinct: ["leadId"],
      })
      .then((rows) => rows.map((r) => r.leadId!).filter(Boolean));
    where.id = { in: popupLeadIds.length > 0 ? popupLeadIds : ["__none__"] };
  }

  // KPI strip queries — scoped to the same property + filter set so the
  // numbers above the kanban move in lockstep with what the operator sees
  // below. Each runs in parallel with the main page query; failures fall
  // through to 0 so a single bad lookup never blanks the page.
  const win = resolveWindow(sp);
  const kpiWhere: Prisma.LeadWhereInput = {
    ...tenantWhere(scope),
    AND: [leadPropertyClause],
  };

  // Property-filter fragment for non-Lead tables that have their own
  // propertyId column (ChatbotConversation, PopupEvent,
  // Application). Reuses the same effective property set so KPIs move
  // with the operator's property filter.
  const nonLeadPropertyFragment = await marketableScopedPropertyClause(
    scope,
    propertyIds,
    "propertyId",
    { defaultIncludesOrgRows: true },
  );

  const [
    leads,
    totalCount,
    properties,
    kpiLeads28d,
    kpiLeadsPrior,
    kpiHotLeads,
    kpiToursScheduled,
    kpiSigned28d,
    sourceCounts,
    kpiChatbot28d,
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
      // firstSeenAt, not createdAt: imports insert history "now".
      .count({ where: { ...kpiWhere, firstSeenAt: { gte: win.start, lte: win.end } } })
      .catch(soft(0, "portal.leads:206")),
    prisma.lead
      .count({ where: { ...kpiWhere, firstSeenAt: { gte: win.priorStart, lt: win.start } } })
      .catch(soft(0, "portal.leads:prior")),
    prisma.lead
      .count({
        where: {
          ...kpiWhere,
          status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED] },
          score: { gte: 70 },
        },
      })
      .catch(soft(0, "portal.leads:215")),
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
      .catch(soft(0, "portal.leads:230")),
    prisma.lead
      .count({
        where: {
          ...kpiWhere,
          status: LeadStatus.SIGNED,
          // Same cohort as the "new" count, so conversion compares like with like.
          firstSeenAt: { gte: win.start, lte: win.end },
        },
      })
      .catch(soft(0, "portal.leads:239")),
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
      .catch(soft([] as Array<{ source: LeadSource; _count: { _all: number } }>, "portal.leads:250")),
    // Chats in the last 28d, linked from the header so chatbot threads
    // (not Lead rows) are easy to find.
    prisma.chatbotConversation
      .count({
        where: {
          orgId: scope.orgId,
          ...nonLeadPropertyFragment,
          createdAt: { gte: win.start, lte: win.end },
        },
      })
      .catch(soft(0, "portal.leads:264")),
  ]);

  // ---------------------------------------------------------------------
  // Per-lead signal-flag resolution.
  // After the main lead page is fetched, batch one existence query per
  // signal so each row knows whether the lead touched chatbot / popup /
  // application. Single-trip with `findMany({ select: { id:
  // true } })` instead of N+1 .count() per lead. The result Sets feed
  // SignalBadges on the kanban cards.
  // ---------------------------------------------------------------------
  const visibleLeadIds = leads.map((l) => l.id);
  const [chatbotByLead, popupByLead, applicationByLead] =
    await Promise.all([
      visibleLeadIds.length === 0
        ? []
        : prisma.chatbotConversation
            .findMany({
              where: { leadId: { in: visibleLeadIds } },
              select: { leadId: true },
              distinct: ["leadId"],
            })
            .catch(soft([] as Array<{ leadId: string | null }>, "portal.leads:317")),
      visibleLeadIds.length === 0
        ? []
        : prisma.popupEvent
            .findMany({
              where: {
                orgId: scope.orgId,
                leadId: { in: visibleLeadIds },
                type: "CONVERTED",
              },
              select: { leadId: true },
              distinct: ["leadId"],
            })
            .catch(soft([] as Array<{ leadId: string | null }>, "portal.leads:330")),
      visibleLeadIds.length === 0
        ? []
        : prisma.application
            .findMany({
              where: { leadId: { in: visibleLeadIds } },
              select: { leadId: true },
              distinct: ["leadId"],
            })
            .catch(soft([] as Array<{ leadId: string }>, "portal.leads:339")),
    ]);

  const chatbotSet = new Set(
    chatbotByLead.map((r) => r.leadId).filter((id): id is string => !!id),
  );
  const popupSet = new Set(
    popupByLead.map((r) => r.leadId).filter((id): id is string => !!id),
  );
  const applicationSet = new Set(applicationByLead.map((r) => r.leadId));

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
    hasChatbot: chatbotSet.has(l.id),
    hasPopup: popupSet.has(l.id),
    hasApplication: applicationSet.has(l.id),
  }));

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Build a query string that preserves active filters and sets the page
  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (sp.source) params.set("source", sp.source);
    if (signalFilter) params.set("signal", signalFilter);
    if (sp.properties) params.set("properties", sp.properties);
    else if (sp.property) params.set("property", sp.property);
    if (sp.q) params.set("q", sp.q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/portal/leads${qs ? `?${qs}` : ""}`;
  }

  const headlineStats: Array<{ value: string; label: string; href?: string; delta?: number | null }> = [
    { value: kpiLeads28d.toLocaleString(), label: "new", delta: pctChange(kpiLeads28d, kpiLeadsPrior) },
    { value: kpiHotLeads.toLocaleString(), label: "hot" },
    { value: kpiToursScheduled.toLocaleString(), label: "touring or applying" },
    { value: conversionPct != null ? `${conversionPct}%` : "—", label: "converted" },
  ];
  // Norman (May 22): chatbot threads are not Lead rows; point at them so
  // the count here never looks like it is missing contacts.
  if (kpiChatbot28d > 0) {
    headlineStats.push({
      value: kpiChatbot28d.toLocaleString(),
      label: "chats in Inbox",
      href: "/portal/conversations",
    });
  }

  return (
    <div className="space-y-5 ls-page-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Leads</h1>
          <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
            {headlineStats.map((st, i) => {
              const body = (
                <>
                  <span className="font-medium text-foreground">{st.value}</span>
                  {st.delta != null && st.delta !== 0 ? (
                    <span className={`ml-1 font-semibold ${st.delta > 0 ? "text-[#15803d]" : "text-[#b91c1c]"}`}>
                      {st.delta > 0 ? "+" : ""}
                      {st.delta}%
                    </span>
                  ) : null}{" "}
                  {st.label}
                </>
              );
              return (
                <span key={st.label}>
                  {i > 0 ? " · " : null}
                  {st.href ? (
                    <Link href={st.href} className="hover:text-primary">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </span>
              );
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker label={win.label} />
          <Suspense
            fallback={<div className="h-9 w-48 rounded-[2px] border border-border bg-secondary" />}
          >
            <PropertyMultiSelect properties={visibleProperties(scope, properties)} orgId={scope.orgId} />
          </Suspense>
          <ExportButton href="/api/tenant/leads/export" />
          {ALLOWED_WRITE_ROLES.has(scope.role) ? (
            <Link
              href="/portal/leads/new"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 rounded-[2px] bg-primary text-primary-foreground hover:bg-primary/90 h-[34px] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add lead
            </Link>
          ) : null}
        </div>
      </div>

      {isAccessDenied(scope, propertyIds) ? (
        <PropertyAccessDeniedBanner pathname="/portal/leads" />
      ) : null}


      {/* One toolbar row: search, source, signal, paging. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form action="/portal/leads" className="relative w-full sm:w-72">
          {sp.source ? <input type="hidden" name="source" value={sp.source} /> : null}
          {signalFilter ? <input type="hidden" name="signal" value={signalFilter} /> : null}
          {sp.properties ? <input type="hidden" name="properties" value={sp.properties} /> : null}
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            aria-label="Search leads"
            placeholder="Search name, email, phone"
            className="w-full border border-border bg-card pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
          />
        </form>

        <div className="flex items-center gap-1 flex-wrap">
          <SourcePill
            label="All sources"
            active={!sp.source}
            href={buildHref({ source: undefined, signal: signalFilter, q: sp.q, properties: sp.properties })}
          />
          {SOURCES.filter((s) => sourcesWithData.has(s)).map((s) => (
            <SourcePill
              key={s}
              source={s}
              count={sourceCounts.filter((r) => r.source === s).reduce((n, r) => n + r._count._all, 0)}
              label={humanLeadSource(s)}
              active={sp.source === s}
              href={buildHref({ source: s, signal: signalFilter, q: sp.q, properties: sp.properties })}
            />
          ))}
        </div>

        <span className="hidden sm:block h-4 w-px bg-border" aria-hidden />

        <div className="flex items-center gap-1 flex-wrap">
          {([
            [undefined, "Any signal"],
            ["chatbot", "Chatted"],
            ["popup", "Popup"],
            ["application", "Applied"],
          ] as const).map(([key, label]) => (
            <SourcePill
              key={label}
              label={label}
              active={(signalFilter ?? undefined) === key}
              href={buildHref({ source: sp.source, signal: key, q: sp.q, properties: sp.properties })}
            />
          ))}
        </div>

        {sp.source || sp.property || sp.properties || sp.q ? (
          <Link href="/portal/leads" className="text-[12px] text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        ) : null}

        <div className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground tabular-nums">
          <span className="mr-1">
            {totalCount === 0 ? "No leads" : `${rangeStart}–${rangeEnd} of ${totalCount}`}
          </span>
          {totalPages > 1 ? (
            <>
              <PageArrow href={page > 1 ? pageHref(page - 1) : null} label="Previous page" dir="prev" />
              <PageArrow href={page < totalPages ? pageHref(page + 1) : null} label="Next page" dir="next" />
            </>
          ) : null}
        </div>
      </div>

      {totalCount === 0 ? (
        <EmptyLeadsState orgId={scope.orgId} />
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
  signal,
  q,
  properties,
}: {
  source: string | undefined;
  signal?: SignalKey | string | null | undefined;
  q?: string;
  properties?: string;
}): string {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (signal) params.set("signal", signal);
  if (q) params.set("q", q);
  if (properties) params.set("properties", properties);
  const qs = params.toString();
  return `/portal/leads${qs ? `?${qs}` : ""}`;
}

/** Compact prev/next control for the toolbar. Disabled when href is null. */
function PageArrow({ href, label, dir }: { href: string | null; label: string; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const cls = "grid h-7 w-7 place-items-center rounded-full border border-border";
  return href ? (
    <Link href={href} aria-label={label} className={cn(cls, "hover:bg-secondary hover:text-foreground")}>
      <Icon className="h-3.5 w-3.5" />
    </Link>
  ) : (
    <span aria-disabled="true" className={cn(cls, "opacity-40")}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/** Pill-style source filter chip. Renders as a plain <Link> — no JS. */
function SourcePill({
  label,
  active,
  href,
  source,
  count,
}: {
  label: string;
  active: boolean;
  href: string;
  /** When set, the pill leads with that tool's logo and a lead count. */
  source?: LeadSource;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-1 text-[12px] font-medium transition-colors",
        source ? "pl-1 pr-2.5" : "px-2.5",
        active
          ? "bg-[var(--t-accent-soft)] text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary",
      )}
    >
      {source ? <SourceMark source={source} size={20} /> : null}
      {label}
      {count != null ? <span className="tabular-nums text-muted-foreground">{count}</span> : null}
    </Link>
  );
}

async function EmptyLeadsState({ orgId }: { orgId: string }) {
  // The site builder is a wall when the managed website module is off or the
  // workspace brings its own site; send those users to the chatbot instead.
  const org = await prisma.organization
    .findUnique({
      where: { id: orgId },
      select: { moduleWebsite: true, bringYourOwnSite: true },
    })
    .catch((err: unknown) => {
      console.error("[portal/leads] empty-state org lookup failed:", err);
      return null;
    });
  const hasSite = Boolean(org?.moduleWebsite) && !org?.bringYourOwnSite;
  return (
    <EmptyState
      title="Your pipeline is empty."
      body="Leads from chatbot conversations, contact forms, ads, or AppFolio sync land here. Pick a starting point below."
      action={
        hasSite
          ? { label: "Set up lead capture", href: "/portal/site-builder" }
          : { label: "Install the chatbot", href: "/portal/chatbot" }
      }
      secondary={{
        label: "Connect data sources",
        href: "/portal/connect",
      }}
    />
  );
}

