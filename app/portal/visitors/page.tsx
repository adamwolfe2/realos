import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { Prisma, VisitorIdentificationStatus } from "@prisma/client";
import { ArrowUpRight, Flame, MapPin, Zap } from "lucide-react";
import {
  avatarPaletteFor,
  extractIdentity,
} from "@/lib/visitors/enrichment";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";

export const metadata: Metadata = { title: "Visitor feed" };
export const revalidate = 15;

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
  if (merged.status !== "identified") params.set("status", merged.status);
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
    "identified"
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

  const windowDef = WINDOWS.find((w) => w.key === windowKey)!;
  const since = windowDef.hours
    ? new Date(Date.now() - windowDef.hours * 60 * 60 * 1000)
    : null;

  const baseWhere: Prisma.VisitorWhereInput = {
    ...tenant,
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
    }),
    prisma.visitor.count({ where }),
    prisma.cursiveIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: {
        cursivePixelId: true,
        pixelScriptUrl: true,
        installedOnDomain: true,
        lastEventAt: true,
        totalEventsCount: true,
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

  const selection = { window: windowKey, status: statusKey, sort: sortKey, page };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitor feed"
        description="Real people visiting your site, identified by the pixel. Updates every 15 seconds."
        actions={
          hasPixel ? (
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
          ) : null
        }
      />

      {/* Filter controls */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
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

      {/* Empty / Feed */}
      {!hasPixel ? (
        <EmptyNoPixel />
      ) : noVisitorsAtAll ? (
        <EmptyNoVisitors />
      ) : visitors.length === 0 ? (
        <div className="border rounded-md p-8 text-sm opacity-70 text-center">
          No visitors match these filters. Try widening the time window or the
          status filter.
        </div>
      ) : (
        <>
          <VisitorFeed visitors={visitors} />
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
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] tracking-widest uppercase opacity-60 w-14 shrink-0">
        {legend}
      </span>
      <div className="flex gap-1 flex-wrap">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href || "?"}
            scroll={false}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md border transition-colors",
              item.active
                ? "bg-primary text-primary-foreground hover:bg-primary-dark transition-colors border-primary"
                : "bg-transparent border-border hover:bg-muted"
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
// Feed
// ---------------------------------------------------------------------------

function VisitorFeed({
  visitors,
}: {
  visitors: Array<
    Awaited<ReturnType<typeof prisma.visitor.findMany>>[number]
  >;
}) {
  return (
    <ul className="border rounded-md divide-y">
      {visitors.map((visitor) => (
        <li key={visitor.id}>
          <VisitorRow visitor={visitor} />
        </li>
      ))}
    </ul>
  );
}

function VisitorRow({
  visitor,
}: {
  visitor: Awaited<
    ReturnType<typeof prisma.visitor.findMany>
  >[number];
}) {
  const identity = extractIdentity(visitor);
  const seenAgo = formatDistanceToNow(visitor.lastSeenAt, { addSuffix: true });

  const intentTone =
    visitor.intentScore >= 80
      ? "text-red-600"
      : visitor.intentScore >= 60
      ? "text-orange-500"
      : "opacity-70";

  const statusBadge = (() => {
    switch (visitor.status) {
      case VisitorIdentificationStatus.MATCHED_TO_LEAD:
        return { label: "Lead", dot: "bg-emerald-500", text: "text-emerald-700" };
      case VisitorIdentificationStatus.IDENTIFIED:
      case VisitorIdentificationStatus.ENRICHED:
        return { label: "Identified", dot: "bg-blue-500", text: "text-blue-700" };
      case VisitorIdentificationStatus.ANONYMOUS:
      default:
        return { label: "Anonymous", dot: "bg-neutral-400", text: "opacity-70" };
    }
  })();

  const subtitle = (() => {
    if (identity.isAnonymous) {
      const ref = visitor.referrer ? hostFromUrl(visitor.referrer) : null;
      return ref ? `Anonymous \u00b7 via ${ref}` : "Anonymous visitor";
    }
    const parts: string[] = [];
    if (identity.jobTitle) parts.push(identity.jobTitle);
    if (identity.companyName) {
      parts.push(
        parts.length > 0 ? `at ${identity.companyName}` : identity.companyName
      );
    }
    return parts.join(" ") || visitor.email || "";
  })();

  return (
    <Link
      href={`/portal/visitors/${visitor.id}`}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      {/* Avatar */}
      <Avatar identity={identity} visitorId={visitor.id} />

      {/* Identity */}
      <div className="min-w-0">
        <div className="font-medium truncate">{identity.displayName}</div>
        <div className="text-[12px] opacity-70 truncate">{subtitle}</div>
      </div>

      {/* Context (page + session) — hidden on mobile */}
      <div className="hidden md:block min-w-0 text-xs">
        <div className="truncate opacity-80">
          {identity.lastPagePath ?? "No page tracked"}
        </div>
        <div className="opacity-60 mt-0.5">
          {visitor.sessionCount} {visitor.sessionCount === 1 ? "session" : "sessions"}
          {" \u00b7 "}
          {seenAgo}
        </div>
      </div>

      {/* Location — hidden on mobile */}
      <div className="hidden md:flex text-xs opacity-70 min-w-0 items-center gap-1">
        {identity.location ? (
          <>
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{identity.location}</span>
          </>
        ) : null}
      </div>

      {/* Intent + status */}
      <div className="flex items-center gap-3 justify-end">
        <div className="text-right">
          <div
            className={cn(
              "text-lg font-semibold tracking-tight tabular-nums flex items-center gap-1 justify-end",
              intentTone
            )}
          >
            {visitor.intentScore >= 80 ? (
              <Flame className="h-4 w-4" />
            ) : visitor.intentScore >= 60 ? (
              <Zap className="h-3.5 w-3.5" />
            ) : null}
            {visitor.intentScore}
          </div>
          <div
            className={cn(
              "text-[10px] flex items-center gap-1 justify-end mt-0.5",
              statusBadge.text
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", statusBadge.dot)} />
            {statusBadge.label}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
      </div>
    </Link>
  );
}

function Avatar({
  identity,
  visitorId,
}: {
  identity: ReturnType<typeof extractIdentity>;
  visitorId: string;
}) {
  const palette = avatarPaletteFor(
    identity.companyDomain ?? identity.displayName ?? visitorId
  );
  if (identity.logoUrl) {
    return (
      <div className="h-10 w-10 rounded-full border overflow-hidden bg-white flex items-center justify-center shrink-0">
        <Image
          src={identity.logoUrl}
          alt={identity.companyName ?? ""}
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
        palette
      )}
    >
      {identity.initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pager
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
    <div className="flex items-center justify-between text-xs opacity-70">
      <span>
        Showing {shown} of {totalInView}
      </span>
      {hasMore ? (
        <Link
          href={`/portal/visitors${buildQuery(selection, { page: page + 1 })}`}
          className="px-3 py-1.5 border rounded-md hover:bg-muted"
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
    <div className="border rounded-md p-8 text-center space-y-3">
      <div className="text-sm font-semibold">
        Install the Cursive pixel to see named website visitors here.
      </div>
      <p className="text-sm opacity-70 max-w-md mx-auto">
        Once the pixel is live, every resolved visitor appears in this feed in
        real time \u2014 name, company, job title, and the pages they viewed.
      </p>
      <Link
        href="/portal/settings/integrations"
        className="inline-block text-xs px-3 py-2 border rounded-md hover:bg-muted"
      >
        Go to integrations
      </Link>
    </div>
  );
}

function EmptyNoVisitors() {
  return (
    <div className="border rounded-md p-8 text-center space-y-2">
      <div className="text-sm font-semibold">No visitors yet.</div>
      <p className="text-sm opacity-70 max-w-md mx-auto">
        Once someone visits your site, they&apos;ll appear here in real time.
      </p>
    </div>
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
