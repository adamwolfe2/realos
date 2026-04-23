import * as React from "react";
import type { AiAnalysis, ReportAiVisibility, ReportSnapshot } from "@/lib/reports/generate";

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
  const periodLabel = `${formatDate(periodStart)} – ${formatDate(periodEnd)}`;
  const kindLabel =
    snapshot.kind === "weekly"
      ? "Weekly report"
      : snapshot.kind === "monthly"
        ? "Monthly report"
        : "Performance report";

  const hasFunnelData = snapshot.funnel.some((s) => s.count > 0);
  const hasSourceData = snapshot.leadSources.length > 0;
  const showProperties = snapshot.properties.some(
    (p) => p.leads > 0 || p.occupancyPct != null,
  );

  return (
    <article className="space-y-4 report-article">
      {/* Header — compact single-card */}
      <header className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
            <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground shrink-0">
              {kindLabel}
            </span>
            <span className="text-base font-semibold tracking-tight text-foreground truncate">
              {orgName ?? "Performance review"}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{periodLabel}</span>
          </div>
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogoUrl}
              alt={orgName ?? "Logo"}
              className="h-7 w-auto object-contain shrink-0"
            />
          ) : null}
        </div>

        {(headline || notes) ? (
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            {headline ? (
              <p className="text-sm text-foreground leading-snug">{headline}</p>
            ) : null}
            {notes ? (
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {notes}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* KPI strip — 6-up compact tiles */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-3 md:grid-cols-6 gap-2"
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
          label="Cost / lead"
          value={
            snapshot.kpis.costPerLead != null
              ? `$${snapshot.kpis.costPerLead.toFixed(2)}`
              : "—"
          }
          deltaPct={snapshot.kpiDeltas.costPerLeadPct}
          invertDelta
        />
        <KpiCard
          label="Organic"
          value={snapshot.kpis.organicSessions.toLocaleString()}
          deltaPct={snapshot.kpiDeltas.organicSessionsPct}
        />
      </section>

      {/* AI analysis — centerpiece after KPIs */}
      {snapshot.aiAnalysis ? (
        <AiAnalysisSection analysis={snapshot.aiAnalysis} />
      ) : null}

      {/* Traffic trend + mini stats row */}
      <Section title="Traffic trend" eyebrow="Daily sessions">
        <TrendChart data={snapshot.trafficTrend} />
      </Section>

      {/* Funnel + lead sources */}
      {hasFunnelData || hasSourceData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {hasFunnelData ? (
            <Section title="Conversion funnel" eyebrow="New lead to signed lease">
              <FunnelList stages={snapshot.funnel} />
            </Section>
          ) : null}
          {hasSourceData ? (
            <Section title="Lead sources" eyebrow="Source mix">
              <SourceList sources={snapshot.leadSources} />
            </Section>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">No funnel data yet for this period.</p>
        </div>
      )}

      {/* Ad performance */}
      {snapshot.adPerformance.length > 0 ? (
        <Section title="Paid ad performance" eyebrow="Per platform">
          <Table
            columns={["Platform", "Spend", "Leads", "CPL", "Conv. rate"]}
            rows={snapshot.adPerformance.map((r) => [
              r.platform,
              `$${r.spendUsd.toLocaleString()}`,
              r.leads.toLocaleString(),
              r.cpl != null ? `$${r.cpl.toFixed(2)}` : "—",
              r.conversionRate != null ? `${r.conversionRate.toFixed(1)}%` : "—",
            ])}
          />
        </Section>
      ) : null}

      {/* Attribution by source */}
      {snapshot.attributionBySource && snapshot.attributionBySource.length > 0 ? (
        <Section title="Where leases came from" eyebrow="Full pipeline by source">
          <Table
            columns={["Source", "Leads", "Tours", "Applications", "Signed"]}
            rows={snapshot.attributionBySource.map(r => [
              r.source,
              r.leads.toLocaleString(),
              r.tours.toLocaleString(),
              r.applications.toLocaleString(),
              r.signed.toLocaleString(),
            ])}
          />
        </Section>
      ) : null}

      {/* Top pages + queries — side by side */}
      {(snapshot.topPages.length > 0 || snapshot.topQueries.length > 0) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                  r.position ? r.position.toFixed(1) : "—",
                ])}
              />
            </Section>
          ) : null}
        </div>
      ) : null}

      {/* Chatbot */}
      {snapshot.chatbotStats.conversations > 0 ? (
        <Section title="Chatbot activity" eyebrow="Conversations and captured leads">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Conversations" value={snapshot.chatbotStats.conversations.toLocaleString()} />
            <MiniStat label="Leads from chat" value={snapshot.chatbotStats.leadsFromChat.toLocaleString()} />
            <MiniStat label="Avg. messages" value={snapshot.chatbotStats.avgMessageCount.toFixed(1)} />
          </div>
        </Section>
      ) : null}

      {/* AI visibility */}
      {snapshot.aiVisibility && snapshot.aiVisibility.brandedClicks > 0 ? (
        <AiVisibilitySection aiVisibility={snapshot.aiVisibility} />
      ) : null}

      {/* Insights */}
      {snapshot.insights.length > 0 ? (
        <Section title="Signals we noticed" eyebrow="Automated insights">
          <ul className="space-y-1.5">
            {snapshot.insights.map((insight) => (
              <li
                key={insight.id}
                className="rounded-md border border-border bg-card px-3 py-2"
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
                  <span className="text-sm font-semibold text-foreground">
                    {insight.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {insight.body}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Property rollup */}
      {showProperties ? (
        <Section title="By property" eyebrow="Leads and occupancy">
          <Table
            columns={["Property", "Leads", "Occupancy"]}
            rows={snapshot.properties
              .filter((p) => p.leads > 0 || p.occupancyPct != null)
              .map((p) => [
                p.name,
                p.leads.toLocaleString(),
                p.occupancyPct != null ? `${p.occupancyPct}%` : "—",
              ])}
          />
        </Section>
      ) : null}

      {publicFraming ? (
        <footer className="pt-2 text-center text-[11px] text-muted-foreground">
          Generated by LeaseStack on behalf of {orgName ?? "your operator"}.
        </footer>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// AI Analysis section
// ---------------------------------------------------------------------------

function AiAnalysisSection({ analysis }: { analysis: AiAnalysis }) {
  return (
    <section aria-label="AI analysis">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Section header */}
        <div className="px-4 pt-3 pb-2 border-b border-border flex items-center gap-2">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            AI analysis
          </span>
          <span className="text-[10px] text-muted-foreground/60">&middot;</span>
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Recommended actions
          </span>
        </div>

        <div className="p-4 pt-3 space-y-3">
          {/* Summary callout */}
          <div className="border-l-2 border-primary bg-primary/5 px-3 py-2 rounded-r-md">
            <p className="text-sm text-foreground leading-snug">{analysis.summary}</p>
          </div>

          {/* Action cards grid */}
          {analysis.actions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analysis.actions.map((item, idx) => (
                <AiActionCard key={idx} item={item} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AiActionCard({ item }: { item: AiAnalysis["actions"][number] }) {
  const dotColor =
    item.priority === "high"
      ? "bg-rose-500"
      : item.priority === "medium"
        ? "bg-amber-400"
        : "bg-sky-400";

  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground leading-tight">{item.title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-1">{item.observation}</p>
      <p className="text-xs text-primary leading-relaxed font-medium">{item.action}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Visibility section
// ---------------------------------------------------------------------------

function AiVisibilitySection({ aiVisibility }: { aiVisibility: ReportAiVisibility }) {
  return (
    <Section title="AI search visibility" eyebrow="Branded search performance">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Branded clicks" value={aiVisibility.brandedClicks.toLocaleString()} />
          <MiniStat label="Branded impr." value={aiVisibility.brandedImpressions.toLocaleString()} />
          <MiniStat label="Branded share" value={`${aiVisibility.brandedShare}%`} />
        </div>
        {aiVisibility.topBrandedTerms.length > 0 ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5">
              Top branded terms
            </div>
            <div className="flex flex-wrap gap-1.5">
              {aiVisibility.topBrandedTerms.map(term => (
                <span key={term} className="text-xs bg-muted px-2 py-0.5 rounded-full text-foreground">
                  {term}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Branded search clicks reflect how often people search for your property by name. Growing this metric also improves visibility in AI-powered recommendations like ChatGPT.
        </p>
      </div>
    </Section>
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
    <section className="rounded-lg border border-border bg-card">
      <header className="px-4 pt-4">
        {eyebrow ? (
          <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-0.5">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </header>
      <div className="p-4 pt-3">{children}</div>
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
  const goodDirection =
    hasDelta && (invertDelta ? (deltaPct as number) < 0 : (deltaPct as number) > 0);
  const badDirection =
    hasDelta && (invertDelta ? (deltaPct as number) > 0 : (deltaPct as number) < 0);
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground font-mono">
        {label}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1">
        <div className="text-[20px] leading-none font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </div>
        {hasDelta ? (
          <span
            className={
              "inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums shrink-0 " +
              (goodDirection
                ? "text-emerald-700 bg-emerald-50"
                : badDirection
                  ? "text-rose-700 bg-rose-50"
                  : "text-muted-foreground bg-muted")
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
    <ul className="space-y-1.5">
      {stages.map((s) => {
        const pct = Math.round((s.count / max) * 100);
        return (
          <li key={s.stage} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-muted-foreground">{s.stage}</span>
            <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary opacity-80"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="w-10 text-right text-xs font-semibold tabular-nums text-foreground">
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
      <p className="text-xs text-muted-foreground">No leads in this period.</p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {sources.map((row) => (
        <li key={row.source} className="flex items-center gap-3">
          <span className="flex-1 text-xs text-foreground">{row.source}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.pct}%
          </span>
          <span className="w-10 text-right text-xs font-semibold tabular-nums text-foreground">
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
      <table className="w-full text-xs">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                className="text-left text-[10px] tracking-widest uppercase font-semibold text-muted-foreground pb-1.5 border-b border-border"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-border last:border-0">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={
                    "py-1.5 tabular-nums " +
                    (i === 0 ? "text-foreground" : "text-muted-foreground")
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
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">Not enough data for a trend chart yet.</p>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 800;
  const height = 64;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `M0,${height} L${points.split(" ").join(" L")} L${width},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-16"
      aria-hidden="true"
    >
      <path d={areaPath} fill="#2563EB" opacity="0.12" />
      <polyline
        points={points}
        fill="none"
        stroke="#2563EB"
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
    return path.length > 40 ? `${path.slice(0, 37)}…` : path;
  } catch {
    return url.length > 40 ? `${url.slice(0, 37)}…` : url;
  }
}
