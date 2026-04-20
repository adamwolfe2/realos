"use client";

import * as React from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { AdPlatform } from "@prisma/client";
import { StatCard } from "@/components/admin/stat-card";
import { cn } from "@/lib/utils";

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
};

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

type Filter = "all" | "GOOGLE_ADS" | "META";

type SortKey = "name" | "status" | "spend" | "clicks" | "conversions" | "cpl" | "ctr";

export function AdsDashboard({
  accounts,
  campaigns,
  currentMetrics,
  priorMetrics,
}: {
  accounts: Account[];
  campaigns: Campaign[];
  currentMetrics: Metric[];
  priorMetrics: PriorMetric[];
}) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("spend");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const accountIdsByPlatform = React.useMemo(() => {
    const m = new Map<AdPlatform, Set<string>>();
    for (const a of accounts) {
      if (!m.has(a.platform)) m.set(a.platform, new Set());
      m.get(a.platform)!.add(a.id);
    }
    return m;
  }, [accounts]);

  const filteredAccountIds = React.useMemo<Set<string> | null>(() => {
    if (filter === "all") return null;
    return accountIdsByPlatform.get(filter) ?? new Set();
  }, [filter, accountIdsByPlatform]);

  const filterMatch = (adAccountId: string) =>
    filteredAccountIds == null || filteredAccountIds.has(adAccountId);

  const filteredCurrent = React.useMemo(
    () => currentMetrics.filter((m) => filterMatch(m.adAccountId)),
    [currentMetrics, filteredAccountIds]
  );
  const filteredPrior = React.useMemo(
    () => priorMetrics.filter((m) => filterMatch(m.adAccountId)),
    [priorMetrics, filteredAccountIds]
  );
  const filteredCampaigns = React.useMemo(
    () => campaigns.filter((c) => filterMatch(c.adAccountId)),
    [campaigns, filteredAccountIds]
  );

  const totals = React.useMemo(() => aggregate(filteredCurrent), [filteredCurrent]);
  const priorTotals = React.useMemo(
    () => aggregatePrior(filteredPrior),
    [filteredPrior]
  );

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

  const platformsAvailable = React.useMemo(() => {
    const s = new Set<AdPlatform>();
    for (const a of accounts) s.add(a.platform);
    return s;
  }, [accounts]);

  return (
    <div className="space-y-6">
      <Segment
        filter={filter}
        onChange={setFilter}
        platformsAvailable={platformsAvailable}
        accounts={accounts}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Spend (28d)"
          value={formatCents(totals.spendCents)}
          hint={
            priorTotals.spendCents > 0
              ? deltaHint(totals.spendCents, priorTotals.spendCents, "spend")
              : undefined
          }
        />
        <StatCard
          label="Clicks"
          value={totals.clicks.toLocaleString()}
          hint={
            priorTotals.clicks > 0
              ? deltaHint(totals.clicks, priorTotals.clicks, "vs prior 28d")
              : undefined
          }
        />
        <StatCard
          label="Conversions"
          value={totals.conversions.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}
          hint={
            priorTotals.conversions > 0
              ? deltaHint(totals.conversions, priorTotals.conversions, "vs prior 28d")
              : undefined
          }
        />
        <StatCard
          label="CPC"
          value={formatCents(cpcCents)}
          hint="Avg cost per click"
        />
        <StatCard
          label="Cost / conv."
          value={formatCents(costPerConversionCents)}
          hint="Avg cost per conversion"
        />
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            Daily spend vs conversions
          </h2>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Last 28 days
          </span>
        </div>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No metrics in the window yet. The next nightly sync will fill this in.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="convFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) =>
                    format(new Date(v), "MMM d")
                  }
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "Spend") return [formatCents(value), name];
                    return [
                      value.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      }),
                      name,
                    ];
                  }}
                  labelFormatter={(v: string) =>
                    format(new Date(v), "EEE, MMM d, yyyy")
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="spendCents"
                  name="Spend"
                  stroke="#0f172a"
                  fill="url(#spendFill)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversions"
                  name="Conversions"
                  stroke="#10b981"
                  fill="url(#convFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-border flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-foreground">Campaigns</h2>
          <span className="text-[11px] text-muted-foreground">
            Lifetime totals as of last sync
          </span>
        </div>
        {sortedCampaigns.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No campaigns synced yet for this filter. The first sync runs as
              soon as you connect an ad account, then nightly after that.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-widest uppercase text-muted-foreground bg-muted/30">
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
                  k="status"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="left"
                />
                <SortHeader
                  label="Status"
                  k="status"
                  current={sortKey}
                  dir={sortDir}
                  onSort={setSort(setSortKey, setSortDir)}
                  align="center"
                />
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
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-sm text-foreground">
                      {c.name}
                      {c.objective ? (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {c.objective}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {platformLabel(c.platform)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusPill status={c.status} />
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
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Connected accounts
        </h2>
        <ul className="divide-y divide-border">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {a.displayName}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    {platformLabel(a.platform)} · {a.externalAccountId} ·{" "}
                    {a.currency}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {a.lastSyncAt
                    ? `Last sync ${formatDistanceToNow(new Date(a.lastSyncAt), {
                        addSuffix: true,
                      })}`
                    : "Awaiting first sync"}
                  {a.lastSyncError ? (
                    <span className="text-rose-700 ml-2">
                      · {a.lastSyncError}
                    </span>
                  ) : null}
                </div>
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded-md",
                  a.accessStatus === "active"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : a.accessStatus === "error"
                      ? "bg-rose-50 text-rose-800 border border-rose-200"
                      : "bg-muted text-muted-foreground border border-border"
                )}
              >
                {a.accessStatus}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Segment({
  filter,
  onChange,
  platformsAvailable,
  accounts,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  platformsAvailable: Set<AdPlatform>;
  accounts: Account[];
}) {
  const options: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All platforms", count: accounts.length },
  ];
  if (platformsAvailable.has(AdPlatform.GOOGLE_ADS)) {
    options.push({
      key: AdPlatform.GOOGLE_ADS,
      label: "Google Ads",
      count: accounts.filter((a) => a.platform === AdPlatform.GOOGLE_ADS).length,
    });
  }
  if (platformsAvailable.has(AdPlatform.META)) {
    options.push({
      key: AdPlatform.META,
      label: "Meta Ads",
      count: accounts.filter((a) => a.platform === AdPlatform.META).length,
    });
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
            filter === o.key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-foreground border-border hover:bg-muted/50"
          )}
        >
          {o.label}
          <span
            className={cn(
              "ml-1.5 tabular-nums text-[11px]",
              filter === o.key ? "opacity-80" : "text-muted-foreground"
            )}
          >
            {o.count}
          </span>
        </button>
      ))}
    </div>
  );
}

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

function StatusPill({ status }: { status: string }) {
  const norm = status.toUpperCase();
  const tone =
    norm === "ENABLED" || norm === "ACTIVE"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : norm === "PAUSED"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-block text-[10px] font-medium px-2 py-0.5 rounded-md border",
        tone
      )}
    >
      {norm}
    </span>
  );
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

function deltaHint(current: number, prior: number, label: string): string {
  if (prior === 0) return label;
  const delta = ((current - prior) / prior) * 100;
  const arrow = delta >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(delta).toFixed(1)}% ${label}`;
}
