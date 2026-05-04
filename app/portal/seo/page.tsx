import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { SeoProvider } from "@prisma/client";
import { SeoTrendChart, type TrendPoint } from "./seo-trend-chart";
import {
  ConnectSeoForm,
  DisconnectSeoForm,
  SyncSeoButton,
} from "./seo-connect-forms";

export const metadata: Metadata = { title: "SEO" };
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function fmtPosition(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return value.toFixed(1);
}

function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

function fmtDelta(current: number, prior: number): {
  pct: number;
  label: string;
  tone: "up" | "down" | "flat";
} {
  if (prior === 0 && current === 0) return { pct: 0, label: "—", tone: "flat" };
  if (prior === 0) return { pct: 100, label: "new", tone: "up" };
  const pct = ((current - prior) / prior) * 100;
  const tone = pct > 1 ? "up" : pct < -1 ? "down" : "flat";
  const sign = pct >= 0 ? "+" : "";
  return { pct, label: `${sign}${pct.toFixed(0)}%`, tone };
}

// Position is "lower is better", so flip the tone.
function fmtPositionDelta(current: number, prior: number): {
  label: string;
  tone: "up" | "down" | "flat";
} {
  if (prior === 0 && current === 0) return { label: "—", tone: "flat" };
  if (prior === 0) return { label: "new", tone: "up" };
  const delta = current - prior;
  const tone = delta < -0.2 ? "up" : delta > 0.2 ? "down" : "flat";
  const sign = delta >= 0 ? "+" : "";
  return { label: `${sign}${delta.toFixed(1)}`, tone };
}

