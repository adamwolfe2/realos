import * as React from "react";
import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  TrendingUp,
  BarChart3,
  MousePointerClick,
  Target,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  isAccessDenied,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { SeoProvider } from "@prisma/client";
import {
  ConnectSeoForm,
  DisconnectSeoForm,
} from "./seo-connect-forms";
import { StaleOnLoadTrigger } from "@/components/portal/sync/stale-on-load-trigger";
import { SeoOverviewClient } from "./seo-overview-client";
import type { KpiDelta } from "./seo-kpi-card";
import type { SeoAnnotation } from "./seo-annotations-panel";
import type { RankedRow } from "./seo-queries-pages-tables";
import type { TimeseriesPoint } from "./seo-timeseries-chart";

export const metadata: Metadata = { title: "SEO" };
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Delta builders. Returns the pre-formatted label + a "positive" boolean
// that drives tone. We've collapsed up/down/flat to a single positive flag
// because the brand rules forbid green/red — positive uses `text-primary`,
// everything else uses `text-muted-foreground`. The hero KPI cards consume
// this directly so there's no per-call branching at the render site.
// ---------------------------------------------------------------------------

function buildDelta(current: number, prior: number): KpiDelta {
  if (prior === 0 && current === 0) return { label: "—", positive: false };
  if (prior === 0) return { label: "new", positive: true };
  const pct = ((current - prior) / prior) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    label: `${sign}${pct.toFixed(0)}%`,
    positive: pct > 1,
  };
}

// Position is "lower is better" — improving means the number drops. Flip the
// positive flag so a -0.4 reads as primary tone, not muted.
function buildPositionDelta(current: number, prior: number): KpiDelta {
  if (prior === 0 && current === 0) return { label: "—", positive: false };
  if (prior === 0) return { label: "new", positive: true };
  const delta = current - prior;
  const sign = delta >= 0 ? "+" : "";
  return {
    label: `${sign}${delta.toFixed(1)}`,
    positive: delta < -0.2,
  };
}

// ---------------------------------------------------------------------------
// Build a continuous daily series of length `days`. SeoSnapshot rows are
// not guaranteed to be present for every calendar day (a sync that hits a
// zero-traffic day skips writing). Pad missing days with zeros so the
// sparkline + chart x-axis read continuously rather than skipping forward.
// ---------------------------------------------------------------------------

type DailyAggregate = {
  clicks: number;
  impressions: number;
  ctr: number;        // 0-1
  position: number;   // GSC position, lower better
};

function buildDailySeries(
  rows: Array<{
    date: Date;
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  }>,
  endDay: Date,
  days: number,
): Array<DailyAggregate & { date: string }> {
  // Aggregate by date key (multiple snapshots per day can exist when an org
  // has more than one connected property, even though right now the schema
  // is single-row-per-day; defensive sum keeps us future-safe).
  const byKey = new Map<string, DailyAggregate>();
  for (const r of rows) {
    const key = startOfUtcDay(r.date).toISOString().slice(0, 10);
    const prev = byKey.get(key);
    if (prev) {
      prev.clicks += r.totalClicks;
      prev.impressions += r.totalImpressions;
      // For CTR + position we keep the last non-zero value rather than
      // averaging — they're already daily aggregates upstream so summing
      // would be wrong.
      if (r.avgCtr > 0) prev.ctr = r.avgCtr;
      if (r.avgPosition > 0) prev.position = r.avgPosition;
    } else {
      byKey.set(key, {
        clicks: r.totalClicks,
        impressions: r.totalImpressions,
        ctr: r.avgCtr,
        position: r.avgPosition,
      });
    }
  }
  const out: Array<DailyAggregate & { date: string }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfUtcDay(new Date(endDay.getTime() - i * DAY_MS));
    const key = day.toISOString().slice(0, 10);
    const v = byKey.get(key);
    out.push({
      date: key,
      clicks: v?.clicks ?? 0,
      impressions: v?.impressions ?? 0,
      ctr: v?.ctr ?? 0,
      position: v?.position ?? 0,
    });
  }
  return out;
}

// Sum / average a daily aggregate window into the totals used by the hero KPI
// cards. CTR is recomputed from clicks/impressions instead of averaging the
// per-day field — that mathematically matches what GSC reports for a range.
// Position is weighted by impressions for the same reason.
function totalize(series: Array<DailyAggregate>): {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
} {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  let positionImpressions = 0;
  for (const d of series) {
    clicks += d.clicks;
    impressions += d.impressions;
    if (d.position > 0) {
      weightedPosition += d.position * d.impressions;
      positionImpressions += d.impressions;
    }
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: positionImpressions > 0 ? weightedPosition / positionImpressions : 0,
  };
}

