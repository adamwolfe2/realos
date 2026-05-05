import * as React from "react";
import type {
  AiAnalysis,
  ReportAiVisibility,
  ReportOccupancyStats,
  ReportRenewalStats,
  ReportReputationStats,
  ReportSnapshot,
  ReportVisitorStats,
} from "@/lib/reports/generate";

// ---------------------------------------------------------------------------
// ReportView — 2026 redesign.
//
// Renders a frozen ReportSnapshot in the same dense, blue-spectrum aesthetic
// the Telegraph dashboards use. All charts are pure SVG (no Recharts) so the
// page renders identically in print/PDF without hydration. New sections —
// reputation, occupancy, renewals, visitor identification — render only when
// the snapshot has data; old snapshots without those fields gracefully skip.
//
// Print CSS in /portal/reports/[id]/page.tsx pairs with the .ls-report-*
// classes here to enforce clean page breaks.
// ---------------------------------------------------------------------------

type Props = {
  snapshot: ReportSnapshot;
  headline?: string | null;
  notes?: string | null;
  orgName?: string | null;
  orgLogoUrl?: string | null;
  publicFraming?: boolean;
};

// Single source of truth for chart palette so PDFs are predictable.
const C = {
  primary: "#1D4ED8",
  primaryMid: "#2563EB",
  primaryLight: "#3B82F6",
  primaryFaint: "#93C5FD",
  primaryGhost: "#DBEAFE",
  indigo: "#4F46E5",
  ink: "#0F172A",
  muted: "#94A3B8",
  border: "#E5E7EB",
  positive: "#10B981",
  negative: "#EF4444",
  amber: "#F59E0B",
  rose: "#F43F5E",
  violet: "#8B5CF6",
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

  const { kpis, kpiDeltas } = snapshot;
  const cb = snapshot.chatbotStatsExtended ?? snapshot.chatbotStats;

  return (
    <article className="space-y-4 report-article ls-report">
      {/* Header strip */}
      <header className="ls-report-section rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
            <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground shrink-0">
              {kindLabel}
            </span>
            <span className="text-base font-semibold tracking-tight text-foreground truncate">
              {orgName ?? "Performance review"}
            </span>
            {snapshot.scope?.propertyName ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                {snapshot.scope.propertyName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-700">
                Portfolio · all properties
              </span>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {periodLabel}
            </span>
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

        {headline || notes ? (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            {headline ? (
              <p className="text-sm font-semibold text-foreground leading-snug">
                {headline}
              </p>
            ) : null}
            {notes ? (
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {notes}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* Hero gradient KPI block — anchors the page like the dashboard */}
      <HeroKpi snapshot={snapshot} />

      {/* AI analysis */}
      {snapshot.aiAnalysis ? (
        <AiAnalysisSection analysis={snapshot.aiAnalysis} />
      ) : null}

      {/* KPI strip — 5-up icon-badge tiles with deltas */}
      <section
        aria-label="Key metrics"
        className="ls-report-section grid grid-cols-2 md:grid-cols-5 gap-2"
      >
        <IconKpi
          label="Leads"
          value={kpis.leads.toLocaleString()}
          deltaPct={kpiDeltas.leadsPct}
          tone="primary"
          glyph="target"
        />
        <IconKpi
          label="Tours"
          value={kpis.tours.toLocaleString()}
          deltaPct={kpiDeltas.toursPct}
          tone="violet"
          glyph="calendar"
        />
        <IconKpi
          label="Applications"
          value={kpis.applications.toLocaleString()}
          deltaPct={kpiDeltas.applicationsPct}
          tone="emerald"
          glyph="check"
        />
        <IconKpi
          label="Cost / lead"
          value={
            kpis.costPerLead != null ? `$${kpis.costPerLead.toFixed(2)}` : "—"
          }
          deltaPct={kpiDeltas.costPerLeadPct}
          invertDelta
          tone="indigo"
          glyph="dollar"
        />
        <IconKpi
          label="Organic sessions"
          value={kpis.organicSessions.toLocaleString()}
          deltaPct={kpiDeltas.organicSessionsPct}
          tone="primary"
          glyph="globe"
        />
      </section>

      {/* Traffic trend — full-width gradient area */}
      <Section
        eyebrow="Daily organic sessions"
        title="Traffic trend"
        className="ls-report-section"
      >
        <TrendChart data={snapshot.trafficTrend} />
      </Section>

      {/* Funnel + Lead sources side-by-side */}
      {hasFunnelData || hasSourceData ? (
        <div className="ls-report-section grid grid-cols-1 lg:grid-cols-2 gap-3">
          {hasFunnelData ? (
            <Section
              eyebrow="New lead → signed lease"
              title="Conversion funnel"
            >
              <FunnelList stages={snapshot.funnel} />
            </Section>
          ) : null}
          {hasSourceData ? (
            <Section eyebrow="Source mix" title="Lead sources">
              <SourceList sources={snapshot.leadSources} />
            </Section>
          ) : null}
        </div>
      ) : null}

      {/* Reputation section — new */}
      {snapshot.reputationStats ? (
        <ReputationSection stats={snapshot.reputationStats} />
      ) : null}

      {/* Occupancy + Renewals row — operations side-by-side */}
      {snapshot.occupancyStats || snapshot.renewalStats ? (
        <div className="ls-report-section grid grid-cols-1 lg:grid-cols-2 gap-3">
          {snapshot.occupancyStats ? (
            <OccupancySection stats={snapshot.occupancyStats} />
          ) : null}
          {snapshot.renewalStats ? (
            <RenewalSection stats={snapshot.renewalStats} />
          ) : null}
        </div>
      ) : null}

      {/* Visitor identification */}
      {snapshot.visitorStats ? (
        <VisitorSection stats={snapshot.visitorStats} />
      ) : null}

      {/* Ad performance */}
      {snapshot.adPerformance.length > 0 ? (
        <Section
          className="ls-report-section"
          eyebrow="Per platform"
          title="Paid ad performance"
        >
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
      {snapshot.attributionBySource &&
      snapshot.attributionBySource.length > 0 ? (
        <Section
          className="ls-report-section"
          eyebrow="Full pipeline by source"
          title="Where leases came from"
        >
          <Table
            columns={["Source", "Leads", "Tours", "Applications", "Signed"]}
            rows={snapshot.attributionBySource.map((r) => [
              r.source,
              r.leads.toLocaleString(),
              r.tours.toLocaleString(),
              r.applications.toLocaleString(),
              r.signed.toLocaleString(),
            ])}
          />
        </Section>
      ) : null}

      {/* Top pages + queries side-by-side */}
      {snapshot.topPages.length > 0 || snapshot.topQueries.length > 0 ? (
        <div className="ls-report-section grid grid-cols-1 lg:grid-cols-2 gap-3">
          {snapshot.topPages.length > 0 ? (
            <Section eyebrow="Organic sessions" title="Top landing pages">
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
            <Section eyebrow="Clicks and impressions" title="Top search queries">
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

      {/* Chatbot — extended if available */}
      {cb.conversations > 0 ? (
        <Section
          className="ls-report-section"
          eyebrow="Conversations and captured leads"
          title="Chatbot activity"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MiniStat
              label="Conversations"
              value={cb.conversations.toLocaleString()}
            />
            <MiniStat
              label="Leads from chat"
              value={cb.leadsFromChat.toLocaleString()}
            />
            <MiniStat
              label="Avg. messages"
              value={cb.avgMessageCount.toFixed(1)}
            />
            <MiniStat
              label="Capture rate"
              value={
                "capturedRatePct" in cb && cb.capturedRatePct != null
                  ? `${cb.capturedRatePct}%`
                  : "—"
              }
            />
          </div>
        </Section>
      ) : null}

      {/* AI visibility */}
      {snapshot.aiVisibility && snapshot.aiVisibility.brandedClicks > 0 ? (
        <AiVisibilitySection aiVisibility={snapshot.aiVisibility} />
      ) : null}

      {/* Insights */}
      {snapshot.insights.length > 0 ? (
        <Section
          className="ls-report-section"
          eyebrow="Automated insights"
          title="Signals we noticed"
        >
          <ul className="space-y-1.5">
            {snapshot.insights.map((insight) => (
              <li
                key={insight.id}
                className="rounded-xl border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={
                      "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-bold " +
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
        <Section
          className="ls-report-section"
          eyebrow="Leads and occupancy"
          title="By property"
        >
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
// Hero gradient KPI — pulls the period's headline metric (leads) into a
// large gradient number, mirroring the property dashboard treatment.
// ---------------------------------------------------------------------------

function HeroKpi({ snapshot }: { snapshot: ReportSnapshot }) {
  const { kpis, kpiDeltas } = snapshot;

  // Pick the most narratively useful headline for this period: prefer leads
  // if positive, fall back to organic if leads are zero.
  const useLeads = kpis.leads > 0 || kpis.organicSessions === 0;
  const headlineLabel = useLeads
    ? "Total leads this period"
    : "Organic sessions this period";
  const headlineValue = useLeads
    ? kpis.leads.toLocaleString()
    : kpis.organicSessions.toLocaleString();
  const headlineDelta = useLeads
    ? kpiDeltas.leadsPct
    : kpiDeltas.organicSessionsPct;

  const subline = useLeads
    ? `${kpis.tours} tours · ${kpis.applications} applications · $${kpis.adSpendUsd.toLocaleString()} ad spend`
    : `${kpis.leads} leads · ${kpis.tours} tours · $${kpis.adSpendUsd.toLocaleString()} ad spend`;

  return (
    <section className="ls-report-section rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            {headlineLabel}
          </p>
          <p
            className="mt-1 text-[40px] md:text-[52px] leading-none font-bold tracking-tight tabular-nums"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #1D4ED8 0%, #2563EB 35%, #3B82F6 70%, #60A5FA 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {headlineValue}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">{subline}</p>
        </div>
        {headlineDelta != null ? (
          <DeltaPill value={headlineDelta} large />
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// New sections
// ---------------------------------------------------------------------------

function ReputationSection({ stats }: { stats: ReportReputationStats }) {
  return (
    <Section
      className="ls-report-section"
      eyebrow={`${stats.totalReviews.toLocaleString()} lifetime reviews`}
      title="Reputation pulse"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
        {/* Big rating + new + sentiment */}
        <div className="flex flex-col gap-3 min-w-[200px]">
          <div className="flex items-baseline gap-2">
            <span className="text-[44px] leading-none font-bold tabular-nums tracking-tight text-foreground">
              {stats.overallRating != null
                ? stats.overallRating.toFixed(1)
                : "—"}
            </span>
            <span className="text-[20px] text-amber-400" aria-hidden="true">
              ★
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat
              label="New"
              value={stats.newInPeriod.toLocaleString()}
            />
            <MiniStat
              label="Positive"
              value={stats.positiveCount.toLocaleString()}
            />
            <MiniStat
              label="Response"
              value={
                stats.responseRatePct != null
                  ? `${stats.responseRatePct}%`
                  : "—"
              }
            />
          </div>
        </div>

        {/* Source breakdown */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
            Where reviews land
          </div>
          {stats.sourceBreakdown.slice(0, 6).map((row) => {
            const total = stats.totalReviews || 1;
            const pct = Math.round((row.count / total) * 100);
            return (
              <div
                key={row.source}
                className="grid grid-cols-[80px_1fr_50px_50px] items-center gap-2 text-[11px]"
              >
                <span className="font-semibold text-foreground truncate">
                  {row.source}
                </span>
                <span className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: C.primary,
                    }}
                  />
                </span>
                <span className="text-right tabular-nums text-foreground font-semibold">
                  {row.count.toLocaleString()}
                </span>
                <span className="text-right tabular-nums text-foreground">
                  {row.rating != null ? `${row.rating.toFixed(1)}★` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent mentions */}
      {stats.topMentions.length > 0 ? (
        <div className="mt-4 pt-3 border-t border-border space-y-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Recent mentions
          </div>
          {stats.topMentions.slice(0, 3).map((m, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card/50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-semibold text-foreground">
                  {m.source}
                  {m.rating != null ? ` · ${m.rating.toFixed(1)}★` : ""}
                </span>
                {m.publishedAt ? (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatDate(new Date(m.publishedAt))}
                  </span>
                ) : null}
              </div>
              <p className="text-[12px] text-foreground leading-snug">
                {m.excerpt}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function OccupancySection({ stats }: { stats: ReportOccupancyStats }) {
  const occ = stats.occupancyPct ?? 0;
  return (
    <Section
      eyebrow="Live · AppFolio"
      title="Occupancy snapshot"
    >
      <div className="grid grid-cols-[auto_1fr] items-center gap-4">
        <Donut pct={occ} label={`${occ}%`} sublabel="Occupied" />
        <div className="space-y-1.5 text-[11px] min-w-0">
          <KvLine k="Leased" v={stats.leasedUnits.toLocaleString()} dot={C.primary} />
          <KvLine
            k="Available"
            v={stats.availableUnits.toLocaleString()}
            dot={C.primaryFaint}
          />
          <KvLine
            k="On notice"
            v={stats.onNotice.toLocaleString()}
            dot={C.muted}
          />
          <KvLine
            k="Apps queued"
            v={stats.applicationsQueued.toLocaleString()}
            dot={C.violet}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat
          label="Monthly rent roll"
          value={`$${stats.monthlyRentRollUsd.toLocaleString()}`}
        />
        <MiniStat
          label="Avg rent / unit"
          value={
            stats.avgRentPerUnitUsd != null
              ? `$${stats.avgRentPerUnitUsd.toLocaleString()}`
              : "—"
          }
        />
      </div>
    </Section>
  );
}

function RenewalSection({ stats }: { stats: ReportRenewalStats }) {
  return (
    <Section eyebrow="Next 120 days" title="Renewal pipeline">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat
          label="Active leases"
          value={stats.activeLeases.toLocaleString()}
        />
        <MiniStat
          label="Expiring (120d)"
          value={stats.expiringNext120.toLocaleString()}
        />
        <MiniStat
          label="In 30 days"
          value={stats.expiringNext30.toLocaleString()}
        />
      </div>
      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">
            Monthly rent roll at risk
          </p>
          <span className="text-[18px] font-bold tabular-nums text-blue-700">
            ${stats.monthlyAtRiskUsd.toLocaleString()}
          </span>
        </div>
        <p className="text-[10px] text-blue-700/80">
          Cumulative rent across leases ending in the next 120 days.
        </p>
      </div>
      {stats.pastDueCount > 0 ? (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700">
              Past-due
            </p>
            <span className="text-[14px] font-bold tabular-nums text-rose-700">
              {stats.pastDueCount} · $
              {stats.pastDueBalanceUsd.toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function VisitorSection({ stats }: { stats: ReportVisitorStats }) {
  return (
    <Section
      className="ls-report-section"
      eyebrow="Pixel identification"
      title="Website visitors identified"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-3 items-center">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat
            label="Identified"
            value={stats.identifiedVisitors.toLocaleString()}
          />
          <MiniStat
            label="New (period)"
            value={stats.identifiedNewInPeriod.toLocaleString()}
          />
          <MiniStat
            label="With email"
            value={stats.withEmail.toLocaleString()}
          />
          <MiniStat
            label="Matched lead"
            value={stats.identifiedWithLead.toLocaleString()}
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
            New identifications · daily
          </div>
          <TrendChart data={stats.identifiedTrend} compact />
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// AI sections (unchanged structure, restyled)
// ---------------------------------------------------------------------------

function AiAnalysisSection({ analysis }: { analysis: AiAnalysis }) {
  return (
    <section aria-label="AI analysis" className="ls-report-section">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-b border-border flex items-center gap-2">
          <span className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
            AI analysis · recommended actions
          </span>
        </div>
        <div className="p-4 pt-3 space-y-3">
          <div className="border-l-2 border-primary bg-primary/5 px-3 py-2 rounded-r-md">
            <p className="text-sm text-foreground leading-snug">
              {analysis.summary}
            </p>
          </div>
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
        ? "bg-blue-400"
        : "bg-blue-200";
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColor}`}
        />
        <span className="text-sm font-semibold text-foreground leading-tight">
          {item.title}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-1">
        {item.observation}
      </p>
      <p className="text-xs text-primary leading-relaxed font-semibold">
        {item.action}
      </p>
    </div>
  );
}

function AiVisibilitySection({
  aiVisibility,
}: {
  aiVisibility: ReportAiVisibility;
}) {
  return (
    <Section
      className="ls-report-section"
      eyebrow="Branded search performance"
      title="AI search visibility"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat
            label="Branded clicks"
            value={aiVisibility.brandedClicks.toLocaleString()}
          />
          <MiniStat
            label="Branded impr."
            value={aiVisibility.brandedImpressions.toLocaleString()}
          />
          <MiniStat
            label="Branded share"
            value={`${aiVisibility.brandedShare}%`}
          />
        </div>
        {aiVisibility.topBrandedTerms.length > 0 ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5">
              Top branded terms
            </div>
            <div className="flex flex-wrap gap-1.5">
              {aiVisibility.topBrandedTerms.map((term) => (
                <span
                  key={term}
                  className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Branded search clicks reflect how often people search for the
          property by name. Growing this also improves visibility in
          AI-powered recommendations.
        </p>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Section({
  title,
  eyebrow,
  className = "",
  children,
}: {
  title: string;
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={"rounded-2xl border border-border bg-card " + className}>
      <header className="px-4 pt-4">
        {eyebrow ? (
          <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-0.5">
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

type IconKpiTone = "primary" | "violet" | "emerald" | "indigo" | "amber";

function IconKpi({
  label,
  value,
  deltaPct,
  invertDelta = false,
  tone = "primary",
  glyph,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  invertDelta?: boolean;
  tone?: IconKpiTone;
  glyph?: "target" | "calendar" | "check" | "dollar" | "globe";
}) {
  const tones: Record<IconKpiTone, string> = {
    primary: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {glyph ? (
            <span
              className={"h-7 w-7 rounded-lg flex items-center justify-center shrink-0 " + tones[tone]}
              aria-hidden="true"
            >
              <Glyph name={glyph} />
            </span>
          ) : null}
          <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground truncate">
            {label}
          </p>
        </div>
        {deltaPct != null ? (
          <DeltaPill value={deltaPct} invert={invertDelta} />
        ) : null}
      </div>
      <p className="mt-2 text-[20px] leading-none font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function Glyph({ name }: { name: "target" | "calendar" | "check" | "dollar" | "globe" }) {
  const stroke = 2;
  const sz = 14;
  const path: Record<typeof name, React.ReactNode> = {
    target: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    check: (
      <>
        <polyline points="20 6 9 17 4 12" />
      </>
    ),
    dollar: (
      <>
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="M17 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  };
  return (
    <svg
      width={sz}
      height={sz}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path[name]}
    </svg>
  );
}

function DeltaPill({
  value,
  invert = false,
  large = false,
}: {
  value: number;
  invert?: boolean;
  large?: boolean;
}) {
  const goodDirection = invert ? value < 0 : value > 0;
  const flat = value === 0;
  const tone = flat
    ? "bg-slate-100 text-slate-600"
    : goodDirection
      ? "bg-emerald-50 text-emerald-700"
      : "bg-rose-50 text-rose-700";
  const sz = large
    ? "px-3 py-1.5 text-[14px]"
    : "px-1.5 py-0.5 text-[10px]";
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 rounded-md font-bold tabular-nums " +
        tone +
        " " +
        sz
      }
    >
      {value >= 0 ? "+" : ""}
      {value}%
    </span>
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
            <span className="w-32 shrink-0 text-xs text-muted-foreground">
              {s.stage}
            </span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: C.primary }}
              />
            </div>
            <span className="w-10 text-right text-xs font-bold tabular-nums text-foreground">
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
  const max = Math.max(1, ...sources.map((s) => s.count));
  return (
    <ul className="space-y-1.5">
      {sources.map((row) => {
        const pct = Math.round((row.count / max) * 100);
        return (
          <li key={row.source} className="grid grid-cols-[1fr_auto_30px] gap-2 items-center">
            <div>
              <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
                <span className="text-foreground font-medium truncate">
                  {row.source}
                </span>
                <span className="text-foreground font-bold tabular-nums">
                  {row.count.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: C.primary }}
                />
              </div>
            </div>
            <span />
            <span className="text-xs text-muted-foreground tabular-nums text-right">
              {row.pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Table({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                className={
                  "text-[10px] tracking-widest uppercase font-bold text-muted-foreground pb-1.5 border-b border-border " +
                  (i === 0 ? "text-left" : "text-right")
                }
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
                    (i === 0
                      ? "text-foreground font-medium text-left"
                      : "text-foreground text-right")
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
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function Donut({
  pct,
  label,
  sublabel,
}: {
  pct: number;
  label: string;
  sublabel?: string;
}) {
  const size = 120;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, pct / 100));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={C.border}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={C.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${fraction * circ} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {sublabel ? (
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">
            {sublabel}
          </span>
        ) : null}
        <span className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground tabular-nums leading-none">
          {label}
        </span>
      </div>
    </div>
  );
}

function KvLine({ k, v, dot }: { k: string; v: string; dot: string }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="flex items-center gap-1.5 min-w-0">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: dot }}
        />
        <span className="truncate text-foreground">{k}</span>
      </span>
      <span className="tabular-nums font-bold text-foreground shrink-0">
        {v}
      </span>
    </div>
  );
}

function TrendChart({
  data,
  compact = false,
}: {
  data: number[];
  compact?: boolean;
}) {
  if (data.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Not enough data for a trend chart yet.
      </p>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 800;
  const height = compact ? 60 : 100;
  const stepX = width / (data.length - 1);
  // Smooth via simple cubic interpolation for the polished look.
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y] as const;
  });
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const areaPath = d + ` L ${width},${height} L 0,${height} Z`;
  const gradId = `ls-trend-${data.length}-${compact ? "c" : "f"}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={compact ? "w-full h-14" : "w-full h-24"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
          <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={d}
        fill="none"
        stroke={C.primary}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function severityTone(severity: string): string {
  if (severity === "critical") return "bg-rose-50 text-rose-700";
  if (severity === "warning") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
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