export default async function SeoPage() {
  const scope = await requireScope();

  // Only count rows backed by a real Google service-account JSON.
  // Seeded demo rows store the literal string "DEMO_SEED" — surfacing
  // those as "connected" misleads operators about whether real GSC/GA4
  // data is flowing. Filter at the query so the dashboard's "no
  // integration" empty state shows when nothing real is wired.
  const integrations = await prisma.seoIntegration.findMany({
    where: {
      orgId: scope.orgId,
      serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
    },
    orderBy: { provider: "asc" },
  });

  const gscIntegration = integrations.find((i) => i.provider === SeoProvider.GSC);
  const ga4Integration = integrations.find((i) => i.provider === SeoProvider.GA4);
  const hasAny = integrations.length > 0;

  // Date windows: last 28 days (current) and prior 28 days (comparison).
  const now = new Date();
  const yesterday = startOfUtcDay(new Date(now.getTime() - DAY_MS));
  const startCurrent = new Date(yesterday.getTime() - 27 * DAY_MS);
  const endPrior = new Date(startCurrent.getTime() - DAY_MS);
  const startPrior = new Date(endPrior.getTime() - 27 * DAY_MS);

  const [snapshotsCurrent, snapshotsPrior, topQueries, topPages] =
    await Promise.all([
      prisma.seoSnapshot.findMany({
        where: {
          orgId: scope.orgId,
          date: { gte: startCurrent, lte: yesterday },
        },
        orderBy: { date: "asc" },
      }),
      prisma.seoSnapshot.findMany({
        where: {
          orgId: scope.orgId,
          date: { gte: startPrior, lte: endPrior },
        },
        orderBy: { date: "asc" },
      }),
      prisma.seoQuery.groupBy({
        by: ["query"],
        where: {
          orgId: scope.orgId,
          date: { gte: startCurrent, lte: yesterday },
        },
        _sum: { clicks: true, impressions: true },
        _avg: { ctr: true, position: true },
        orderBy: { _sum: { clicks: "desc" } },
        take: 25,
      }),
      prisma.seoLandingPage.groupBy({
        by: ["url"],
        where: {
          orgId: scope.orgId,
          date: { gte: startCurrent, lte: yesterday },
        },
        _sum: { sessions: true, users: true },
        _avg: { bounceRate: true, avgEngagementTime: true },
        orderBy: { _sum: { sessions: "desc" } },
        take: 25,
      }),
    ]);

  function totalize(rows: typeof snapshotsCurrent): {
    sessions: number;
    impressions: number;
    clicks: number;
    avgCtr: number;
    avgPosition: number;
  } {
    let sessions = 0;
    let impressions = 0;
    let clicks = 0;
    let ctrSum = 0;
    let positionSum = 0;
    let ctrCount = 0;
    let positionCount = 0;
    for (const r of rows) {
      sessions += r.organicSessions;
      impressions += r.totalImpressions;
      clicks += r.totalClicks;
      if (r.avgCtr > 0) {
        ctrSum += r.avgCtr;
        ctrCount++;
      }
      if (r.avgPosition > 0) {
        positionSum += r.avgPosition;
        positionCount++;
      }
    }
    return {
      sessions,
      impressions,
      clicks,
      avgCtr: ctrCount > 0 ? ctrSum / ctrCount : 0,
      avgPosition: positionCount > 0 ? positionSum / positionCount : 0,
    };
  }

  const totalsCurrent = totalize(snapshotsCurrent);
  const totalsPrior = totalize(snapshotsPrior);

  const sessionsDelta = fmtDelta(totalsCurrent.sessions, totalsPrior.sessions);
  const impressionsDelta = fmtDelta(
    totalsCurrent.impressions,
    totalsPrior.impressions,
  );
  const clicksDelta = fmtDelta(totalsCurrent.clicks, totalsPrior.clicks);
  const ctrDelta = fmtDelta(
    totalsCurrent.avgCtr * 1000,
    totalsPrior.avgCtr * 1000,
  );
  const positionDelta = fmtPositionDelta(
    totalsCurrent.avgPosition,
    totalsPrior.avgPosition,
  );

  const trendPoints: TrendPoint[] = snapshotsCurrent.map((s) => ({
    date: s.date.toISOString().slice(0, 10),
    clicks: s.totalClicks,
    impressions: s.totalImpressions,
  }));

  return (
    <div className="space-y-3">
      <PageHeader
        title="SEO"
        description="Organic search performance from Google Search Console and Google Analytics 4. Last 28 days vs. the prior 28 days."
      />

      {!hasAny ? (
        <SectionCard
          label="Connect a data source"
          description="Pull organic search performance into the portal. Both providers use the same paste-the-JSON flow and never require OAuth."
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Google Search Console
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Queries, impressions, CTR, position
                </span>
              </div>
              <ConnectSeoForm provider="GSC" />
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Google Analytics 4
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Organic sessions, users, top pages
                </span>
              </div>
              <ConnectSeoForm provider="GA4" />
            </div>
          </div>
          <SetupHelp />
        </SectionCard>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <StatCard
              label="Organic sessions"
              value={fmtNumber(totalsCurrent.sessions)}
              hint={`${sessionsDelta.label} vs prior 28d`}
              tone={
                sessionsDelta.tone === "up"
                  ? "success"
                  : sessionsDelta.tone === "down"
                    ? "danger"
                    : undefined
              }
            />
            <StatCard
              label="Impressions"
              value={fmtNumber(totalsCurrent.impressions)}
              hint={`${impressionsDelta.label} vs prior 28d`}
              tone={
                impressionsDelta.tone === "up"
                  ? "success"
                  : impressionsDelta.tone === "down"
                    ? "danger"
                    : undefined
              }
            />
            <StatCard
              label="Clicks"
              value={fmtNumber(totalsCurrent.clicks)}
              hint={`${clicksDelta.label} vs prior 28d`}
              tone={
                clicksDelta.tone === "up"
                  ? "success"
                  : clicksDelta.tone === "down"
                    ? "danger"
                    : undefined
              }
            />
            <StatCard
              label="Avg CTR"
              value={fmtPercent(totalsCurrent.avgCtr)}
              hint={`${ctrDelta.label} vs prior 28d`}
              tone={
                ctrDelta.tone === "up"
                  ? "success"
                  : ctrDelta.tone === "down"
                    ? "danger"
                    : undefined
              }
            />
            <StatCard
              label="Avg position"
              value={fmtPosition(totalsCurrent.avgPosition)}
              hint={`${positionDelta.label} vs prior 28d`}
              tone={
                positionDelta.tone === "up"
                  ? "success"
                  : positionDelta.tone === "down"
                    ? "danger"
                    : undefined
              }
            />
          </section>

          <SectionCard
            label="Clicks & impressions"
            description="Daily totals from Search Console for the last 28 days."
            action={<SyncSeoButton />}
          >
            <SeoTrendChart data={trendPoints} />
          </SectionCard>

          {/* Position distribution + Quick Wins. Both derived from the
              already-fetched top queries set so we add zero queries. */}
          {topQueries.length > 0 ? (
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <SectionCard
                label="Position distribution"
                description="Where your queries rank — buckets across the top 25 queries"
              >
                <PositionDistribution
                  queries={topQueries.map((q) => ({
                    position: q._avg.position ?? 0,
                  }))}
                />
              </SectionCard>
              <SectionCard
                className="lg:col-span-2"
                label="Quick wins"
                description="Queries on page-1 fringe (positions 4–15) with high impressions and below-average CTR. Pushing these up moves clicks immediately."
              >
                <QuickWins
                  queries={topQueries.map((q) => ({
                    query: q.query,
                    clicks: q._sum.clicks ?? 0,
                    impressions: q._sum.impressions ?? 0,
                    ctr: q._avg.ctr ?? 0,
                    position: q._avg.position ?? 0,
                  }))}
                />
              </SectionCard>
            </section>
          ) : null}

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SectionCard
              label="Top organic queries"
              description="Aggregated across the last 28 days. Sorted by clicks."
            >
              {topQueries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">
                  No query data yet. Connect Search Console and run a sync.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs" aria-label="Top organic queries">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-2 py-2">Query</th>
                        <th className="text-right font-medium px-2 py-2">Clicks</th>
                        <th className="text-right font-medium px-2 py-2">Impr.</th>
                        <th className="text-right font-medium px-2 py-2">CTR</th>
                        <th className="text-right font-medium px-2 py-2">Pos.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {topQueries.map((q) => (
                        <tr key={q.query}>
                          <td className="px-2 py-2 text-foreground truncate max-w-[260px]">
                            {q.query}
                          </td>
                          <td className="text-right tabular-nums px-2 py-2 text-foreground">
                            {fmtNumber(q._sum.clicks ?? 0)}
                          </td>
                          <td className="text-right tabular-nums px-2 py-2 text-muted-foreground">
                            {fmtNumber(q._sum.impressions ?? 0)}
                          </td>
                          <td className="text-right tabular-nums px-2 py-2 text-muted-foreground">
                            {fmtPercent(q._avg.ctr ?? 0)}
                          </td>
                          <td className="text-right tabular-nums px-2 py-2 text-muted-foreground">
                            {fmtPosition(q._avg.position ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard
              label="Top landing pages"
              description="Organic-only sessions by URL, last 28 days."
            >
              {topPages.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">
                  No page data yet. Connect Analytics and run a sync.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs" aria-label="Top landing pages">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-2 py-2">Page</th>
                        <th className="text-right font-medium px-2 py-2">Sessions</th>
                        <th className="text-right font-medium px-2 py-2">Bounce</th>
                        <th className="text-right font-medium px-2 py-2">Engaged (s)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {topPages.map((p) => (
                        <tr key={p.url}>
                          <td className="px-2 py-2 text-foreground truncate max-w-[260px] font-mono text-[11px]">
                            {p.url}
                          </td>
                          <td className="text-right tabular-nums px-2 py-2 text-foreground">
                            {fmtNumber(p._sum.sessions ?? 0)}
                          </td>
                          <td className="text-right tabular-nums px-2 py-2 text-muted-foreground">
                            {fmtPercent(p._avg.bounceRate ?? 0)}
                          </td>
                          <td className="text-right tabular-nums px-2 py-2 text-muted-foreground">
                            {(p._avg.avgEngagementTime ?? 0).toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </section>

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
        </>
      )}
    </div>
  );
}

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
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span
          className={
            connected
              ? "text-[10px] uppercase tracking-wider font-semibold text-emerald-700"
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
            <p className="text-[11px] text-rose-700 rounded-md border border-rose-200 bg-rose-50 p-3">
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

function SetupHelp() {
  return (
    <div className="mt-5 rounded-lg border border-border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground space-y-2">
      <p className="font-semibold text-foreground">
        How to create a Google service account
      </p>
      <ol className="list-decimal list-inside space-y-1.5">
        <li>
          Open the Google Cloud Console and create or select a project.
        </li>
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

// ---------------------------------------------------------------------------
// PositionDistribution — bucket the average position across queries into
// four ranges and render as a horizontal stacked-bar with counts.
//
// Buckets follow the Searchable / Clarity playbook:
//   1–3  : top of page 1 (gold)
//   4–10 : bottom of page 1 (blue accent)
//   11–20: page 2 (amber)
//   21+  : page 3+ (rose, low value)
// Token-themed so it picks up the cream canvas.
// ---------------------------------------------------------------------------

function PositionDistribution({
  queries,
}: {
  queries: Array<{ position: number }>;
}) {
  const buckets = [
    { label: "1–3", color: "#10B981", count: 0, hint: "Top of page 1" },
    { label: "4–10", color: "#2563EB", count: 0, hint: "Bottom of page 1" },
    { label: "11–20", color: "#F59E0B", count: 0, hint: "Page 2" },
    { label: "21+", color: "#B53333", count: 0, hint: "Page 3 or deeper" },
  ];
  for (const q of queries) {
    const p = q.position;
    if (p <= 3) buckets[0].count += 1;
    else if (p <= 10) buckets[1].count += 1;
    else if (p <= 20) buckets[2].count += 1;
    else buckets[3].count += 1;
  }
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-4">
        Run a GSC sync to populate position data.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {/* Stacked bar */}
      <div
        role="img"
        aria-label="Position distribution"
        className="flex h-3 w-full overflow-hidden rounded-full"
      >
        {buckets.map((b) => {
          const pct = total > 0 ? (b.count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={b.label}
              style={{
                width: `${pct}%`,
                backgroundColor: b.color,
              }}
              className="transition-all"
              title={`${b.label}: ${b.count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      {/* Legend with counts */}
      <ul className="space-y-1">
        {buckets.map((b) => {
          const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
          return (
            <li
              key={b.label}
              className="flex items-baseline justify-between gap-2 text-[11px]"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-foreground font-medium">{b.label}</span>
                <span className="text-muted-foreground hidden md:inline">
                  · {b.hint}
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                <span className="text-foreground font-semibold">{b.count}</span>{" "}
                query{b.count === 1 ? "" : "ies"} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickWins — surface queries that are page-1-fringe (positions 4–15) with
// high impressions and below-average CTR. Pushing these up converts clicks
// immediately. Server-calculated; pure data, no extra queries.
// ---------------------------------------------------------------------------

function QuickWins({
  queries,
}: {
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}) {
  const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
  const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  // Impressions threshold: top quartile of the visible set, with a floor of
  // 100 so very small accounts still surface something actionable.
  const impressionThreshold = Math.max(
    100,
    queries
      .map((q) => q.impressions)
      .sort((a, b) => b - a)[Math.floor(queries.length / 4)] ?? 0,
  );
  const wins = queries
    .filter(
      (q) =>
        q.position >= 4 &&
        q.position <= 15 &&
        q.impressions >= impressionThreshold &&
        q.ctr < avgCtr,
    )
    .sort((a, b) => {
      // Score = impressions × (avgCtr - currentCtr). Higher = bigger
      // potential lift if we move this query up a position.
      const scoreA = a.impressions * Math.max(0, avgCtr - a.ctr);
      const scoreB = b.impressions * Math.max(0, avgCtr - b.ctr);
      return scoreB - scoreA;
    })
    .slice(0, 8);
  if (wins.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-4">
        No quick-win opportunities in this window — your fringe queries already
        out-perform the site CTR average. Look for new content gaps in Topics.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-[11px]" aria-label="Quick win opportunities">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-2 py-1.5">Query</th>
            <th className="text-right font-medium px-2 py-1.5">Pos</th>
            <th className="text-right font-medium px-2 py-1.5">Impr.</th>
            <th className="text-right font-medium px-2 py-1.5">Current CTR</th>
            <th className="text-right font-medium px-2 py-1.5">Lift potential</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {wins.map((q) => {
            const lift = Math.round(
              q.impressions * Math.max(0, avgCtr - q.ctr),
            );
            return (
              <tr key={q.query}>
                <td className="px-2 py-1.5 text-foreground truncate max-w-[260px]">
                  {q.query}
                </td>
                <td className="text-right tabular-nums px-2 py-1.5 text-foreground font-semibold">
                  {q.position.toFixed(1)}
                </td>
                <td className="text-right tabular-nums px-2 py-1.5 text-muted-foreground">
                  {q.impressions.toLocaleString()}
                </td>
                <td className="text-right tabular-nums px-2 py-1.5 text-muted-foreground">
                  {(q.ctr * 100).toFixed(1)}%
                </td>
                <td className="text-right tabular-nums px-2 py-1.5 text-emerald-700 font-semibold">
                  +{lift.toLocaleString()} clicks
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
