"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { formatDistanceToNow } from "date-fns";
import { AdPlatform } from "@prisma/client";
import { Logo, Metric as Stat, MetricStrip, Panel, Pill, change } from "@/components/portal/overview/kit";
import { cn } from "@/lib/utils";
import { DataPlaceholder } from "@/components/portal/ui/data-placeholder";
import { Clock } from "lucide-react";

// Lazy-load recharts (~80KB gzipped). The chart only renders when there's
// data anyway, so deferring it cuts initial bundle for /portal/ads.
const AdsTrendChart = dynamic(
  () => import("./ads-trend-chart").then((m) => m.AdsTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
        Loading chart…
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// AdsDashboard — client component for /portal/ads.
//
// Receives 28-day window data + prior 28-day window data from the server,
// computes aggregates and deltas in-component, renders:
//   - Segment toggle (All / Google Ads / Meta Ads)
//   - Stat cards (spend, clicks, conversions, CPC, cost-per-conversion)
//   - Time-series chart (spend vs conversions over time)
//   - Sortable campaign table
//
// Pure client logic; no fetching beyond what the page already loaded.
// ---------------------------------------------------------------------------

type Account = {
  id: string;
  platform: AdPlatform;
  displayName: string;
  externalAccountId: string;
  currency: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  accessStatus: string;
};

type Campaign = {
  id: string;
  adAccountId: string;
  platform: AdPlatform;
  externalCampaignId: string;
  name: string;
  status: string;
  objective: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  spendCents: number;
  /** Monthly budget as configured on the native platform. Null when the
   *  platform hasn't reported one (e.g. campaign uses a lifetime budget). */
  budgetCents: number | null;
  /** Property this campaign is scoped to, or null for an org-wide campaign. */
  propertyName: string | null;
};

// One-click escape hatch into the native ad platform — folded in from the
// retired /portal/campaigns page (P1-15). Returns null when we can't build
// a useful URL (no platform match or missing external id); callers render
// the campaign name as plain text in that case.
function platformManageUrl(args: {
  platform: AdPlatform;
  externalCampaignId: string;
  externalAccountId: string | undefined;
}): string | null {
  const cid = args.externalCampaignId;
  if (!cid) return null;
  if (args.platform === AdPlatform.GOOGLE_ADS) {
    return `https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(cid)}`;
  }
  if (args.platform === AdPlatform.META) {
    const acct = args.externalAccountId
      ? `&act=${encodeURIComponent(args.externalAccountId)}`
      : "";
    return `https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${encodeURIComponent(cid)}${acct}`;
  }
  return null;
}

type Metric = {
  adAccountId: string;
  date: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
};

type PriorMetric = {
  adAccountId: string;
  spendCents: number;
  clicks: number;
  conversions: number;
};


type SortKey = "name" | "platform" | "status" | "spend" | "clicks" | "conversions" | "cpl" | "ctr";

export function AdsDashboard({
  accounts,
  campaigns,
  currentMetrics,
  priorMetrics,
  leadsAttributed,
  signedLeases,
}: {
  accounts: Account[];
  campaigns: Campaign[];
  currentMetrics: Metric[];
  priorMetrics: PriorMetric[];
  leadsAttributed: number;
  signedLeases: number;
}) {
  const [sortKey, setSortKey] = React.useState<SortKey>("spend");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const accountById = React.useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const filteredCurrent = currentMetrics;
  const filteredCampaigns = campaigns;

  const totals = React.useMemo(() => aggregate(filteredCurrent), [filteredCurrent]);
  const priorTotals = React.useMemo(() => aggregatePrior(priorMetrics), [priorMetrics]);

  // 28-day spend and conversions per connected account, for the breakdown.
  const byAccount = React.useMemo(() => {
    const m = new Map<string, { spendCents: number; conversions: number }>();
    for (const r of currentMetrics) {
      const cur = m.get(r.adAccountId) ?? { spendCents: 0, conversions: 0 };
      m.set(r.adAccountId, { spendCents: cur.spendCents + r.spendCents, conversions: cur.conversions + r.conversions });
    }
    return m;
  }, [currentMetrics]);

  const cpcCents = totals.clicks > 0 ? Math.round(totals.spendCents / totals.clicks) : 0;
  const costPerConversionCents =
    totals.conversions > 0
      ? Math.round(totals.spendCents / totals.conversions)
      : 0;

  const series = React.useMemo(() => buildSeries(filteredCurrent), [filteredCurrent]);

  const sortedCampaigns = React.useMemo(() => {
    const arr = [...filteredCampaigns];
    arr.sort((a, b) => {
      const cmp = compareCampaigns(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredCampaigns, sortKey, sortDir]);

  const maxAccountSpend = Math.max(1, ...accounts.map((a) => byAccount.get(a.id)?.spendCents ?? 0));

  return (
    <div className="space-y-5">
      <MetricStrip cols={6}>
        <Stat label="Spend" value={formatCents(totals.spendCents)} delta={change(totals.spendCents, priorTotals.spendCents)} note="Last 28 days vs the 28 before" />
        <Stat label="Clicks" value={totals.clicks.toLocaleString()} delta={change(totals.clicks, priorTotals.clicks)} note={`${formatCents(cpcCents)} per click`} />
        <Stat
          label="Conversions"
          value={totals.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          delta={change(totals.conversions, priorTotals.conversions)}
          note="Reported by the platforms"
        />
        <Stat label="Cost per conversion" value={costPerConversionCents ? formatCents(costPerConversionCents) : "—"} note="Spend over conversions" />
        <Stat label="Leads attributed" value={leadsAttributed.toLocaleString()} note="Matched to a lead in LeaseStack" />
        <Stat label="Signed leases" value={signedLeases.toLocaleString()} note="From ad-sourced leads" />
      </MetricStrip>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Daily spend vs conversions" aside="Last 28 days" className="xl:col-span-2">
          {series.length === 0 ? (
            <p className="text-[13px] text-[var(--t-muted)]">
              No metrics in the window yet. The next nightly sync will fill this in.
            </p>
          ) : (
            <AdsTrendChart series={series} formatCents={formatCents} />
          )}
        </Panel>

        <Panel title="Accounts" aside={`${accounts.length} connected`} flush>
          <ul className="divide-y divide-[var(--t-divider)]">
            {accounts.map((a) => {
              const row = byAccount.get(a.id) ?? { spendCents: 0, conversions: 0 };
              return (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Logo slug={platformSlug(a.platform)} size={16} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--t-ink)]">{a.displayName}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--t-ink)]">{formatCents(row.spendCents)}</span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--t-wash)]">
                    <div className="h-full rounded-full bg-[var(--t-accent)]" style={{ width: `${Math.round((row.spendCents / maxAccountSpend) * 100)}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--t-muted)]">
                    <span className="tabular-nums">
                      {row.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 })} conversions ·{" "}
                      {a.lastSyncAt ? `synced ${formatDistanceToNow(new Date(a.lastSyncAt), { addSuffix: true })}` : "awaiting first sync"}
                    </span>
                    <Pill tone={a.accessStatus === "active" ? "good" : a.accessStatus === "error" ? "bad" : "warn"}>
                      {a.accessStatus === "active" ? "Live" : a.accessStatus === "error" ? "Error" : "Pending"}
                    </Pill>
                  </div>
                  {a.lastSyncError ? <p className="mt-1 text-[12px] text-[#b91c1c]">{a.lastSyncError}</p> : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Campaigns" aside="Lifetime totals as of last sync" flush className="overflow-x-auto">
        {sortedCampaigns.length === 0 ? (
          <div className="p-5">
            <DataPlaceholder
              intent="waiting"
              icon={<Clock className="h-4 w-4" />}
              title="No campaigns synced yet for this filter"
              body="The first sync runs as soon as you connect an ad account, then nightly after that."
            />
          </div>
        ) : totals.spendCents === 0 && totals.clicks === 0 && totals.conversions === 0 ? (
          <div className="p-5">
            <DataPlaceholder
              intent="waiting"
              icon={<Clock className="h-4 w-4" />}
              title="Campaigns connected — waiting on first metrics sync"
              body="Spend, clicks, and conversions will appear here within 24 hours of the first nightly sync."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="ls-eyebrow border-b border-border">
              <tr>
                <SortHeader
                  label="Campaign"
                  k="name"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="left"
                />
                <SortHeader
                  label="Platform"
                  k="platform"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="left"
                />
                <th className="px-4 py-2 text-left ls-eyebrow">
                  Property
                </th>
                <SortHeader
                  label="Status"
                  k="status"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="center"
                />
                <th className="px-4 py-2 text-right ls-eyebrow">
                  Budget
                </th>
                <SortHeader
                  label="Spend"
                  k="spend"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="right"
                />
                <SortHeader
                  label="Clicks"
                  k="clicks"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="right"
                />
                <SortHeader
                  label="Conv."
                  k="conversions"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="right"
                />
                <SortHeader
                  label="CPL"
                  k="cpl"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="right"
                />
                <SortHeader
                  label="CTR"
                  k="ctr"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedCampaigns.map((c) => {
                const ctr =
                  c.impressions > 0 ? c.clicks / c.impressions : 0;
                const cpl =
                  c.conversions > 0
                    ? Math.round(c.spendCents / c.conversions)
                    : 0;
                const manageUrl = platformManageUrl({
                  platform: c.platform,
                  externalCampaignId: c.externalCampaignId,
                  externalAccountId: accountById.get(c.adAccountId)?.externalAccountId,
                });
                return (
                  <tr key={c.id} id={c.id} className="scroll-mt-24">
                    <td className="px-4 py-2 text-sm text-foreground">
                      {manageUrl ? (
                        <a
                          href={manageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary hover:underline underline-offset-2"
                          title={`Open in ${platformLabel(c.platform)} ↗`}
                        >
                          {c.name}
                        </a>
                      ) : (
                        c.name
                      )}
                      {c.objective ? (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {c.objective}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Logo slug={platformSlug(c.platform)} size={13} />
                        {platformLabel(c.platform)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {c.propertyName ?? "Org-wide"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Pill tone={campaignTone(c.status)}>{c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Pill>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {c.budgetCents ? `${formatCents(c.budgetCents)}/mo` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCents(c.spendCents)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {c.clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {c.conversions.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {cpl > 0 ? formatCents(cpl) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {ctr > 0 ? `${(ctr * 100).toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  k,
  current,
  dir,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align: "left" | "right" | "center";
}) {
  const active = current === k;
  return (
    <th
      className={cn(
        "px-4 py-2 select-none",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left"
      )}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground"
        )}
      >
        {label}
        {active ? <span aria-hidden>{dir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );
}

function campaignTone(status: string): "good" | "neutral" {
  const norm = status.toUpperCase();
  return norm === "ENABLED" || norm === "ACTIVE" ? "good" : "neutral";
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function aggregate(rows: Metric[]) {
  let impressions = 0;
  let clicks = 0;
  let spendCents = 0;
  let conversions = 0;
  for (const r of rows) {
    impressions += r.impressions;
    clicks += r.clicks;
    spendCents += r.spendCents;
    conversions += r.conversions;
  }
  return { impressions, clicks, spendCents, conversions };
}

function aggregatePrior(rows: PriorMetric[]) {
  let clicks = 0;
  let spendCents = 0;
  let conversions = 0;
  for (const r of rows) {
    clicks += r.clicks;
    spendCents += r.spendCents;
    conversions += r.conversions;
  }
  return { clicks, spendCents, conversions };
}

function buildSeries(rows: Metric[]) {
  const map = new Map<
    string,
    { date: string; spendCents: number; conversions: number; clicks: number }
  >();
  for (const r of rows) {
    const key = r.date.slice(0, 10);
    const existing = map.get(key) ?? {
      date: key,
      spendCents: 0,
      conversions: 0,
      clicks: 0,
    };
    existing.spendCents += r.spendCents;
    existing.conversions += r.conversions;
    existing.clicks += r.clicks;
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function compareCampaigns(a: Campaign, b: Campaign, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "platform":
      return a.platform.localeCompare(b.platform);
    case "status":
      return a.status.localeCompare(b.status);
    case "spend":
      return a.spendCents - b.spendCents;
    case "clicks":
      return a.clicks - b.clicks;
    case "conversions":
      return a.conversions - b.conversions;
    case "cpl":
      return cpl(a) - cpl(b);
    case "ctr":
      return ctr(a) - ctr(b);
  }
}

function cpl(c: Campaign): number {
  return c.conversions > 0 ? c.spendCents / c.conversions : 0;
}

function ctr(c: Campaign): number {
  return c.impressions > 0 ? c.clicks / c.impressions : 0;
}

function setSort(
  setKey: React.Dispatch<React.SetStateAction<SortKey>>,
  setDir: React.Dispatch<React.SetStateAction<"asc" | "desc">>
) {
  return (k: SortKey) => {
    setKey((current) => {
      if (current === k) {
        setDir((d) => (d === "asc" ? "desc" : "asc"));
        return current;
      }
      setDir("desc");
      return k;
    });
  };
}

function platformSlug(p: AdPlatform): string {
  return p === AdPlatform.META ? "meta-ads" : p === AdPlatform.GOOGLE_ADS ? "google-ads" : p === AdPlatform.TIKTOK ? "tiktok-ads" : p === AdPlatform.LINKEDIN ? "linkedin-ads" : "";
}

function platformLabel(p: AdPlatform): string {
  switch (p) {
    case AdPlatform.GOOGLE_ADS:
      return "Google Ads";
    case AdPlatform.META:
      return "Meta";
    case AdPlatform.LINKEDIN:
      return "LinkedIn";
    case AdPlatform.TIKTOK:
      return "TikTok";
    case AdPlatform.REDDIT:
      return "Reddit";
  }
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