export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; properties?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const requestedIds = await parsePropertyFilter(sp, scope.orgId);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);

  // SeoSnapshot/SeoQuery/SeoLandingPage are still org-level today (no
  // propertyId column). If the user is property-restricted, hide the
  // aggregate trend sections to avoid leaking org-wide data through them.
  // Per-property integration cards remain visible because the
  // SeoIntegration model itself is propertyId-aware.
  const isRestricted = scope.allowedPropertyIds !== null;

  // Only count rows backed by a real Google service-account JSON. Seeded
  // demo rows store the literal "DEMO_SEED" — surfacing those as
  // "connected" would mislead operators.
  const integrations = await prisma.seoIntegration.findMany({
    where: {
      orgId: scope.orgId,
      serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
      ...(effectiveIds && effectiveIds.length > 0
        ? { propertyId: { in: effectiveIds } }
        : isRestricted
          ? { propertyId: { in: scope.allowedPropertyIds! } }
          : {}),
    },
    orderBy: { provider: "asc" },
  });

  const gscIntegration = integrations.find((i) => i.provider === SeoProvider.GSC);
  const ga4Integration = integrations.find((i) => i.provider === SeoProvider.GA4);
  const hasAny = integrations.length > 0;

  // When the operator arrives from a property's setup checklist
  // (?propertyId=...), pre-select that property in the connect form so GA4/GSC
  // lands on the right building without re-picking. Uses the page-level
  // `properties` list (RBAC-filtered, defined below) for the selector.
  const defaultSeoPropertyId =
    requestedIds && requestedIds.length === 1 ? requestedIds[0] : null;

  // Drive an on-load sync when the freshest integration is older than 30
  // minutes. StaleOnLoadTrigger dedupes per-tab + cools down 60s so a user
  // clicking around won't flood the worker.
  const newestSyncAt = integrations
    .map((i) => i.lastSyncAt?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);
  const STALE_AFTER_MS = 30 * 60 * 1000;
  const shouldAutoRefresh =
    hasAny && Date.now() - newestSyncAt > STALE_AFTER_MS;

  // ── Date windows for the overview ────────────────────────────────────
  //   * Hero KPIs: last 30 days vs prior 30 days.
  //   * Sparklines: the same 30-day current window.
  //   * Time-series chart: last 365 days for the long view.
  const now = new Date();
  const yesterday = startOfUtcDay(new Date(now.getTime() - DAY_MS));
  const start30 = startOfUtcDay(new Date(yesterday.getTime() - 29 * DAY_MS));
  const startPrior = startOfUtcDay(new Date(start30.getTime() - 30 * DAY_MS));
  const endPrior = new Date(start30.getTime() - DAY_MS);
  const start365 = startOfUtcDay(new Date(yesterday.getTime() - 364 * DAY_MS));

  // Property list for the selector dropdown, gated to user's allowed set.
  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const properties = visibleProperties(scope, allProperties);

  // If there's no integration at all, skip every snapshot/query fetch and
  // render the empty hero immediately.
  if (!hasAny) {
    return (
      <SeoEmptyShell
        accessDenied={accessDenied}
        properties={properties}
        defaultPropertyId={defaultSeoPropertyId}
        orgId={scope.orgId}
      />
    );
  }

  // Restricted users can't see org-aggregate data until SeoSnapshot gains a
  // propertyId column. Render their existing "coming soon" branch.
  if (isRestricted) {
    return (
      <SeoRestrictedShell
        accessDenied={accessDenied}
        properties={properties}
        orgId={scope.orgId}
        shouldAutoRefresh={shouldAutoRefresh}
      />
    );
  }

  // ── Fetch the overview data set ──────────────────────────────────────
  // One round-trip for everything we need: 365d series, recent queries,
  // recent pages, and the action-recommendation annotation feed.
  const [snapshots365, topQueriesRaw, topPagesRaw, annotationRows] =
    await Promise.all([
      prisma.seoSnapshot.findMany({
        where: { orgId: scope.orgId, date: { gte: start365, lte: yesterday } },
        orderBy: { date: "asc" },
        select: {
          date: true,
          totalClicks: true,
          totalImpressions: true,
          avgCtr: true,
          avgPosition: true,
        },
      }),
      prisma.seoQuery.groupBy({
        by: ["query"],
        where: { orgId: scope.orgId, date: { gte: start30, lte: yesterday } },
        _sum: { clicks: true, impressions: true },
        orderBy: { _sum: { clicks: "desc" } },
        take: 12,
      }),
      prisma.seoLandingPage.groupBy({
        by: ["url"],
        where: { orgId: scope.orgId, date: { gte: start30, lte: yesterday } },
        _sum: { sessions: true, users: true },
        orderBy: { _sum: { sessions: "desc" } },
        take: 12,
      }),
      prisma.seoActionRecommendation.findMany({
        where: {
          ...tenantWhere(scope),
          severity: { in: ["HIGH", "CRITICAL"] },
        },
        orderBy: { generatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          severity: true,
          generatedAt: true,
        },
      }),
    ]);

  // Build a 365d continuous series (zero-pad missing days) so both the
  // chart and the 30d sparklines below derive from the same source.
  const series365 = buildDailySeries(snapshots365, yesterday, 365);
  const series30 = series365.slice(-30);
  const seriesPrior30 = series365.slice(-60, -30);

  const totals30 = totalize(series30);
  const totalsPrior = totalize(seriesPrior30);

  // Extract per-metric sparkline arrays (last 30 daily values) for the KPI
  // cards. Position has zero-days dropped before being passed so the
  // sparkline only reflects days we actually have data.
  const sparkClicks      = series30.map((d) => d.clicks);
  const sparkImpressions = series30.map((d) => d.impressions);
  const sparkCtr         = series30.map((d) => d.ctr);
  const sparkPosition    = series30.map((d) => (d.position > 0 ? d.position : 0));

  const timeseries: TimeseriesPoint[] = series365.map((d) => ({
    date: d.date,
    clicks: d.clicks,
    impressions: d.impressions,
  }));

  const topQueries: RankedRow[] = topQueriesRaw.map((q) => ({
    label: q.query,
    clicks: q._sum.clicks ?? 0,
    impressions: q._sum.impressions ?? 0,
  }));

  const topPages: RankedRow[] = topPagesRaw.map((p) => ({
    label: p.url,
    // SeoLandingPage tracks sessions, not clicks — but the overview table
    // only has one numeric column, so we surface sessions as the right-rail
    // count. The header label remains "Pages" which is honest.
    clicks: p._sum.sessions ?? 0,
  }));

  const annotations: SeoAnnotation[] = annotationRows.map((a) => ({
    id: a.id,
    title: a.title,
    date: a.generatedAt.toISOString(),
    severity: a.severity,
  }));

  // Source chip: GSC always shown as "Google Search Console". The
  // sub-label uses the integration's property identifier (e.g.
  // "sc-domain:telegraphcommons.com") so operators can confirm the data
  // source matches what they expect.
  const sourceLabel = "Google Search Console";
  const propertyLabel = gscIntegration?.propertyIdentifier ?? null;
  const rangeLabel = "Last 30 days vs prior 30 days";

  return (
    <div className="space-y-3">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      {shouldAutoRefresh ? (
        <StaleOnLoadTrigger
          endpoint="/api/tenant/seo/sync"
          dedupeKey={`seo:${scope.orgId}`}
          cooldownMs={60_000}
          refreshAfterMs={3000}
        />
      ) : null}

      <PageHeader
        title="SEO"
        description="Organic search performance from Google Search Console. Hero metrics compare the last 30 days against the prior 30. The chart shows the full year so seasonality reads at a glance."
        actions={
          properties.length > 1 ? (
            <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
          ) : null
        }
      />

      {/* Agent discoverability banner — keep the affordance to jump into
          the recommendations / live SERP / Lighthouse workspace where the
          actionable work happens. */}
      <a
        href="/portal/seo/agent"
        className="block rounded-xl border border-primary/30 bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-transparent px-4 py-3 hover:border-primary/50 transition-colors group"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
              SEO Agent
            </p>
            <p className="text-[13px] font-medium text-foreground">
              Open the recommendations workspace
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Live SERP rankings, Lighthouse audits, AI recommendations, and the content drafter all in one screen.
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-mono text-primary group-hover:translate-x-0.5 transition-transform">
            Open →
          </span>
        </div>
      </a>

      <SeoOverviewClient
        source={sourceLabel}
        propertyLabel={propertyLabel}
        rangeLabel={rangeLabel}
        kpis={{
          clicks: {
            value: totals30.clicks,
            delta: buildDelta(totals30.clicks, totalsPrior.clicks),
            spark: sparkClicks,
          },
          impressions: {
            value: totals30.impressions,
            delta: buildDelta(totals30.impressions, totalsPrior.impressions),
            spark: sparkImpressions,
          },
          ctr: {
            value: totals30.ctr,
            delta: buildDelta(totals30.ctr * 10000, totalsPrior.ctr * 10000),
            spark: sparkCtr,
          },
          position: {
            value: totals30.position,
            delta: buildPositionDelta(totals30.position, totalsPrior.position),
            spark: sparkPosition,
          },
        }}
        timeseries={timeseries}
        annotations={annotations}
        topQueries={topQueries}
        topPages={topPages}
      />

      <SectionCard label="Connected sources">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ProviderManageCard
            title="Google Search Console"
            provider="GSC"
            connected={!!gscIntegration}
            propertyIdentifier={gscIntegration?.propertyIdentifier ?? null}
            serviceAccountEmail={gscIntegration?.serviceAccountEmail ?? null}
            lastSyncAt={gscIntegration?.lastSyncAt ?? null}
            lastSyncError={gscIntegration?.lastSyncError ?? null}
            status={gscIntegration?.status ?? null}
          />
          <ProviderManageCard
            title="Google Analytics 4"
            provider="GA4"
            connected={!!ga4Integration}
            propertyIdentifier={ga4Integration?.propertyIdentifier ?? null}
            serviceAccountEmail={ga4Integration?.serviceAccountEmail ?? null}
            lastSyncAt={ga4Integration?.lastSyncAt ?? null}
            lastSyncError={ga4Integration?.lastSyncError ?? null}
            status={ga4Integration?.status ?? null}
          />
        </div>
        <SetupHelp />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SeoEmptyShell — rendered when no integration exists. Surface the value
// prop, then the connect forms. Keeps the original hero design so the
// rebuild doesn't regress the empty-state polish.
// ---------------------------------------------------------------------------
function SeoEmptyShell({
  accessDenied,
  properties,
  defaultPropertyId,
  orgId,
}: {
  accessDenied: boolean;
  properties: Array<{ id: string; name: string }>;
  defaultPropertyId?: string | null;
  orgId: string;
}) {
  return (
    <div className="space-y-3">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      <PageHeader
        title="SEO"
        description="Organic search performance from Google Search Console and Google Analytics 4."
        actions={
          properties.length > 1 ? (
            <PropertyMultiSelect properties={properties} orgId={orgId} />
          ) : null
        }
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-9 flex flex-col items-center text-center border-b border-border bg-gradient-to-b from-primary/[0.04] to-transparent">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            Your SEO command center
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground max-w-sm leading-relaxed">
            Connect Google Search Console and Analytics 4. See exactly which
            queries bring renters to your site — the same data agencies
            charge thousands a month to report.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <SeoValueProp
            icon={<MousePointerClick className="h-4 w-4" />}
            label="Clicks & impressions"
            description="30 days of search performance at a glance — daily trends and period-over-period deltas."
          />
          <SeoValueProp
            icon={<Search className="h-4 w-4" />}
            label="Top organic queries"
            description="See the exact terms driving visits. Sort by clicks, impressions, or CTR to find quick wins."
          />
          <SeoValueProp
            icon={<Target className="h-4 w-4" />}
            label="Position tracking"
            description="Know where you rank and which page-1 fringe queries are one push away from more clicks."
          />
        </div>
      </div>

      <SectionCard
        label="Connect your data sources"
        description="Both providers use the same paste-the-JSON flow and never require OAuth. Setup takes under 5 minutes."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Google Search Console
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Queries · Impressions · CTR · Position
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                <TrendingUp className="h-2.5 w-2.5" />
                Recommended
              </span>
            </div>
            <ConnectSeoForm provider="GSC" properties={properties} defaultPropertyId={defaultPropertyId} />
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Google Analytics 4
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Organic sessions · Users · Top pages
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                <BarChart3 className="h-2.5 w-2.5" />
                Optional
              </span>
            </div>
            <ConnectSeoForm provider="GA4" properties={properties} defaultPropertyId={defaultPropertyId} />
          </div>
        </div>
        <SetupHelp />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SeoRestrictedShell — property-restricted users get the integration cards
// (which respect their property scope) plus an explainer that the
// aggregate trend tables aren't yet partitioned per property.
// ---------------------------------------------------------------------------
function SeoRestrictedShell({
  accessDenied,
  properties,
  orgId,
  shouldAutoRefresh,
}: {
  accessDenied: boolean;
  properties: Array<{ id: string; name: string }>;
  orgId: string;
  shouldAutoRefresh: boolean;
}) {
  return (
    <div className="space-y-3">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      {shouldAutoRefresh ? (
        <StaleOnLoadTrigger
          endpoint="/api/tenant/seo/sync"
          dedupeKey={`seo:${orgId}`}
          cooldownMs={60_000}
          refreshAfterMs={3000}
        />
      ) : null}
      <PageHeader
        title="SEO"
        description="Per-property SEO performance is being rolled out. Your integration cards below show connection status."
        actions={
          properties.length > 1 ? (
            <PropertyMultiSelect properties={properties} orgId={orgId} />
          ) : null
        }
      />
      <SectionCard
        label="Organic search performance"
        description="Per-property trend data is coming soon. Your integration cards above show connection status; cross-property comparison requires the agency-wide view."
      >
        <p className="text-sm text-muted-foreground">
          Sessions, impressions, clicks, top queries, and top pages are
          tracked at the organization level today. Once we partition the
          SEO snapshot tables by property, this view will narrow to just
          your scope.
        </p>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProviderManageCard — bottom-of-page "Connected sources" detail card.
// Unchanged from the previous design except it lives outside the main
// branch now (callers always render it).
// ---------------------------------------------------------------------------
function ProviderManageCard({
  title,
  provider,
  connected,
  propertyIdentifier,
  serviceAccountEmail,
  lastSyncAt,
  lastSyncError,
  status,
}: {
  title: string;
  provider: "GSC" | "GA4";
  connected: boolean;
  propertyIdentifier: string | null;
  serviceAccountEmail: string | null;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  status: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span
          className={
            connected
              ? "text-[10px] uppercase tracking-wider font-semibold text-primary"
              : "text-[10px] uppercase tracking-wider font-semibold text-muted-foreground"
          }
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      {connected ? (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <Detail label="Property" value={propertyIdentifier ?? "—"} mono />
            <Detail
              label="Service account"
              value={serviceAccountEmail ?? "—"}
              mono
            />
            <Detail
              label="Last sync"
              value={
                lastSyncAt
                  ? formatDistanceToNow(lastSyncAt, { addSuffix: true })
                  : "Never"
              }
            />
            <Detail label="Status" value={status ?? "Idle"} />
          </dl>
          {lastSyncError ? (
            <p className="text-[11px] text-destructive rounded-md border border-destructive/30 bg-destructive/10 p-3">
              {lastSyncError}
            </p>
          ) : null}
          <div className="pt-1">
            <DisconnectSeoForm provider={provider} />
          </div>
        </>
      ) : (
        <ConnectSeoForm provider={provider} />
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-foreground break-all ${
          mono ? "font-mono text-[11px]" : "text-xs"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function SeoValueProp({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="shrink-0 mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-foreground leading-tight">
          {label}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
          {description}
        </div>
      </div>
    </div>
  );
}

function SetupHelp() {
  return (
    <div className="mt-5 rounded-xl border border-border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground space-y-2">
      <p className="font-semibold text-foreground">
        How to create a Google service account
      </p>
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Open the Google Cloud Console and create or select a project.</li>
        <li>
          Navigate to IAM and Admin to Service Accounts. Click{" "}
          <strong>Create Service Account</strong>. A name like{" "}
          <code className="font-mono">seo-pull</code> works well.
        </li>
        <li>
          On the new service account, open the Keys tab. Click{" "}
          <strong>Add Key</strong> to <strong>Create new key</strong> and pick
          JSON. Save the file.
        </li>
        <li>
          For Search Console: open Search Console, pick the property, go to
          Settings to Users and permissions, and add the service account email
          with at least <strong>Restricted</strong> permission.
        </li>
        <li>
          For Analytics: open GA4 Admin, then Property access management, and
          add the service account email as a <strong>Viewer</strong> on the
          property.
        </li>
        <li>
          Paste the JSON file contents above along with the property URL (GSC)
          or numeric property ID (GA4). The portal verifies access before
          saving and runs an initial 30-day backfill in the background.
        </li>
      </ol>
    </div>
  );
}
