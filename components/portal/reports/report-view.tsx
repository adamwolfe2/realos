import * as React from "react";
import type { ReportSnapshot } from "@/lib/reports/generate";

// ---------------------------------------------------------------------------
// ReportView
//
// Renders a frozen ReportSnapshot with the same visual language used across
// the operator dashboard. Used by both the portal viewer and the public
// /r/[token] page so the numbers the operator reviews are pixel-identical to
// what the client sees.
// ---------------------------------------------------------------------------

type Props = {
  snapshot: ReportSnapshot;
  headline?: string | null;
  notes?: string | null;
  orgName?: string | null;
  orgLogoUrl?: string | null;
  // Show the operator-branded framing on the public page.
  publicFraming?: boolean;
};

export function ReportView({
  snapshot,
  headline,
  notes,
  orgName,
  orgLogoUrl,
  publicFraming = false,
}: Props) {
  const periodStart = new Date(snapshot.periodStart);
  const periodEnd = new Date(snapshot.periodEnd);
  const periodLabel = `${formatDate(periodStart)} to ${formatDate(periodEnd)}`;
  const kindLabel =
    snapshot.kind === "weekly"
      ? "Weekly report"
      : snapshot.kind === "monthly"
        ? "Monthly report"
        : "Performance report";

  return (
    <article className="space-y-6 report-article">
      {/* Header */}
      <header className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
              {kindLabel}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--near-black)]">
              {orgName ?? "Performance review"}
            </h1>
            <p className="mt-1 text-sm text-[var(--olive-gray)]">{periodLabel}</p>
          </div>
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogoUrl}
              alt={orgName ?? "Logo"}
              className="h-10 w-auto object-contain shrink-0"
            />
          ) : null}
        </div>

        {headline ? (
          <div className="mt-5 border-t border-[var(--border-cream)] pt-4">
            <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
              Top of mind this {snapshot.kind === "monthly" ? "month" : "week"}
            </div>
            <p className="mt-1 text-base text-[var(--near-black)] leading-relaxed">
              {headline}
            </p>
          </div>
        ) : null}

        {notes ? (
          <div className="mt-4">
            <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
              A note from your operator
            </div>
            <p className="mt-1 text-sm text-[var(--olive-gray)] leading-relaxed whitespace-pre-wrap">
              {notes}
            </p>
          </div>
        ) : null}
      </header>

      {/* KPI strip */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <KpiCard
          label="Leads"
          value={snapshot.kpis.leads.toLocaleString()}
          deltaPct={snapshot.kpiDeltas.leadsPct}
        />
        <KpiCard
          label="Tours"
          value={snapshot.kpis.tours.toLocaleString()}
          deltaPct={snapshot.kpiDeltas.toursPct}
        />
        <KpiCard
          label="Applications"
          value={snapshot.kpis.applications.toLocaleString()}
          deltaPct={snapshot.kpiDeltas.applicationsPct}
        />
        <KpiCard
          label="Ad spend"
          value={`$${snapshot.kpis.adSpendUsd.toLocaleString()}`}
          deltaPct={snapshot.kpiDeltas.adSpendUsdPct}
          invertDelta
        />
        <KpiCard
          label="Cost per lead"
          value={
            snapshot.kpis.costPerLead != null
              ? `$${snapshot.kpis.costPerLead.toFixed(2)}`
              : "\u2014"
          }
          deltaPct={snapshot.kpiDeltas.costPerLeadPct}
          invertDelta
        />
        <KpiCard
          label="Organic sessions"
          value={snapshot.kpis.organicSessions.toLocaleString()}
          deltaPct={snapshot.kpiDeltas.organicSessionsPct}
        />
      </section>

      {/* Traffic trend */}
      <Section title="Traffic trend" eyebrow="Daily sessions over the period">
        <TrendChart data={snapshot.trafficTrend} />
      </Section>

      {/* Funnel + lead sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Conversion funnel" eyebrow="From new lead to signed lease">
          <FunnelList stages={snapshot.funnel} />
        </Section>
        <Section title="Where leads came from" eyebrow="Source mix">
          <SourceList sources={snapshot.leadSources} />
        </Section>
      </div>

      {/* Ad performance */}
      {snapshot.adPerformance.length > 0 ? (
        <Section title="Paid ad performance" eyebrow="Per platform">
          <Table
            columns={["Platform", "Spend", "Leads", "CPL", "Conv. rate"]}
            rows={snapshot.adPerformance.map((r) => [
              r.platform,
              `$${r.spendUsd.toLocaleString()}`,
              r.leads.toLocaleString(),
              r.cpl != null ? `$${r.cpl.toFixed(2)}` : "\u2014",
              r.conversionRate != null ? `${r.conversionRate.toFixed(1)}%` : "\u2014",
            ])}
          />
        </Section>
      ) : null}

      {/* Top pages + queries */}
      {(snapshot.topPages.length > 0 || snapshot.topQueries.length > 0) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {snapshot.topPages.length > 0 ? (
            <Section title="Top landing pages" eyebrow="Organic sessions">
              <Table
                columns={["Page", "Sessions"]}
                rows={snapshot.topPages.map((r) => [
                  shortUrl(r.url),
                  r.sessions.toLocaleString(),
                ])}
              />
            </Section>
          ) : null}
          {snapshot.topQueries.length > 0 ? (
            <Section title="Top search queries" eyebrow="Clicks and impressions">
              <Table
                columns={["Query", "Clicks", "Impr.", "Pos."]}
                rows={snapshot.topQueries.map((r) => [
                  r.query,
                  r.clicks.toLocaleString(),
                  r.impressions.toLocaleString(),
                  r.position ? r.position.toFixed(1) : "\u2014",
                ])}
              />
            </Section>
          ) : null}
        </div>
      ) : null}

      {/* Chatbot */}
      {snapshot.chatbotStats.conversations > 0 ? (
        <Section title="Chatbot activity" eyebrow="Conversations and captured leads">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MiniStat label="Conversations" value={snapshot.chatbotStats.conversations.toLocaleString()} />
            <MiniStat label="Leads from chat" value={snapshot.chatbotStats.leadsFromChat.toLocaleString()} />
            <MiniStat label="Avg. messages" value={snapshot.chatbotStats.avgMessageCount.toFixed(1)} />
          </div>
        </Section>
      ) : null}

      {/* Insights */}
      {snapshot.insights.length > 0 ? (
        <Section title="Signals we noticed" eyebrow="Automated insights from this period">
          <ul className="space-y-2">
            {snapshot.insights.map((insight) => (
              <li
                key={insight.id}
                className="rounded-lg border border-[var(--border-cream)] bg-[var(--parchment)] p-3"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={
                      "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded " +
                      severityTone(insight.severity)
                    }
                  >
                    {insight.severity}
                  </span>
                  <span className="text-sm font-semibold text-[var(--near-black)]">
                    {insight.title}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--olive-gray)] leading-relaxed">
                  {insight.body}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Property rollup */}
      {snapshot.properties.length > 0 ? (
        <Section title="By property" eyebrow="Leads and occupancy">
          <Table
            columns={["Property", "Leads", "Occupancy"]}
            rows={snapshot.properties.map((p) => [
              p.name,
              p.leads.toLocaleString(),
              p.occupancyPct != null ? `${p.occupancyPct}%` : "\u2014",
            ])}
          />
        </Section>
      ) : null}

      {publicFraming ? (
        <footer className="pt-4 text-center text-[11px] text-[var(--stone-gray)]">
          Generated by LeaseStack on behalf of {orgName ?? "your operator"}.
        </footer>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)]">
      <header className="px-5 pt-5">
        {eyebrow ? (
          <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)] mb-1">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-base font-semibold tracking-tight text-[var(--near-black)]">
          {title}
        </h2>
      </header>
      <div className="p-5 pt-4">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  deltaPct,
  invertDelta = false,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  invertDelta?: boolean;
}) {
  const hasDelta = deltaPct != null;
  // For cost metrics, a drop is good, so invert the color.
  const goodDirection =
    hasDelta && (invertDelta ? (deltaPct as number) < 0 : (deltaPct as number) > 0);
  const badDirection =
    hasDelta && (invertDelta ? (deltaPct as number) > 0 : (deltaPct as number) < 0);
  return (
    <div className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-4">
      <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
        {label}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="text-[26px] leading-none font-semibold tracking-tight tabular-nums text-[var(--near-black)]">
          {value}
        </div>
        {hasDelta ? (
          <span
            className={
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
              (goodDirection
                ? "text-emerald-700 bg-emerald-50"
                : badDirection
                  ? "text-rose-700 bg-rose-50"
                  : "text-[var(--olive-gray)] bg-[var(--warm-sand)]")
            }
          >
            {deltaPct! >= 0 ? "+" : ""}
            {deltaPct}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FunnelList({ stages }: { stages: ReportSnapshot["funnel"] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ul className="space-y-2">
      {stages.map((s) => {
        const pct = Math.round((s.count / max) * 100);
        return (
          <li key={s.stage} className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-xs text-[var(--olive-gray)]">{s.stage}</span>
            <div className="flex-1 h-6 rounded-md bg-[var(--warm-sand)] overflow-hidden">
              <div
                className="h-full bg-[var(--terracotta)] opacity-80"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="w-12 text-right text-sm font-semibold tabular-nums text-[var(--near-black)]">
              {s.count.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SourceList({ sources }: { sources: ReportSnapshot["leadSources"] }) {
  if (sources.length === 0) {
    return (
      <p className="text-xs text-[var(--stone-gray)]">No leads in this period.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {sources.map((row) => (
        <li key={row.source} className="flex items-center gap-3">
          <span className="flex-1 text-sm text-[var(--near-black)]">{row.source}</span>
          <span className="text-xs text-[var(--stone-gray)] tabular-nums">
            {row.pct}%
          </span>
          <span className="w-12 text-right text-sm font-semibold tabular-nums text-[var(--near-black)]">
            {row.count.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                className="text-left text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)] pb-2 border-b border-[var(--border-cream)]"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-[var(--border-cream)] last:border-0">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={
                    "py-2 tabular-nums " +
                    (i === 0 ? "text-[var(--near-black)]" : "text-[var(--olive-gray)]")
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-cream)] bg-[var(--parchment)] p-3">
      <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--near-black)]">
        {value}
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <p className="text-xs text-[var(--stone-gray)]">Not enough data for a trend chart yet.</p>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 800;
  const height = 120;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `M0,${height} L${points.split(" ").join(" L")} L${width},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-24"
      aria-hidden="true"
    >
      <path d={areaPath} fill="var(--terracotta)" opacity="0.12" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--terracotta)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function severityTone(severity: string): string {
  if (severity === "critical") return "bg-rose-100 text-rose-800";
  if (severity === "warning") return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-800";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path.length > 40 ? `${path.slice(0, 37)}\u2026` : path;
  } catch {
    return url.length > 40 ? `${url.slice(0, 37)}\u2026` : url;
  }
}
