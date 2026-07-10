import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Users,
  Flame,
  CalendarCheck,
  CheckCircle2,
  Bot,
  MousePointerClick,
  FileText,
  Eye,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  isAccessDenied,
  parsePropertyFilter,
  propertyWhereFragment,
  propertyOrOrgLevelWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import {
  LeadSource,
  LeadStatus,
  Prisma,
  VisitorIdentificationStatus,
} from "@prisma/client";
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

// Cross-signal filter chips. Each maps to a per-lead boolean computed
// in the page query: "chatbot" → lead has a ChatbotConversation row;
// "popup" → lead has a PopupEvent with type=CONVERTED; "visitor" → lead's
// email matches a Visitor row's email (or hashedEmail); "application" →
// lead has any Application row. Adding to URL as ?signal= so each chip is
// a plain Link / no JS.
const SIGNAL_KEYS = ["chatbot", "popup", "visitor", "application"] as const;
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
  }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const propertyIds = await parsePropertyFilter(sp, scope.orgId);
  const signalFilter: SignalKey | null = isSignalKey(sp.signal)
    ? sp.signal
    : null;

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

  // Signal filter — when set, restricts the visible leads to those that
  // have the corresponding cross-product touchpoint. Lead's Prisma
  // relations cover conversations + applications + visitor; popups are
  // a one-way link (PopupEvent.leadId with no Lead backref) so we
  // pre-fetch the leadId set when needed.
  if (signalFilter === "chatbot") {
    where.conversations = { some: {} };
  } else if (signalFilter === "application") {
    where.applications = { some: {} };
  } else if (signalFilter === "visitor") {
    where.visitorId = { not: null };
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
  const since28d = new Date(Date.now() - 28 * DAY);
  const kpiWhere: Prisma.LeadWhereInput = {
    ...tenantWhere(scope),
    ...propertyWhereFragment(scope, propertyIds),
  };

  // Property-filter fragment for non-Lead tables that have their own
  // propertyId column (ChatbotConversation, PopupEvent, Visitor,
  // Application). Reuses the same effective property set so KPIs move
  // with the operator's property filter.
  const nonLeadPropertyFragment =
    propertyIds && propertyIds.length > 0
      ? { propertyId: { in: propertyIds } }
      : {};

  const [
    leads,
    totalCount,
    properties,
    kpiLeads28d,
    kpiHotLeads,
    kpiToursScheduled,
    kpiSigned28d,
    sourceCounts,
    kpiChatbot28d,
    kpiPopupConv28d,
    kpiApplications28d,
    kpiVisitors28d,
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
      .catch(
        () => [] as Array<{ source: LeadSource; _count: { _all: number } }>,
      ),
    // --- Cross-product signal KPIs (28d) ----------------------------------
    // Each is org + property scoped. .catch fall-back so a single bad
    // query never blanks the strip.
    prisma.chatbotConversation
      .count({
        where: {
          orgId: scope.orgId,
          ...nonLeadPropertyFragment,
          createdAt: { gte: since28d },
        },
      })
      .catch(() => 0),
    prisma.popupEvent
      .count({
        where: {
          orgId: scope.orgId,
          type: "CONVERTED",
          occurredAt: { gte: since28d },
        },
      })
      .catch(() => 0),
    prisma.application
      .count({
        where: {
          lead: { ...kpiWhere },
          createdAt: { gte: since28d },
        },
      })
      .catch(() => 0),
    prisma.visitor
      .count({
        where: {
          orgId: scope.orgId,
          ...nonLeadPropertyFragment,
          firstSeenAt: { gte: since28d },
        },
      })
      .catch(() => 0),
  ]);

  // ---------------------------------------------------------------------
  // Per-lead signal-flag resolution.
  // After the main lead page is fetched, batch one existence query per
  // signal so each row knows whether the lead touched chatbot / popup /
  // visitor / application. Single-trip with `findMany({ select: { id:
  // true } })` instead of N+1 .count() per lead. The result Sets feed
  // SignalBadges on the kanban cards.
  // ---------------------------------------------------------------------
  const visibleLeadIds = leads.map((l) => l.id);
  const visibleEmails = leads
    .map((l) => l.email)
    .filter((e): e is string => !!e && e.trim() !== "")
    .map((e) => e.toLowerCase());

  const [chatbotByLead, popupByLead, applicationByLead, visitorByEmail] =
    await Promise.all([
      visibleLeadIds.length === 0
        ? []
        : prisma.chatbotConversation
            .findMany({
              where: { leadId: { in: visibleLeadIds } },
              select: { leadId: true },
              distinct: ["leadId"],
            })
            .catch(() => [] as Array<{ leadId: string | null }>),
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
            .catch(() => [] as Array<{ leadId: string | null }>),
      visibleLeadIds.length === 0
        ? []
        : prisma.application
            .findMany({
              where: { leadId: { in: visibleLeadIds } },
              select: { leadId: true },
              distinct: ["leadId"],
            })
            .catch(() => [] as Array<{ leadId: string }>),
      visibleEmails.length === 0
        ? []
        : prisma.visitor
            .groupBy({
              by: ["email"],
              where: {
                orgId: scope.orgId,
                email: { in: visibleEmails, mode: "insensitive" },
              },
              _sum: { sessionCount: true },
            })
            .catch(
              () =>
                [] as Array<{
                  email: string | null;
                  _sum: { sessionCount: number | null };
                }>,
            ),
    ]);

  const chatbotSet = new Set(
    chatbotByLead.map((r) => r.leadId).filter((id): id is string => !!id),
  );
  const popupSet = new Set(
    popupByLead.map((r) => r.leadId).filter((id): id is string => !!id),
  );
  const applicationSet = new Set(applicationByLead.map((r) => r.leadId));
  const visitorMap = new Map<string, number>();
  for (const row of visitorByEmail) {
    if (!row.email) continue;
    visitorMap.set(row.email.toLowerCase(), row._sum.sessionCount ?? 0);
  }

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

  // ---------------------------------------------------------------------
  // Unified lead tracking (SG ask): the Leads page must reflect EVERY
  // tracked contact, not just Lead-table rows. Pixel-identified visitors
  // are org-level (propertyId = null, the Cursive pixel is installed on
  // the resident domain) and otherwise only live on the Visitors feed.
  // Surface them here as leads so "how many leads are we tracking" answers
  // honestly. Read-only — these link out to the visitor feed; the kanban
  // above keeps full lead actions for true Lead rows.
  // ---------------------------------------------------------------------
  const visitorLeadWhere: Prisma.VisitorWhereInput = {
    ...tenantWhere(scope),
    ...propertyOrOrgLevelWhereFragment(scope, propertyIds),
    status: {
      in: [
        VisitorIdentificationStatus.IDENTIFIED,
        VisitorIdentificationStatus.ENRICHED,
        VisitorIdentificationStatus.MATCHED_TO_LEAD,
      ],
    },
    email: { not: null },
  };
  const [identifiedVisitors, identifiedVisitorCount] = await Promise.all([
    prisma.visitor
      .findMany({
        where: visitorLeadWhere,
        orderBy: [{ intentScore: "desc" }, { lastSeenAt: "desc" }],
        take: 100,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          intentScore: true,
          lastSeenAt: true,
          sessionCount: true,
        },
      })
      .catch(() => []),
    prisma.visitor.count({ where: visitorLeadWhere }).catch(() => 0),
  ]);
  const trackedTotal = totalCount + identifiedVisitorCount;

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
    visitCount: l.email ? (visitorMap.get(l.email.toLowerCase()) ?? 0) : 0,
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

  return (
    <div className="space-y-3 ls-page-fade">
      <PageHeader
        title="Leads"
        description={
          <>
            Form + chatbot opt-ins captured on your site. Click any lead to see
            full detail, conversation history, tours, and applications.
            {/* Norman feedback (May 22): when a user clicks the
                dashboard's "Captured · 30d" hero and lands here, they
                expect to see ALL captured contacts — but this page
                only holds Lead-table rows (form + chatbot). Spell out
                where the rest live so they don't think the platform
                is lying. */}
            <span className="block mt-1 text-[12px] text-muted-foreground">
              Pixel-identified visitors live in the{" "}
              <Link
                href="/portal/visitors"
                className="font-medium text-primary hover:underline"
              >
                Visitors feed
              </Link>
              . Chatbot threads live in{" "}
              <Link
                href="/portal/conversations"
                className="font-medium text-primary hover:underline"
              >
                Conversations
              </Link>
              .
            </span>
          </>
        }
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <Suspense
              fallback={
                <div className="h-9 w-48 rounded-md border border-border bg-secondary" />
              }
            >
              <PropertyMultiSelect
                properties={visibleProperties(scope, properties)}
                orgId={scope.orgId}
              />
            </Suspense>
            <span className="text-xs text-muted-foreground">
              {trackedTotal === 0
                ? "No leads yet"
                : identifiedVisitorCount > 0
                  ? `Tracking ${trackedTotal.toLocaleString()} contacts · ${totalCount.toLocaleString()} ${totalCount === 1 ? "lead" : "leads"} + ${identifiedVisitorCount.toLocaleString()} pixel-identified`
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
          value={conversionPct != null ? `${conversionPct}%` : "—"}
          hint={`${kpiSigned28d} signed`}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Cross-product signal strip — collapsed from 4 KPI tiles to a
          single-line link row. Operator feedback (2026-06-04): two rows
          of 4 tiles = 8 competing numbers above the actual lead list.
          Same data, denser surface, each number is a Link into its own
          page. Hides entirely when every signal is zero. */}
      {(kpiVisitors28d ||
        kpiChatbot28d ||
        kpiPopupConv28d ||
        kpiApplications28d) > 0 ? (
        <p
          aria-label="Cross-product signals (28d)"
          className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[11px] sm:text-[12px] text-muted-foreground"
        >
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-foreground/60">
            Also touched · 28d
          </span>
          {kpiVisitors28d > 0 ? (
            <Link
              href="/portal/visitors"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              <span className="font-semibold tabular-nums text-foreground">
                {kpiVisitors28d.toLocaleString()}
              </span>{" "}
              tracked visitors
            </Link>
          ) : null}
          {kpiChatbot28d > 0 ? (
            <Link
              href="/portal/chatbot"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Bot className="h-3 w-3" aria-hidden="true" />
              <span className="font-semibold tabular-nums text-foreground">
                {kpiChatbot28d.toLocaleString()}
              </span>{" "}
              chatbot convos
            </Link>
          ) : null}
          {kpiPopupConv28d > 0 ? (
            <Link
              href="/portal/popups"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <MousePointerClick className="h-3 w-3" aria-hidden="true" />
              <span className="font-semibold tabular-nums text-foreground">
                {kpiPopupConv28d.toLocaleString()}
              </span>{" "}
              popup conversions
            </Link>
          ) : null}
          {kpiApplications28d > 0 ? (
            <Link
              href="/portal/applications"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              <span className="font-semibold tabular-nums text-foreground">
                {kpiApplications28d.toLocaleString()}
              </span>{" "}
              applications
            </Link>
          ) : null}
        </p>
      ) : null}

      {/* Source-mix one-liner. Renders only when at least one lead
          exists and at least one source has data so it doesn't echo
          "0 leads from no sources" on day-one tenants.

          Defensive dedupe (2026-06-04): two LeadSource enum values
          can render to the same human label ("Chatbot" appeared twice
          on Telegraph Commons because legacy CHATBOT rows coexist with
          newer CHATBOT-tagged opt-ins from the V2 widget). Bucket by
          label and sum counts before formatting so the operator sees
          one entry per source name. */}
      {totalCount > 0 && sourceCounts.length > 0 ? (
        <p className="text-[11.5px] text-muted-foreground">
          {totalCount.toLocaleString()} {totalCount === 1 ? "lead" : "leads"}
          {" · "}
          {(() => {
            const byLabel = new Map<string, number>();
            for (const r of sourceCounts) {
              const label = humanLeadSource(r.source);
              byLabel.set(label, (byLabel.get(label) ?? 0) + r._count._all);
            }
            return Array.from(byLabel.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => `${count} from ${label}`)
              .join(" · ");
          })()}
        </p>
      ) : null}

      {/* Premium filter bar — search + pill-based source tabs */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
        {/* Search row */}
        <form action="/portal/leads" className="flex items-center gap-2">
          {/* Preserve active source + signal + property scope through search submit */}
          {sp.source ? (
            <input type="hidden" name="source" value={sp.source} />
          ) : null}
          {signalFilter ? (
            <input type="hidden" name="signal" value={signalFilter} />
          ) : null}
          {sp.properties ? (
            <input type="hidden" name="properties" value={sp.properties} />
          ) : null}
          <div className="relative flex-1">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
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
          {sp.source || sp.property || sp.properties || sp.q ? (
            <Link
              href="/portal/leads"
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
            href={buildHref({
              source: undefined,
              signal: signalFilter,
              q: sp.q,
              properties: sp.properties,
            })}
          />
          {SOURCES.filter((s) => sourcesWithData.has(s)).map((s) => (
            <SourcePill
              key={s}
              label={humanLeadSource(s)}
              active={sp.source === s}
              href={buildHref({
                source: s,
                signal: signalFilter,
                q: sp.q,
                properties: sp.properties,
              })}
            />
          ))}
          {sourcesWithData.size === 0 ? (
            <span className="text-[11px] text-muted-foreground italic">
              No sources yet.
            </span>
          ) : null}
        </div>

        {/* Cross-signal filter row — orthogonal to source. Lets the
            operator slice the board by which products this lead has
            touched (chatbot transcript, popup conversion, pixel match,
            application). Layered on top of source + property filters. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-[0.14em] font-semibold text-muted-foreground shrink-0 mr-0.5 flex items-center gap-1">
            <SlidersHorizontal className="h-2.5 w-2.5" />
            Signal
          </span>
          <SourcePill
            label="All"
            active={!signalFilter}
            href={buildHref({
              source: sp.source,
              signal: undefined,
              q: sp.q,
              properties: sp.properties,
            })}
          />
          <SourcePill
            label="Visitors"
            active={signalFilter === "visitor"}
            href={buildHref({
              source: sp.source,
              signal: "visitor",
              q: sp.q,
              properties: sp.properties,
            })}
          />
          <SourcePill
            label="Chatbot"
            active={signalFilter === "chatbot"}
            href={buildHref({
              source: sp.source,
              signal: "chatbot",
              q: sp.q,
              properties: sp.properties,
            })}
          />
          <SourcePill
            label="Popup"
            active={signalFilter === "popup"}
            href={buildHref({
              source: sp.source,
              signal: "popup",
              q: sp.q,
              properties: sp.properties,
            })}
          />
          <SourcePill
            label="Applied"
            active={signalFilter === "application"}
            href={buildHref({
              source: sp.source,
              signal: "application",
              q: sp.q,
              properties: sp.properties,
            })}
          />
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
              <span
                className="px-3 py-2 border border-border rounded-md opacity-40 cursor-not-allowed select-none"
                aria-disabled="true"
              >
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
              <span
                className="px-3 py-2 border border-border rounded-md opacity-40 cursor-not-allowed select-none"
                aria-disabled="true"
              >
                Next
              </span>
            )}
          </div>
        </div>
      )}

      {totalCount === 0 && identifiedVisitorCount === 0 ? (
        <EmptyLeadsState />
      ) : (
        <>
          {totalCount > 0 ? <LeadKanban items={items} /> : null}
          {identifiedVisitorCount > 0 ? (
            <IdentifiedVisitorsSection
              visitors={identifiedVisitors}
              total={identifiedVisitorCount}
            />
          ) : null}
        </>
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
          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
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

// ---------------------------------------------------------------------------
// IdentifiedVisitorsSection — surfaces pixel-identified visitors as leads on
// the Leads page. Read-only (links to the visitor feed); the lead kanban
// above retains full lead actions for true Lead rows. This keeps the
// existing leads table untouched while answering SG's ask: "show everything
// we track as a lead."
// ---------------------------------------------------------------------------
function IdentifiedVisitorsSection({
  visitors,
  total,
}: {
  visitors: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    intentScore: number;
    lastSeenAt: Date | null;
    sessionCount: number;
  }>;
  total: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Pixel-identified visitors
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {total.toLocaleString()} {total === 1 ? "person" : "people"}{" "}
              identified by the website pixel — tracked leads not yet captured
              via form or chatbot.
            </p>
          </div>
        </div>
        <Link
          href="/portal/visitors"
          className="shrink-0 text-[11.5px] font-semibold text-primary hover:underline whitespace-nowrap"
        >
          Open visitor feed →
        </Link>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-semibold">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold">Source</th>
              <th className="text-right px-4 py-2.5 font-semibold hidden sm:table-cell">
                Intent
              </th>
              <th className="text-right px-4 py-2.5 font-semibold hidden sm:table-cell">
                Last seen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visitors.map((v) => {
              const name =
                [v.firstName, v.lastName].filter(Boolean).join(" ") ||
                v.email ||
                "Identified visitor";
              return (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link
                      href="/portal/visitors"
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {name}
                    </Link>
                    {v.email ? (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">
                        {v.email}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" aria-hidden="true" /> Website
                      pixel
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                    {v.intentScore > 0 ? (
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          v.intentScore >= 70
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {v.intentScore}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {v.lastSeenAt ? v.lastSeenAt.toLocaleDateString() : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {total > visitors.length ? (
        <div className="border-t border-border px-4 py-2.5 text-center">
          <Link
            href="/portal/visitors"
            className="text-[11.5px] font-semibold text-primary hover:underline"
          >
            View all {total.toLocaleString()} identified visitors →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
