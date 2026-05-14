import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  parsePropertyFilter,
  propertyWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { Prisma, VisitorIdentificationStatus } from "@prisma/client";
import { extractIdentity } from "@/lib/visitors/enrichment";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { ExportButton } from "@/components/ui/export-button";
import { StatCard } from "@/components/admin/stat-card";
import { EngageComposer } from "./engage-composer";
import { AutoRefresh } from "@/components/portal/sync/auto-refresh";
import { PixelSyncButton } from "@/components/portal/sync/pixel-sync-button";
import {
  VisitorTable,
  type VisitorRow,
} from "@/components/portal/visitors/visitor-table";
import { DataPlaceholder } from "@/components/portal/ui/data-placeholder";
import { Radio } from "lucide-react";

export const metadata: Metadata = { title: "Visitor feed" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type WindowKey = "24h" | "7d" | "30d" | "all";
type StatusKey = "all" | "identified" | "hot" | "with_lead";
type SortKey = "recent" | "intent";

const WINDOWS: Array<{ key: WindowKey; label: string; hours: number | null }> =
  [
    { key: "24h", label: "24h", hours: 24 },
    { key: "7d", label: "7d", hours: 24 * 7 },
    { key: "30d", label: "30d", hours: 24 * 30 },
    { key: "all", label: "All", hours: null },
  ];

const STATUS_TABS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "identified", label: "Identified only" },
  { key: "hot", label: "Hot (intent \u2265 60)" },
  { key: "with_lead", label: "With lead" },
];

