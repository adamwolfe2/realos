import * as React from "react";
import type {
  AiAnalysis,
  DataSourceStatus,
  ReportAiVisibility,
  ReportDataSources,
  ReportOccupancyStats,
  ReportRenewalStats,
  ReportReputationMention,
  ReportReputationStats,
  ReportSnapshot,
  ReportVisitorStats,
} from "@/lib/reports/generate";
import {
  sanitizeMentionExcerpt,
  isExcerptTruncated,
} from "@/lib/reports/sanitize-excerpt";
import {
  ReportTabs,
  ReportTabPanel,
} from "@/components/portal/reports/report-tabs";

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
// Ink (previously near-black #0F172A) retargets to brand blue so any
// future caller pulling C.ink renders blue-on-white, not black-on-white.
// Keep `text` as the only "actually dark" token for body copy in PDFs.
const C = {
  primary: "#1D4ED8",
  primaryMid: "#2563EB",
  primaryLight: "#3B82F6",
  primaryFaint: "#93C5FD",
  primaryGhost: "#DBEAFE",
  indigo: "#2563EB",
  ink: "#2563EB",
  text: "#0F172A",
  muted: "#94A3B8",
  border: "#E5E7EB",
  positive: "#2563EB",
  negative: "#DC2626",
  amber: "#60A5FA",
  rose: "#1E40AF",
  violet: "#3B82F6",
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

  // Data source gates — never render fake numbers for disconnected
  // integrations. When dataSources is undefined (legacy snapshot),
  // fall back to "show everything" so older shared reports don't
  // suddenly hide sections.
  const ds = snapshot.dataSources;
  const adsConnected = ds
    ? ds.googleAds.connected || ds.metaAds.connected
    : true;
  const ga4Connected = ds ? ds.ga4.connected : true;
  const gscConnected = ds ? ds.gsc.connected : true;
  const appfolioConnected = ds ? ds.appfolio.connected : true;
  const pixelConnected = ds ? ds.pixel.connected : true;
  const chatbotConnected = ds ? ds.chatbot.connected : true;
  // Tours show only when we have tour data anywhere in the snapshot
  // (operator-tracked tours OR AppFolio mirror). Pure leads-only orgs
  // shouldn't see a "0 tours" tile that implies a tracking gap.
  const toursTracked =
    appfolioConnected || kpis.tours > 0 || (kpiDeltas.toursPct ?? 0) !== 0;
  const applicationsTracked =
    appfolioConnected ||
    kpis.applications > 0 ||
    (kpiDeltas.applicationsPct ?? 0) !== 0;
  const showCostPerLead = adsConnected && kpis.adSpendUsd > 0;

  return (
    <article className="space-y-4 report-article ls-report">
      {/* Print-only branded header. Hidden on screen via the
          `print-only-header` class (CSS in [id]/page.tsx). In print this
          renders as the first thing on page 1 — wordmark + org name +
          report kind + period — so the PDF opens with a clear,
          self-contained title block instead of jumping straight into
          the metric tiles. */}
      <header
        className="print-only-header"
        style={{
          display: "none",
          paddingBottom: "12pt",
          marginBottom: "10pt",
          borderBottom: "1pt solid #E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16pt",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "9pt",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#2563EB",
                fontWeight: 700,
                marginBottom: "4pt",
              }}
            >
              LeaseStack · {kindLabel}
            </div>
            <h1
              style={{
                fontSize: "22pt",
                fontWeight: 700,
                color: "#0F172A",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {orgName ?? "Performance review"}
            </h1>
            <p
              style={{
                fontSize: "10.5pt",
                color: "#4B5563",
                marginTop: "4pt",
                marginBottom: 0,
              }}
            >
              {snapshot.scope?.propertyName
                ? `${snapshot.scope.propertyName} · ${periodLabel}`
                : `Portfolio · all properties · ${periodLabel}`}
            </p>
          </div>
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogoUrl}
              alt={orgName ?? "Logo"}
              style={{ height: "42pt", width: "auto", objectFit: "contain" }}
            />
          ) : null}
        </div>
        {headline || notes ? (
          <div
            style={{
              marginTop: "10pt",
              paddingTop: "8pt",
              borderTop: "1pt solid #E5E7EB",
            }}
          >
            {headline ? (
              <p
                style={{
                  fontSize: "11.5pt",
                  fontWeight: 600,
                  color: "#0F172A",
                  margin: "0 0 4pt",
                }}
              >
                {headline}
              </p>
            ) : null}
            {notes ? (
              <p
                style={{
                  fontSize: "10pt",
                  color: "#4B5563",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                }}
              >
                {notes}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

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

      <ReportTabs>
        <ReportTabPanel id="overview">
      {/* Hero gradient KPI block — anchors the page like the dashboard */}
      <HeroKpi snapshot={snapshot} />

      {/* AI analysis */}
      {snapshot.aiAnalysis ? (
        <AiAnalysisSection analysis={snapshot.aiAnalysis} />
      ) : null}

      {/* KPI strip — show a card only when (a) the value is non-zero,
          (b) the prior-period delta is non-zero (so we can show a
          drop), OR (c) it's the always-anchored Leads card. A card full
          of zeros gives the operator no signal and crowds the strip;
          when every card would be zero, the empty-state below replaces
          the strip entirely. */}
      {(() => {
        const showTours =
          toursTracked && (kpis.tours > 0 || (kpiDeltas.toursPct ?? 0) !== 0);
        const showApplications =
          applicationsTracked &&
          (kpis.applications > 0 ||
            (kpiDeltas.applicationsPct ?? 0) !== 0);
        const showCpl =
          showCostPerLead &&
          (kpis.costPerLead != null ||
            (kpiDeltas.costPerLeadPct ?? 0) !== 0);
        const showOrganic =
          ga4Connected &&
          (kpis.organicSessions > 0 ||
            (kpiDeltas.organicSessionsPct ?? 0) !== 0);

        const allZero =
          kpis.leads === 0 &&
          (kpiDeltas.leadsPct ?? 0) === 0 &&
          !showTours &&
          !showApplications &&
          !showCpl &&
          !showOrganic;

        if (allZero) {
          return (
            <EmptyTabState
              title="Quiet period"
              body="No new leads, tours, applications, or organic sessions recorded for this window. Connected data sources reported zero activity — not a tracking issue."
            />
          );
        }

        return (
          <section
            aria-label="Key metrics"
            className="ls-report-section grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2"
          >
            <IconKpi
              label="Leads"
              value={kpis.leads.toLocaleString()}
              deltaPct={kpiDeltas.leadsPct}
              tone="primary"
              glyph="target"
            />
            {showTours ? (
              <IconKpi
                label="Tours"
                value={kpis.tours.toLocaleString()}
                deltaPct={kpiDeltas.toursPct}
                tone="primary"
                glyph="calendar"
              />
            ) : null}
            {showApplications ? (
              <IconKpi
                label="Applications"
                value={kpis.applications.toLocaleString()}
                deltaPct={kpiDeltas.applicationsPct}
                tone="primary"
                glyph="check"
              />
            ) : null}
            {showCpl ? (
              <IconKpi
                label="Cost / lead"
                value={
                  kpis.costPerLead != null
                    ? `$${kpis.costPerLead.toFixed(2)}`
                    : "—"
                }
                deltaPct={kpiDeltas.costPerLeadPct}
                invertDelta
                tone="primary"
                glyph="dollar"
              />
            ) : null}
            {showOrganic ? (
              <IconKpi
                label="Organic sessions"
                value={kpis.organicSessions.toLocaleString()}
                deltaPct={kpiDeltas.organicSessionsPct}
                tone="primary"
                glyph="globe"
              />
            ) : null}
          </section>
        );
      })()}
        </ReportTabPanel>

        <ReportTabPanel id="traffic">
          {/* Traffic trend — full-width gradient area. Only render when
              GA4 is connected; otherwise the "0 sessions" line is
              misleading. */}
          {ga4Connected && snapshot.trafficTrend.some((v) => v > 0) ? (
            <Section
              eyebrow="Daily organic sessions"
              title="Traffic trend"
              className="ls-report-section"
            >
              <TrendChart data={snapshot.trafficTrend} />
            </Section>
          ) : null}

          {/* Funnel + Lead sources side-by-side. */}
          {hasFunnelData || hasSourceData ? (
            <div className="ls-report-section grid grid-cols-1 lg:grid-cols-2 gap-3">
              {hasFunnelData ? (
                <Section
                  eyebrow="New lead → signed lease"
                  title="Conversion funnel"
                >
                  <FunnelList
                    stages={snapshot.funnel.filter((s) => {
                      if (s.stage === "New") return true;
                      const isTourStage =
                        s.stage === "Tour scheduled" || s.stage === "Toured";
                      const isAppStage =
                        s.stage === "Applied" ||
                        s.stage === "Application sent" ||
                        s.stage === "Approved";
                      if (isTourStage && !toursTracked && s.count === 0)
                        return false;
                      if (isAppStage && !applicationsTracked && s.count === 0)
                        return false;
                      return true;
                    })}
                  />
                </Section>
              ) : null}
              {hasSourceData ? (
                <Section eyebrow="Source mix" title="Lead sources">
                  <SourceList sources={snapshot.leadSources} />
                </Section>
              ) : null}
            </div>
          ) : null}

          {/* Ad performance */}
          {snapshot.adPerformance.length > 0 && adsConnected ? (
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
                  r.conversionRate != null
                    ? `${r.conversionRate.toFixed(1)}%`
                    : "—",
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
          {(snapshot.topPages.length > 0 && ga4Connected) ||
          (snapshot.topQueries.length > 0 && gscConnected) ? (
            <div className="ls-report-section grid grid-cols-1 lg:grid-cols-2 gap-3">
              {snapshot.topPages.length > 0 && ga4Connected ? (
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
              {snapshot.topQueries.length > 0 && gscConnected ? (
                <Section
                  eyebrow="Clicks and impressions"
                  title="Top search queries"
                >
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
        </ReportTabPanel>

        <ReportTabPanel id="operations">
          {/* Occupancy + Renewals row — both AppFolio-dependent; gated so
              a marketing-only tenant doesn't see "Live · AppFolio" panels
              with stale numbers. */}
          {appfolioConnected &&
          (snapshot.occupancyStats || snapshot.renewalStats) ? (
            <div className="ls-report-section grid grid-cols-1 lg:grid-cols-2 gap-3">
              {snapshot.occupancyStats ? (
                <OccupancySection stats={snapshot.occupancyStats} />
              ) : null}
              {snapshot.renewalStats ? (
                <RenewalSection stats={snapshot.renewalStats} />
              ) : null}
            </div>
          ) : null}

          {/* Visitor identification — only when the pixel is firing. */}
          {snapshot.visitorStats && pixelConnected ? (
            <VisitorSection stats={snapshot.visitorStats} />
          ) : null}

          {/* Chatbot — extended if available. */}
          {chatbotConnected && cb.conversations > 0 ? (
            <Section
              className="ls-report-section"
              eyebrow="Conversations and captured leads"
              title="Chatbot activity"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
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
        </ReportTabPanel>

        <ReportTabPanel id="reputation">
          {snapshot.reputationStats ? (
            <ReputationSection stats={snapshot.reputationStats} />
          ) : (
            <EmptyTabState
              title="No reputation data yet"
              body="Connect Google Business Profile, Yelp, or your reputation source to see reviews and mentions in this report."
            />
          )}
        </ReportTabPanel>

        <ReportTabPanel id="insights">
          {snapshot.aiVisibility && snapshot.aiVisibility.brandedClicks > 0 ? (
            <AiVisibilitySection aiVisibility={snapshot.aiVisibility} />
          ) : null}

          {snapshot.insights.length > 0 ? (
            <Section
              className="ls-report-section"
              eyebrow="Automated insights"
              title="Signals we noticed"
            >
              <GroupedInsights items={snapshot.insights} />
            </Section>
          ) : !(
              snapshot.aiVisibility && snapshot.aiVisibility.brandedClicks > 0
            ) ? (
            <EmptyTabState
              title="No automated insights this period"
              body="LeaseStack scans your data every day. Insights appear here when something material changes — a CPL spike, a pricing outlier, a pipeline stall."
            />
          ) : null}
        </ReportTabPanel>
      </ReportTabs>

      {/* Data sources — small transparency footer so clients know
          exactly what's flowing into the report. Builds trust:
          they can see GA4 ✓, Pixel ✓, Google Ads — Not connected,
          and have a clear read on which integration to wire up
          next without us having to call it out separately. */}
      {ds ? <DataSourcesFooter sources={ds} /> : null}

      {publicFraming ? (
        <footer className="pt-2 text-center text-[11px] text-muted-foreground">
          Generated by LeaseStack on behalf of {orgName ?? "your operator"}.
        </footer>
      ) : null}
    </article>
  );
}

function DataSourcesFooter({ sources }: { sources: ReportDataSources }) {
  const rows: Array<{ label: string; status: DataSourceStatus }> = [
    { label: "Google Ads", status: sources.googleAds },
    { label: "Meta Ads", status: sources.metaAds },
    { label: "Google Analytics 4", status: sources.ga4 },
    { label: "Google Search Console", status: sources.gsc },
    { label: "Cursive Pixel", status: sources.pixel },
    { label: "AppFolio", status: sources.appfolio },
    { label: "Chatbot", status: sources.chatbot },
  ];

  return (
    <Section
      className="ls-report-section"
      eyebrow="Transparency"
      title="Data sources"
    >
      <p className="text-xs text-muted-foreground mb-3">
        We only show metrics for sources that are actively connected and
        producing data. Sections you don&apos;t see in this report belong
        to integrations that aren&apos;t connected yet.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/60 px-2.5 py-1.5"
          >
            <span className="text-[11px] font-medium text-foreground truncate">
              {r.label}
            </span>
            {r.status.connected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                Not connected
              </span>
            )}
          </div>
        ))}
      </div>
    </Section>
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
            <span className="text-[20px] text-primary" aria-hidden="true">
              ★
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

      {/* Highlights — top 3 by default, the rest behind an expander.
          A full dump of 42 reviews in the report is a wall of text;
          the curated top 3 are the marketing-brag the operator cares
          about. */}
      {(stats.highlights ?? []).length > 0 ? (
        <MentionGroup
          title="Highlights"
          subtitle="What residents are saying — by sentiment + 4.5★+ reviews"
          mentions={stats.highlights!}
          defaultLimit={3}
        />
      ) : null}

      {/* Concerns — show all by default. Negatives are action items;
          we don't want to bury any of them. */}
      {(stats.concerns ?? []).length > 0 ? (
        <MentionGroup
          title="Needs attention"
          subtitle="Negative sentiment + 3★ or below + flagged threads"
          mentions={stats.concerns!}
          variant="concern"
        />
      ) : null}

      {/* Recent — top 4 by default. Operators dig in to the full
          feed only when investigating a specific spike. */}
      {(stats.recent ?? stats.topMentions).length > 0 ? (
        <MentionGroup
          title="Recent mentions"
          subtitle="Most recent reviews + posts across Google, Reddit, Yelp, and the web"
          mentions={stats.recent ?? stats.topMentions}
          defaultLimit={4}
        />
      ) : null}
    </Section>
  );
}

// MentionGroup — a labeled stack of full mention cards. Used by the
// report's reputation section for highlights / concerns / recent.
//
// Renders the actual review/post body (not a snippet), the author,
// the date, the sentiment, the source, and a click-out link to the
// original. Server-component-safe — no fetch, no interactivity beyond
// the link itself.
function MentionGroup({
  title,
  subtitle,
  mentions,
  variant = "neutral",
  /**
   * Show only the first N mentions by default. Remaining mentions are
   * tucked into a native <details> expander so the on-screen view stays
   * scannable while the print/PDF includes every row (handled by the
   * tab-strip print CSS that force-opens details). When undefined, all
   * mentions render expanded — used for the "Concerns" group where
   * burying negatives would defeat the purpose.
   */
  defaultLimit,
}: {
  title: string;
  subtitle: string;
  mentions: ReportReputationMention[];
  variant?: "neutral" | "concern";
  defaultLimit?: number;
}) {
  const limit =
    defaultLimit != null && mentions.length > defaultLimit
      ? defaultLimit
      : mentions.length;
  const head = mentions.slice(0, limit);
  const tail = mentions.slice(limit);

  return (
    <div className="mt-4 pt-3 border-t border-border space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          {title}
        </div>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
          {subtitle}
        </p>
      </div>
      <div className="space-y-2.5">
        {head.map((m) => (
          <ReportMentionCard key={m.id} mention={m} variant={variant} />
        ))}
      </div>
      {tail.length > 0 ? (
        <details className="ls-mention-expander group rounded-xl border border-dashed border-border bg-card/30">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-primary hover:bg-muted/30">
            <span className="group-open:hidden">
              View {tail.length} more →
            </span>
            <span className="hidden group-open:inline text-muted-foreground">
              Hide additional mentions
            </span>
          </summary>
          <div className="space-y-2.5 px-3 pb-3 pt-1 border-t border-border bg-muted/10">
            {tail.map((m) => (
              <ReportMentionCard key={m.id} mention={m} variant={variant} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ReportMentionCard({
  mention: m,
  variant,
}: {
  mention: ReportReputationMention;
  variant: "neutral" | "concern";
}) {
  const sentimentTone =
    m.sentiment === "POSITIVE"
      ? "bg-primary/10 text-primary border-primary/20"
      : m.sentiment === "NEGATIVE"
        ? "bg-primary text-primary-foreground border-primary"
        : m.sentiment === "MIXED"
          ? "bg-muted text-foreground border-border"
          : "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        variant === "concern"
          ? "border-primary/20 bg-primary/5"
          : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold tracking-wide text-foreground uppercase">
              {m.source}
            </span>
            {m.rating != null ? (
              <span className="text-[11px] font-semibold text-primary">
                {"★".repeat(Math.round(m.rating))}
                <span className="text-primary/40">
                  {"★".repeat(Math.max(0, 5 - Math.round(m.rating)))}
                </span>
                <span className="ml-1 text-foreground/70">
                  {m.rating.toFixed(1)}
                </span>
              </span>
            ) : null}
            {m.sentiment ? (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${sentimentTone}`}
              >
                {m.sentiment.toLowerCase()}
              </span>
            ) : null}
            {m.flagged ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border bg-primary text-primary-foreground border-primary">
                Flagged
              </span>
            ) : null}
          </div>
          {m.title ? (
            <h4 className="mt-1.5 text-[13px] font-semibold text-foreground leading-snug">
              {m.title}
            </h4>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          {m.publishedAt ? (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatDate(new Date(m.publishedAt))}
            </div>
          ) : null}
          {m.authorName ? (
            <div className="text-[10px] text-muted-foreground/80 mt-0.5">
              {m.authorName}
            </div>
          ) : null}
        </div>
      </div>
      {/* Sanitized 240-char preview. Raw excerpts can come from full-page
          web scrapes (BBB / ApartmentRatings / etc) that include site
          nav, footers, and table-of-contents bullets — rendering them
          verbatim destroyed the report's credibility. The sanitizer
          strips markdown chrome and nav junk; if content was clipped, a
          "Read full →" link to sourceUrl is the user's affordance for
          the complete content. */}
      {m.excerpt ? (
        <p className="mt-2 text-[12px] text-foreground/90 leading-relaxed line-clamp-3">
          {sanitizeMentionExcerpt(m.excerpt)}
          {isExcerptTruncated(m.excerpt) && m.sourceUrl ? (
            <>
              {" "}
              <a
                href={m.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline underline-offset-2"
              >
                Read full →
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {m.topics && m.topics.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {m.topics.map((t: string) => (
            <span
              key={t}
              className="text-[9px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-background/60"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {m.sourceUrl ? (
        <a
          href={m.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline underline-offset-2"
        >
          Open on {m.source.toLowerCase()} →
        </a>
      ) : null}
    </div>
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
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        <div className="mt-2 rounded-xl border border-primary bg-primary p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
              Past-due
            </p>
            <span className="text-[14px] font-bold tabular-nums text-primary-foreground">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
      ? "bg-primary"
      : item.priority === "medium"
        ? "bg-primary/70"
        : "bg-primary/30";
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

type IconKpiTone = "primary" | "muted";

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
    primary: "bg-primary/10 text-primary",
    muted: "bg-muted text-foreground",
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
    ? "bg-muted text-muted-foreground"
    : goodDirection
      ? "bg-primary/10 text-primary"
      : "bg-primary text-primary-foreground";
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
      {stages.map((s, i) => {
        const pct = Math.round((s.count / max) * 100);
        return (
          <li key={s.stage} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-muted-foreground">
              {s.stage}
            </span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: C.primary,
                  transformOrigin: "left center",
                  transform: "scaleX(0)",
                  animation:
                    "ls-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  animationDelay: `${200 + i * 90}ms`,
                }}
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
      {sources.map((row, i) => {
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
                  style={{
                    width: `${pct}%`,
                    backgroundColor: C.primary,
                    transformOrigin: "left center",
                    transform: "scaleX(0)",
                    animation:
                      "ls-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    animationDelay: `${200 + i * 90}ms`,
                  }}
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
      <path
        d={areaPath}
        fill={`url(#${gradId})`}
        // Fade in the gradient fill so the area appears after the
        // stroke draws.
        style={{
          opacity: 0,
          animation: "ls-fade-in 800ms ease-out 700ms forwards",
        }}
      />
      <path
        d={d}
        fill="none"
        stroke={C.primary}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        // Draw the line left-to-right via stroke-dashoffset animation.
        // Uses ls-draw keyframe added to globals.css for the auth
        // showcase — same primitive, so adding it here doesn't ship
        // any new CSS.
        style={{
          strokeDasharray: 2400,
          strokeDashoffset: 2400,
          animation: "ls-draw 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      />
    </svg>
  );
}

function EmptyTabState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="ls-report-section rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupedInsights — collapses repetitive insight rows into a single summary
// row with an expandable details panel. Operators were seeing 17 identical
// "X rent is N% below portfolio average" rows; that's one signal, not 17.
//
// Grouping rule: when ≥ 3 insights share the same (kind, severity), they
// collapse into one summary card. Click expands the inline list using a
// native <details> element so the report stays server-rendered + print-safe
// (print CSS forces [open] so PDFs include everything).
// ---------------------------------------------------------------------------

type InsightItem = ReportSnapshot["insights"][number];

const GROUP_MIN = 3;

function groupKey(item: InsightItem): string {
  return `${item.kind}::${item.severity}`;
}

function summarizeGroup(kind: string, severity: string, count: number): {
  title: string;
  body: string;
} {
  switch (kind) {
    case "portfolio_outlier":
      if (severity === "info") {
        return {
          title: `${count} properties priced below portfolio average`,
          body: "Renewing closer to the portfolio average could lift monthly rent roll. Open each to see the per-property gap and suggested move.",
        };
      }
      return {
        title: `${count} properties priced above portfolio with open vacancy`,
        body: "These may be priced above what the local market is absorbing. Open each to see vacancy + suggested concession.",
      };
    case "pipeline_stall":
      return {
        title: `${count} leads stuck in pipeline`,
        body: "These leads haven't moved status in a while. Open each to see who they are and the suggested next step.",
      };
    case "negative_review":
      return {
        title: `${count} new negative reviews`,
        body: "Reviews 3 stars or lower posted this period. Open each to draft a response.",
      };
    case "hot_visitor":
      return {
        title: `${count} hot visitors flagged`,
        body: "High-intent identified visitors who haven't converted to a lead yet.",
      };
    case "keyword_drop":
      return {
        title: `${count} keywords lost ranking`,
        body: "Queries that previously drove traffic dropped position this period.",
      };
    case "vacancy_needs_boost":
      return {
        title: `${count} vacancies need a boost`,
        body: "Units sitting longer than typical days-on-market for the portfolio.",
      };
    case "cpl_spike":
      return {
        title: `${count} cost-per-lead spikes`,
        body: "Ad sources where cost-per-lead is materially above the running baseline.",
      };
    case "wasted_ad_spend":
      return {
        title: `${count} ad spend leaks`,
        body: "Campaigns spending without converting at the portfolio benchmark.",
      };
    case "renewal_cliff":
      return {
        title: `${count} renewal cliffs ahead`,
        body: "Concentrations of lease expirations that need outreach now.",
      };
    case "tour_noshow_spike":
      return {
        title: `${count} tour no-show spikes`,
        body: "Properties where the no-show rate jumped over the baseline.",
      };
    case "chatbot_silence":
      return {
        title: `${count} chatbot silences`,
        body: "Periods where chatbot capture rate dropped below baseline.",
      };
    default:
      return {
        title: `${count} ${kind.replace(/_/g, " ")} alerts`,
        body: "Open to see the full list.",
      };
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={
        "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-bold " +
        severityTone(severity)
      }
    >
      {severity}
    </span>
  );
}

function InsightRow({ insight }: { insight: InsightItem }) {
  return (
    <li className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <SeverityBadge severity={insight.severity} />
        <span className="text-sm font-semibold text-foreground">
          {insight.title}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {insight.body}
      </p>
    </li>
  );
}

function GroupedInsights({ items }: { items: InsightItem[] }) {
  // Preserve original order; bucket by (kind, severity).
  const order: string[] = [];
  const buckets = new Map<string, InsightItem[]>();
  for (const item of items) {
    const key = groupKey(item);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }

  return (
    <ul className="space-y-1.5">
      {order.flatMap((key) => {
        const group = buckets.get(key)!;
        if (group.length < GROUP_MIN) {
          return group.map((insight) => (
            <InsightRow key={insight.id} insight={insight} />
          ));
        }
        const sample = group[0];
        const { title, body } = summarizeGroup(
          sample.kind,
          sample.severity,
          group.length,
        );
        return [
          <li
            key={key}
            className="rounded-xl border border-border bg-card overflow-hidden ls-insight-group"
          >
            <details className="group">
              <summary className="px-3 py-2 cursor-pointer list-none flex items-start gap-2 flex-wrap hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={sample.severity} />
                    <span className="text-sm font-semibold text-foreground">
                      {title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {body}
                  </p>
                </div>
                <span className="text-xs text-primary font-medium shrink-0 mt-0.5 group-open:hidden">
                  View {group.length} →
                </span>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5 hidden group-open:inline">
                  Hide
                </span>
              </summary>
              <ul className="space-y-1.5 px-3 pb-3 pt-1 border-t border-border bg-muted/10">
                {group.map((insight) => (
                  <InsightRow key={insight.id} insight={insight} />
                ))}
              </ul>
            </details>
          </li>,
        ];
      })}
    </ul>
  );
}

function severityTone(severity: string): string {
  if (severity === "critical") return "bg-primary text-primary-foreground";
  if (severity === "warning") return "bg-muted text-foreground";
  return "bg-primary/10 text-primary";
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
