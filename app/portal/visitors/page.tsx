import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  marketableScopedPropertyClause,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { Prisma, VisitorIdentificationStatus } from "@prisma/client";
import { extractIdentity } from "@/lib/visitors/enrichment";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { ExportButton } from "@/components/ui/export-button";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { EngageComposer } from "./engage-composer";
import { PixelSyncButton } from "@/components/portal/sync/pixel-sync-button";
import { AutoRefresh } from "@/components/portal/sync/auto-refresh";
import {
  VisitorTable,
  type VisitorRow,
} from "@/components/portal/visitors/visitor-table";
import { DataPlaceholder } from "@/components/portal/ui/data-placeholder";
import {
  StatusChip,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";
import { Radio, UserCheck, Mail, Users } from "lucide-react";
import { parseTimeWindow, timeWindowGte, type TimeWindow } from "@/lib/recency";

export const metadata: Metadata = { title: "Visitor feed" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Bug #125/#127: window selection now routes through `lib/recency.ts`
// (parseTimeWindow + timeWindowGte) so the URL string, the prisma `gte`
// cutoff, and the active-tab highlight can never drift out of sync. 90d
// is exposed as a fourth tab so customers running longer attribution
// cycles don't have to drop straight to "All" and pull every historical
// record.
type WindowKey = TimeWindow;
type StatusKey = "all" | "identified" | "hot" | "with_lead";
type SortKey = "recent" | "intent";

const WINDOWS: Array<{ key: WindowKey; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "all", label: "All" },
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
  fallback: T,
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
  }>,
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
  // Bug #125: parseTimeWindow centralizes the whitelist + fallback so the
  // toggle is guaranteed to actually filter — the previous Norman bug was
  // that lastSeenAt was overwritten by the segment-sync cron, so even when
  // the where-clause changed the rows looked identical. Now both the
  // where-clause and the orderBy below feed off this single parsed value.
  const windowKey = parseTimeWindow(params.window, "7d");
  const statusKey = readParam<StatusKey>(
    params,
    "status",
    ["all", "identified", "hot", "with_lead"],
    "all",
  );
  const sortKey = readParam<SortKey>(
    params,
    "sort",
    ["recent", "intent"],
    "recent",
  );
  const page = parsePage(params.page);

  const scope = await requireScope();
  const tenant = tenantWhere<{ orgId?: string }>(scope);
  const propertyIds = await parsePropertyFilter(params, scope.orgId);

  // Pixel install CTAs route through the canonical Connect hub. The hub is
  // property-aware (connect-hub.tsx resolveConnectUrl) and deep-links the
  // Cursive pixel setup with the active property pre-selected, so the old
  // settings/integrations deep-link — and the bounce-loop it worked around —
  // is no longer needed.
  const pixelSetupHref = "/portal/connect";

  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const properties = visibleProperties(scope, allProperties);

  const windowDef = WINDOWS.find((w) => w.key === windowKey)!;
  // Bug #125: cutoff date now derives from the shared lib/recency.ts
  // helper. Same value powers the prisma where-clause (below) AND the
  // KPI tile hint copy, so the operator sees consistent framing across
  // every surface that observes the window.
  const since = timeWindowGte(windowKey);

  // 2026-05-30 (Norman bug, #14 + #3 from his Thursday batch): the
  // window filter previously gated on `lastSeenAt: { gte: since }`.
  // The segment-sync cron overwrites lastSeenAt on every fire (every
  // ~15 min for active orgs) so every visitor's lastSeenAt is
  // effectively "less than a minute ago" — toggling 24h/7d/30d
  // returned the same set regardless of window choice.
  //
  // Filtering on `firstSeenAt` instead is honest and respects the
  // operator's intent: when they ask for "visitors in the last 24h",
  // they want visitors first identified in that window, not visitors
  // whose lastSeenAt was last-touched by an unrelated sync job.
  //
  // Real fix is upstream in the segment-sync writer (only update
  // lastSeenAt when there's a genuinely new event); until that lands,
  // firstSeenAt is the trustworthy field.
  // Pixel visitors are org-level (propertyId=null) — the Cursive pixel is
  // installed on the org's resident domain, not per property. Use the
  // org-level-inclusive fragment so selecting a property in the switcher
  // doesn't hide every visitor.
  const baseWhere: Prisma.VisitorWhereInput = {
    ...tenant,
    // Default (no selection) scopes to enabled properties; org-level pixel
    // visitors (propertyId=null) stay visible in both modes.
    ...(await marketableScopedPropertyClause(scope, propertyIds, "propertyId", {
      selectedIncludesOrgRows: true,
      defaultIncludesOrgRows: true,
    })),
    ...(since ? { firstSeenAt: { gte: since } } : {}),
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

  // Bug #127: enforced DESC by firstSeenAt at the prisma level so the top
  // of the list is genuinely the newest identification — no post-fetch
  // resort can drift between paginations. Norman bug (May 30): orderBy
  // uses firstSeenAt to match the time-filter semantic. Sorting by
  // lastSeenAt was misleading — the segment-sync cron stamps lastSeenAt
  // on every fire so every row looked "just-seen" regardless of when
  // they actually arrived. For "recent" sort, "newest first-seen" is
  // what users mean.
  const orderBy: Prisma.VisitorOrderByWithRelationInput[] =
    sortKey === "intent"
      ? [{ intentScore: "desc" }, { firstSeenAt: "desc" }]
      : [{ firstSeenAt: "desc" }];

  // Live-chat windows. Live window = "active in last 5 minutes".
  const LIVE_WINDOW_MS = 5 * 60 * 1000;
  const liveSince = new Date(Date.now() - LIVE_WINDOW_MS);

  const [
    visitors,
    totalInView,
    integration,
    summary,
    liveChats,
    totalEverCount,
  ] = await Promise.all([
    prisma.visitor.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      // Norman bug (May 22): the list previously omitted `enrichedData`
      // for payload-size reasons, which caused EVERY row to render "—"
      // for LAST PAGE and LOCATION. The "10-50KB per row" concern in
      // the prior comment was speculative — actual TC payloads measure
      // ~600 bytes per visitor (segment-sync enrichment is small) so
      // 50 rows = ~30KB which is well within budget. Re-included
      // enrichedData so the table can pull city/state and REFERRER_URL
      // through extractIdentity. We still drop pagesViewed (NULL for
      // every segment-sync'd visitor anyway — only set by the
      // first-party JS pixel which TC doesn't use).
      //
      // firstSeenAt is also selected now — Norman's screenshot showed
      // ALL 146 rows as "less than a minute ago" because lastSeenAt
      // is overwritten every time the segment-sync cron fires. Until
      // the upstream fix lands (only update lastSeenAt when there's a
      // genuinely new event), the table falls back to firstSeenAt for
      // display so the timestamps tell the real story of when the
      // visitor was actually first identified.
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        sessionCount: true,
        lastSeenAt: true,
        firstSeenAt: true,
        enrichedData: true,
      },
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
    // Live chats — any chatbot conversation with activity in the last 5
    // minutes. Hoisted into the main Promise.all so it runs in parallel
    // with the visitor list query instead of a sequential await below.
    prisma.chatbotConversation
      .findMany({
        where: {
          ...tenant,
          lastMessageAt: { gte: liveSince },
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
      .catch(() => [] as never[]),
    // Cheap "do we have ANY visitors ever?" count — drives empty state
    // selection. Hoisted into the parallel fan-out; we only use the
    // value when totalInView === 0 so the count is effectively a no-op
    // for the common case.
    prisma.visitor.count({ where: tenant as Prisma.VisitorWhereInput }),
  ]);

  const hasPixel = Boolean(integration?.cursivePixelId);
  const noVisitorsAtAll = totalInView === 0 && totalEverCount === 0;

  // Most-recent chatbot conversation per visitor lookup. Lets each visitor
  // row surface an Engage button if that visitor (matched by visitorHash) has
  // had a chat in the live window. We can only run this AFTER the visitor
  // page query above resolves because we need their IDs, but the heavy main
  // queries (live chats, summary, etc.) are already done in parallel.
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
          lastMessageAt: { gte: liveSince },
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

  const selection = {
    window: windowKey,
    status: statusKey,
    sort: sortKey,
    page,
  };

  return (
    <div className="space-y-3 ls-page-fade">
      {/* Norman bug (May 22): page felt "stuck" because operators had
          to manually refresh OR click Sync now to see new visitors.
          Background context — there are actually THREE layers running:
          (1) pixel-segment-sync cron pulls AL every 5 min,
          (2) this AutoRefresh re-reads our DB every 60s so cron
              updates surface without a manual reload,
          (3) the Sync now button forces an immediate AL pull when an
              operator can't wait for the cron.
          60s is a calm cadence — slow enough not to flash, fast enough
          that returning from another tab shows fresh data. The page
          copy below names all three so there's no "which one is it?"
          confusion from bug #90. */}
      <AutoRefresh intervalMs={60_000} />
      <PageHeader
        title="Visitor feed"
        description="Real people who visited your site, resolved to a name + email via the Cursive identity graph. Every row is outreach-ready. New identifications land every ~5 minutes; this list refreshes every 60 seconds. Click Sync now to pull fresh data immediately."
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <Suspense
              fallback={
                <div className="h-9 w-64 animate-pulse bg-neutral-100 rounded" />
              }
            >
              <PropertyMultiSelect
                properties={properties}
                orgId={scope.orgId}
              />
            </Suspense>
            {hasPixel ? (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                {/* Real-time freshness chip — live (green) when an event
                    landed in the last 5 minutes (webhook path is healthy),
                    stale (amber) 5-30 min (probably segment-cron only),
                    error (red) when stale > 30 min OR never (webhook URL
                    likely not pasted into the AL pixel config). Lets the
                    operator see at-a-glance whether to chase up wiring.
                    Canonical StatusChip — see components/portal/ui/status-chip.tsx. */}
                {(() => {
                  const last = integration?.lastEventAt
                    ? new Date(integration.lastEventAt).getTime()
                    : 0;
                  const ageMin = last ? (Date.now() - last) / 60_000 : Infinity;
                  const status: ConnectionStatus =
                    ageMin <= 5 ? "live" : ageMin <= 30 ? "stale" : "error";
                  const label =
                    ageMin <= 5
                      ? "Webhook live"
                      : ageMin <= 30
                        ? "Cron only"
                        : "Stale";
                  return (
                    <span
                      title={`${label} — last event ${
                        integration?.lastEventAt
                          ? formatDistanceToNow(integration.lastEventAt, {
                              addSuffix: true,
                            })
                          : "never"
                      }`}
                    >
                      <StatusChip status={status} label={label} />
                    </span>
                  );
                })()}
                Pixel on{" "}
                <span className="font-medium text-foreground">
                  {integration?.installedOnDomain ?? "unknown host"}
                </span>
                {integration?.lastEventAt
                  ? ` · last event ${formatDistanceToNow(
                      integration.lastEventAt,
                      { addSuffix: true },
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
            <ExportButton
              href="/api/tenant/visitors/export"
              label="Export CSV (hashed emails)"
            />
          </div>
        }
      />

      {/* Filter controls — single inline row. Window / Status / Sort sit
          side-by-side instead of stacking, with each group flowing to the
          next line only when the viewport actually runs out of width. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card px-3 py-2.5">
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

      {/* Summary strip — promoted from the legacy 3-column StatCard
          layout to the 4-tile KpiTile pattern that anchors every other
          surface (dashboard, leads). Adds a "Total visits" baseline tile
          so the identification ratio reads at a glance: total -> identified
          -> with email -> matched. Each KpiTile gets the brand-blue chip
          icon, sparkline-ready shape, and unified empty-state behavior so
          the page stops feeling like a sidebar metric column. */}
      <section
        aria-label="Visitor pipeline at a glance"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 ls-stagger"
      >
        <KpiTile
          label="Total visits"
          value={totalInView.toLocaleString()}
          hint={
            windowDef.label === "All" ? "All time" : `Last ${windowDef.label}`
          }
          icon={<Radio className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Identified"
          value={summary.identified.toLocaleString()}
          hint={
            totalInView > 0
              ? `${Math.round((summary.identified / totalInView) * 100)}% of visits`
              : "Pixel firing"
          }
          icon={<UserCheck className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="With email"
          value={summary.withEmail.toLocaleString()}
          hint="Captured or resolved"
          icon={<Mail className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Matched to a lead"
          value={summary.withLead.toLocaleString()}
          hint="In your pipeline"
          icon={<Users className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Pixel staleness banner removed per UX feedback — the new
          PixelSyncButton in the page header surfaces last-event freshness
          and offers a one-click resync, so the redundant warning panel
          was just noise. */}

      {/* Live chats — operator can engage active chatbot conversations */}
      {liveChats.length > 0 ? <LiveChatsPanel chats={liveChats} /> : null}

      {/* Empty / Feed */}
      {!hasPixel ? (
        <EmptyNoPixel setupHref={pixelSetupHref} />
      ) : noVisitorsAtAll ? (
        <EmptyNoVisitors setupHref={pixelSetupHref} />
      ) : visitors.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground text-center">
          No visitors match these filters. Try widening the time window or the
          status filter.
        </div>
      ) : (
        <>
          <VisitorTable
            rows={visitors.map<VisitorRow>((v) => {
              const id = extractIdentity(v);
              // Pick the most-honest "when did we see this person" timestamp.
              // Cursive's segment-sync rewrites lastSeenAt to NOW on every
              // refresh (the sync upserts and bumps the row), which made
              // every visitor appear "less than a minute ago" — useless.
              // firstSeenAt only changes when the visitor is genuinely new,
              // so it's the better signal here until the upstream sync is
              // fixed to only bump lastSeenAt on real new events.
              const displayAt =
                v.firstSeenAt && v.firstSeenAt < v.lastSeenAt
                  ? v.firstSeenAt
                  : v.lastSeenAt;
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
                lastSeenAtIso: displayAt.toISOString(),
                liveChat: visitorChatMap.has(v.id),
              };
            })}
          />
          <Pager page={page} totalInView={totalInView} selection={selection} />
        </>
      )}
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
    <section className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Live
            </span>
          </div>
          <h2 className="text-sm font-semibold tracking-tight">
            Active conversations
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
    <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
      <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground shrink-0">
        {legend}
      </span>
      <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5 overflow-x-auto max-w-full">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href || "?"}
            scroll={false}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium",
              item.active
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
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

function EmptyNoPixel({ setupHref }: { setupHref: string }) {
  return (
    <DataPlaceholder
      intent="connect"
      icon={<Radio className="h-4 w-4" />}
      title="Install the visitor pixel to see named visitors"
      body="Once the pixel is live, every resolved visitor appears in this feed in real time \u2014 name, company, job title, and the pages they viewed."
      action={{ label: "Install the pixel", href: setupHref }}
    />
  );
}

function EmptyNoVisitors({ setupHref }: { setupHref: string }) {
  return (
    <DataPlaceholder
      intent="waiting"
      icon={<Radio className="h-4 w-4" />}
      title="Pixel installed \u2014 waiting on first visitor events"
      body="The Cursive pixel resolves anonymous traffic to real names and emails in real time. Visitors will appear here within seconds of the next site visit."
      action={{ label: "Verify pixel install", href: setupHref }}
    />
  );
}