const SORT_TABS: Array<{ key: SortKey; label: string }> = [
  { key: "recent", label: "Most recent" },
  { key: "intent", label: "Highest intent" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function readParam<T extends string>(
  params: SearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 200); // hard cap
}

function buildQuery(
  base: {
    window: WindowKey;
    status: StatusKey;
    sort: SortKey;
    page: number;
  },
  overrides: Partial<{
    window: WindowKey;
    status: StatusKey;
    sort: SortKey;
    page: number;
  }>
): string {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  if (merged.window !== "7d") params.set("window", merged.window);
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.sort !== "recent") params.set("sort", merged.sort);
  if (merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const windowKey = readParam<WindowKey>(
    params,
    "window",
    ["24h", "7d", "30d", "all"],
    "7d"
  );
  const statusKey = readParam<StatusKey>(
    params,
    "status",
    ["all", "identified", "hot", "with_lead"],
    "all"
  );
  const sortKey = readParam<SortKey>(
    params,
    "sort",
    ["recent", "intent"],
    "recent"
  );
  const page = parsePage(params.page);

  const scope = await requireScope();
  const tenant = tenantWhere<{ orgId?: string }>(scope);
  const propertyIds = parsePropertyFilter(params);

  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const properties = visibleProperties(scope, allProperties);

  const windowDef = WINDOWS.find((w) => w.key === windowKey)!;
  const since = windowDef.hours
    ? new Date(Date.now() - windowDef.hours * 60 * 60 * 1000)
    : null;

  const baseWhere: Prisma.VisitorWhereInput = {
    ...tenant,
    ...propertyWhereFragment(scope, propertyIds),
    ...(since ? { lastSeenAt: { gte: since } } : {}),
  };

  const statusWhere: Prisma.VisitorWhereInput = (() => {
    switch (statusKey) {
      case "identified":
        return {
          status: {
            in: [
              VisitorIdentificationStatus.IDENTIFIED,
              VisitorIdentificationStatus.ENRICHED,
              VisitorIdentificationStatus.MATCHED_TO_LEAD,
            ],
          },
        };
      case "hot":
        return { intentScore: { gte: 60 } };
      case "with_lead":
        return { status: VisitorIdentificationStatus.MATCHED_TO_LEAD };
      case "all":
      default:
        return {};
    }
  })();

  const where: Prisma.VisitorWhereInput = { ...baseWhere, ...statusWhere };

  const orderBy: Prisma.VisitorOrderByWithRelationInput[] =
    sortKey === "intent"
      ? [{ intentScore: "desc" }, { lastSeenAt: "desc" }]
      : [{ lastSeenAt: "desc" }];

  const [visitors, totalInView, integration, summary] = await Promise.all([
    prisma.visitor.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      // No explicit select here — extractIdentity (in
      // lib/visitors/enrichment.ts) reads enrichedData + pagesViewed
      // among others, so a partial shape would break it. The
      // optimization opportunity is real (those JSON columns can be
      // 10-50KB per row) but needs to flow through extractIdentity's
      // signature first. Tracked as a follow-up; not safe to ship
      // overnight without the corresponding refactor.
    }),
    prisma.visitor.count({ where }),
    // The visitor feed page header surfaces the "where is the pixel
    // installed" stat. With multi-property scoping a single org may
    // have several pixels (one per property) plus a legacy org-wide
    // row. We pick the most-recently-active row so the header reflects
    // the pixel actually firing.
    prisma.cursiveIntegration.findFirst({
      where: { orgId: scope.orgId },
      orderBy: [{ lastEventAt: "desc" }, { provisionedAt: "desc" }],
      select: {
        cursivePixelId: true,
        pixelScriptUrl: true,
        installedOnDomain: true,
        lastEventAt: true,
        totalEventsCount: true,
        cursiveSegmentId: true,
        lastSegmentSyncAt: true,
      },
    }),
    (async () => {
      const [identified, withEmail, withLead] = await Promise.all([
        prisma.visitor.count({
          where: {
            ...baseWhere,
            status: {
              in: [
                VisitorIdentificationStatus.IDENTIFIED,
                VisitorIdentificationStatus.ENRICHED,
                VisitorIdentificationStatus.MATCHED_TO_LEAD,
              ],
            },
          },
        }),
        prisma.visitor.count({
          where: { ...baseWhere, email: { not: null } },
        }),
        prisma.visitor.count({
          where: {
            ...baseWhere,
            status: VisitorIdentificationStatus.MATCHED_TO_LEAD,
          },
        }),
      ]);
      return { identified, withEmail, withLead };
    })(),
  ]);

  const hasPixel = Boolean(integration?.cursivePixelId);
  const noVisitorsAtAll = await (async () => {
    if (totalInView > 0) return false;
    return (
      (await prisma.visitor.count({ where: tenant as Prisma.VisitorWhereInput })) ===
      0
    );
  })();

  // Pixel freshness — operators have been burned by silent pixel failures
  // (CSP regressions, ad blockers, removed snippet). Surface staleness any
  // time the pixel exists but no events have fired recently. Two thresholds:
  // > 24h shows an amber warning, > 7d shows a red one. Don't block the
  // page; the visitor feed is still useful for historical review.
  const pixelLastEventAt = integration?.lastEventAt ?? null;
  const pixelAgeMs = pixelLastEventAt
    ? Date.now() - pixelLastEventAt.getTime()
    : null;
  const pixelStale =
    hasPixel && (pixelAgeMs == null || pixelAgeMs > 24 * 60 * 60 * 1000);
  const pixelDormant =
    hasPixel && (pixelAgeMs == null || pixelAgeMs > 7 * 24 * 60 * 60 * 1000);

  // Live chats — any chatbot conversation with activity in the last 5 minutes.
  // We engage at the conversation level because that's where the sessionId
  // lives. The widget polls /api/public/chatbot/inbox keyed by sessionId.
  const LIVE_WINDOW_MS = 5 * 60 * 1000;
  const liveChats = await prisma.chatbotConversation
    .findMany({
      where: {
        ...tenant,
        lastMessageAt: { gte: new Date(Date.now() - LIVE_WINDOW_MS) },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 8,
      select: {
        id: true,
        sessionId: true,
        capturedName: true,
        capturedEmail: true,
        pageUrl: true,
        messageCount: true,
        lastMessageAt: true,
      },
    })
    .catch(() => [] as never[]);

  // Most-recent chatbot conversation per visitor lookup. Lets each visitor row
  // surface an Engage button if that visitor (matched by visitorHash) has had
  // a chat in the live window.
  const visitorIds = visitors.map((v) => v.id).filter(Boolean);
  const visitorChatMap = new Map<
    string,
    { sessionId: string; lastMessageAt: Date }
  >();
  if (visitorIds.length > 0) {
    const recentChats = await prisma.chatbotConversation
      .findMany({
        where: {
          ...tenant,
          visitorHash: { in: visitorIds },
          lastMessageAt: { gte: new Date(Date.now() - LIVE_WINDOW_MS) },
        },
        orderBy: { lastMessageAt: "desc" },
        select: { visitorHash: true, sessionId: true, lastMessageAt: true },
      })
      .catch(() => [] as never[]);
    for (const c of recentChats) {
      if (!c.visitorHash) continue;
      if (!visitorChatMap.has(c.visitorHash)) {
        visitorChatMap.set(c.visitorHash, {
          sessionId: c.sessionId,
          lastMessageAt: c.lastMessageAt,
        });
      }
    }
  }

  const selection = { window: windowKey, status: statusKey, sort: sortKey, page };

  return (
    <div className="space-y-3 ls-page-fade">
      <AutoRefresh intervalMs={15000} />
      <PageHeader
        title="Visitor feed"
        description="Real people visiting your site, identified by the pixel. Auto-refreshes every 15 seconds."
        actions={
          <div className="flex items-center gap-3">
            <PropertyMultiSelect
              properties={properties}
              orgId={scope.orgId}
            />
            {hasPixel ? (
              <p className="text-xs text-muted-foreground">
                Pixel on{" "}
                <span className="font-medium text-foreground">
                  {integration?.installedOnDomain ?? "unknown host"}
                </span>
                {integration?.lastEventAt
                  ? ` · last event ${formatDistanceToNow(
                      integration.lastEventAt,
                      { addSuffix: true }
                    )}`
                  : " · no events yet"}
              </p>
            ) : null}
            {hasPixel ? (
              <PixelSyncButton
                lastEventAt={integration?.lastEventAt ?? null}
                hasSegment={Boolean(integration?.cursiveSegmentId)}
              />
            ) : null}
            <ExportButton href="/api/tenant/visitors/export" />
          </div>
        }
      />

      {/* Filter controls — single inline row. Window / Status / Sort sit
          side-by-side instead of stacking, with each group flowing to the
          next line only when the viewport actually runs out of width. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card px-3 py-2">
        <TabGroup
          legend="Window"
          items={WINDOWS.map((w) => ({
            key: w.key,
            label: w.label,
            active: windowKey === w.key,
            href: buildQuery(selection, { window: w.key, page: 1 }),
          }))}
        />
        <TabGroup
          legend="Status"
          items={STATUS_TABS.map((t) => ({
            key: t.key,
            label: t.label,
            active: statusKey === t.key,
            href: buildQuery(selection, { status: t.key, page: 1 }),
          }))}
        />
        <TabGroup
          legend="Sort"
          items={SORT_TABS.map((t) => ({
            key: t.key,
            label: t.label,
            active: sortKey === t.key,
            href: buildQuery(selection, { sort: t.key, page: 1 }),
          }))}
        />
      </div>

      {/* Summary strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Identified visitors"
          value={summary.identified}
          hint={windowDef.label === "All" ? "All time" : `Last ${windowDef.label}`}
        />
        <StatCard
          label="With email"
          value={summary.withEmail}
          hint="Captured or resolved"
        />
        <StatCard
          label="Matched to a lead"
          value={summary.withLead}
          hint="In your pipeline"
        />
      </section>

      {/* Pixel staleness banner removed per UX feedback — the new
          PixelSyncButton in the page header surfaces last-event freshness
          and offers a one-click resync, so the redundant warning panel
          was just noise. */}

      {/* Live chats — operator can engage active chatbot conversations */}
      {liveChats.length > 0 ? (
        <LiveChatsPanel chats={liveChats} />
      ) : null}

      {/* Empty / Feed */}
      {!hasPixel ? (
        <EmptyNoPixel />
      ) : noVisitorsAtAll ? (
        <EmptyNoVisitors />
      ) : visitors.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground text-center">
          No visitors match these filters. Try widening the time window or the
          status filter.
        </div>
      ) : (
        <>
          <VisitorTable
            rows={visitors.map<VisitorRow>((v) => {
              const id = extractIdentity(v);
              return {
                id: v.id,
                firstName: id.firstName,
                lastName: id.lastName,
                displayName: id.displayName,
                email: v.email ?? null,
                location: id.location,
                lastPage: id.lastPagePath,
                lastPageUrl: id.lastPageUrl,
                sessions: v.sessionCount,
                lastSeenAtIso: v.lastSeenAt.toISOString(),
                liveChat: visitorChatMap.has(v.id),
              };
            })}
          />
          <Pager
            page={page}
            totalInView={totalInView}
            selection={selection}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PixelStalenessBanner — explicit warning when the Cursive pixel hasn't
// fired in 24h+. Operators previously had no signal that the snippet had
// gone quiet; they'd assume "no traffic" when the real issue was a removed
// script or a CSP regression on the property site.
// ---------------------------------------------------------------------------

function PixelStalenessBanner({
  lastEventAt,
  dormant,
  domain,
}: {
  lastEventAt: Date | null;
  dormant: boolean;
  domain: string | null;
}) {
  const ageLabel = lastEventAt
    ? formatDistanceToNow(lastEventAt, { addSuffix: true })
    : "never";
  // Brand-aligned tone scale — dormant (>7d) is destructive (real
  // problem); stale (>24h) is muted neutral (informational).
  const tone = dormant
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-border bg-muted/40 text-foreground";
  const headline = dormant
    ? "Pixel hasn't fired in 7+ days — feed isn't live."
    : "Pixel hasn't fired in 24+ hours — feed isn't live.";
  return (
    <div
      role="status"
      className={`rounded-lg border px-3 py-2 flex items-start justify-between gap-3 flex-wrap ${tone}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight">{headline}</p>
        <p className="text-[11px] mt-0.5 leading-snug opacity-90">
          Real-time sync IS running (this page polls every 15s) — but the
          pixel snippet on{" "}
          <span className="font-semibold">{domain ?? "your property site"}</span>{" "}
          stopped sending events {ageLabel}. Check the snippet is still in
          the &lt;head&gt;, ad blockers / CSP rules aren&apos;t stripping it,
          and the domain matches. Until events resume, the feed below shows
          historical visitors only.
        </p>
      </div>
      <Link
        href="/portal/connect"
        className="shrink-0 inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-1.5 text-xs font-semibold hover:opacity-90"
      >
        Verify pixel install
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveChatsPanel — surfaces ChatbotConversations active in the last 5 minutes
// so an operator can push a contextual message into the visitor's widget.
// ---------------------------------------------------------------------------

function LiveChatsPanel({
  chats,
}: {
  chats: Array<{
    id: string;
    sessionId: string;
    capturedName: string | null;
    capturedEmail: string | null;
    pageUrl: string | null;
    messageCount: number;
    lastMessageAt: Date;
  }>;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Live chats right now
          </h2>
          <p className="text-xs text-muted-foreground">
            Active in the last 5 minutes. Send a contextual message and it will
            appear in the visitor&apos;s chatbot within a few seconds.
          </p>
        </div>
        <Link
          href="/portal/conversations"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          All conversations
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {chats.map((chat) => {
          const placeholder = chat.pageUrl
            ? `Hi! I noticed you were checking out ${pathFromUrl(chat.pageUrl)}. Anything I can help with?`
            : undefined;
          return (
            <li
              key={chat.id}
              className="py-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <Link
                    href={`/portal/conversations/${chat.id}`}
                    className="font-medium text-primary hover:underline underline-offset-2"
                  >
                    {chat.capturedName ??
                      chat.capturedEmail ??
                      "Anonymous visitor"}
                  </Link>
                  <span className="text-[11px] text-muted-foreground">
                    {chat.messageCount} msgs ·{" "}
                    {formatDistanceToNow(chat.lastMessageAt, {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                {chat.pageUrl ? (
                  <div className="text-[11px] text-muted-foreground truncate max-w-md mt-0.5">
                    {chat.pageUrl}
                  </div>
                ) : null}
              </div>
              <div className="md:max-w-md w-full md:w-auto">
                <EngageComposer
                  visitorId={chat.id}
                  sessionId={chat.sessionId}
                  defaultPlaceholder={placeholder}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.length > 1 ? u.pathname : u.hostname;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Tab group — server-rendered, URL-driven
// ---------------------------------------------------------------------------

function TabGroup({
  legend,
  items,
}: {
  legend: string;
  items: Array<{ key: string; label: string; active: boolean; href: string }>;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground shrink-0">
        {legend}
      </span>
      <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href || "?"}
            scroll={false}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded transition-colors whitespace-nowrap font-medium",
              item.active
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed — server-side rendering moved to the new VisitorTable client
// component (components/portal/visitors/visitor-table.tsx) which adds
// multi-select + bulk CSV export. Legacy VisitorFeed / VisitorRow /
// Avatar code removed from this file; recover from git history if
// needed (this file's previous state on commit before the visitors UX
// overhaul has the original implementations).
// ---------------------------------------------------------------------------

function Pager({
  page,
  totalInView,
  selection,
}: {
  page: number;
  totalInView: number;
  selection: {
    window: WindowKey;
    status: StatusKey;
    sort: SortKey;
    page: number;
  };
}) {
  const shown = Math.min(page * PAGE_SIZE, totalInView);
  const hasMore = shown < totalInView;
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        Showing {shown} of {totalInView}
      </span>
      {hasMore ? (
        <Link
          href={`/portal/visitors${buildQuery(selection, { page: page + 1 })}`}
          className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyNoPixel() {
  return (
    <DataPlaceholder
      intent="connect"
      icon={<Radio className="h-4 w-4" />}
      title="Install the visitor pixel to see named visitors"
      body="Once the pixel is live, every resolved visitor appears in this feed in real time \u2014 name, company, job title, and the pages they viewed."
      action={{ label: "Install the pixel", href: "/portal/connect" }}
    />
  );
}

function EmptyNoVisitors() {
  return (
    <DataPlaceholder
      intent="waiting"
      icon={<Radio className="h-4 w-4" />}
      title="Pixel installed \u2014 waiting on first visitor events"
      body="The Cursive pixel resolves anonymous traffic to real names and emails in real time. Visitors will appear here within seconds of the next site visit."
      action={{ label: "Verify pixel install", href: "/portal/connect" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.length < 40 ? url : null;
  }
}
