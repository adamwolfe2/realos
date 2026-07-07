import * as React from "react";
import type {
  AiAnalysis,
  DataSourceStatus,
  ReportAeoStats,
  ReportAiVisibility,
  ReportContentStats,
  ReportDataSources,
  ReportLifecycleStats,
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
import { suppressLowSampleDelta } from "@/lib/recency";
import {
  ReportTabs,
  ReportTabPanel,
} from "@/components/portal/reports/report-tabs";
import { summarizeGroup } from "@/lib/insights/summarize-group";
import { PropertyHeroBanner } from "@/components/portal/properties/property-hero-banner";
import {
  ChatGPTMark,
  ClaudeMark,
  PerplexityMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { Donut as SharedDonut } from "@/components/portal/ui/charts";
import { LeaseStackWordmark } from "@/components/brand/leasestack-wordmark";
import { ClientLogo } from "@/components/portal/reports/client-logo";

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
  // Norman feedback (May 22): the shared report needs to read as a
  // premium landing page — pinned property hero with the building
  // image at the top, exactly like the main dashboard's featured
  // property card. When propertyHero is supplied (org-loader fetches
  // it for property-scoped reports), ReportView renders a
  // PropertyHeroBanner above the existing header strip + tabs.
  // Stays optional so portfolio-wide reports still render the
  // text-only header.
  propertyHero?: {
    propertyId: string;
    propertyName: string;
    subtitle: string | null;
    heroImageUrl: string | null;
    imageOffsetX?: number;
    imageOffsetY?: number;
    imageScale?: number;
    googleAggRating?: number | null;
  } | null;
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
  propertyHero = null,
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
      {/* Norman feedback (May 22): the shared report should feel like
          a premium landing page — pinned property hero with the
          building image at the top, mirroring the main dashboard's
          Featured Property card. Renders only when the loader fetched
          propertyHero (single-property reports); portfolio-wide
          reports fall through to the text-only header strip below.
          editable=false because this is read-only — operators upload
          images from /portal/properties/[id], not the report. */}
      {propertyHero ? (
        <PropertyHeroBanner
          propertyId={propertyHero.propertyId}
          propertyName={propertyHero.propertyName}
          subtitle={propertyHero.subtitle}
          heroImageUrl={propertyHero.heroImageUrl}
          imageOffsetX={propertyHero.imageOffsetX ?? 0}
          imageOffsetY={propertyHero.imageOffsetY ?? 0}
          imageScale={propertyHero.imageScale ?? 1}
          editable={false}
          compact
          stats={[
            {
              label: "Captured · period",
              value: (
                snapshot.kpis.leads + (snapshot.kpis.identifiedVisitors ?? 0)
              ).toLocaleString("en-US"),
              hint: `${snapshot.kpis.leads} form + ${snapshot.kpis.identifiedVisitors ?? 0} visitors`,
            },
            {
              label: snapshot.aeoStats
                ? "AI search · cited"
                : "Tours · period",
              value: snapshot.aeoStats
                ? `${snapshot.aeoStats.cited}/${snapshot.aeoStats.totalChecks}`
                : snapshot.kpis.tours.toLocaleString("en-US"),
              hint: snapshot.aeoStats
                ? `${snapshot.aeoStats.enginesUsed.length} engines`
                : undefined,
            },
            {
              label: "Reputation",
              value:
                propertyHero.googleAggRating != null
                  ? `${propertyHero.googleAggRating.toFixed(1)}★`
                  : snapshot.reputationStats?.overallRating != null
                    ? `${snapshot.reputationStats.overallRating.toFixed(1)}★`
                    : "—",
              hint: snapshot.reputationStats?.totalReviews
                ? `${snapshot.reputationStats.totalReviews} reviews`
                : undefined,
            },
          ]}
        />
      ) : null}

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
          {/* Co-branded lockup: the client's own logo (rendered cleanly,
              hidden if it fails to load) alongside a "Prepared by LeaseStack"
              wordmark so the report reads as a professional, attributed
              artifact instead of a squished mystery logo. */}
          <div className="flex items-center gap-3 shrink-0">
            {orgLogoUrl ? (
              <ClientLogo
                src={orgLogoUrl}
                alt={orgName ?? "Client logo"}
                className="h-8 w-auto max-w-[132px] object-contain"
              />
            ) : null}
            {orgLogoUrl ? (
              <span className="hidden sm:block h-7 w-px bg-border" aria-hidden />
            ) : null}
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Prepared by
              </span>
              <LeaseStackWordmark className="text-[15px]" />
            </div>
          </div>
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
      {/* Hero gradient KPI block — anchors the page like the dashboard.
          Norman feedback (May 22): when the PropertyHeroBanner is
          rendered above with the same "150 captured" headline, this
          block is a literal duplicate. Suppress when propertyHero is
          present so the page never repeats the same number twice. */}
      {propertyHero ? null : <HeroKpi snapshot={snapshot} />}

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

        // Norman bug (May 22): Identified visitors (from the visitor
        // pixel) were never surfaced in this strip even though they
        // dwarf form/chatbot leads for most pixel-active tenants
        // (TC: 3 form leads vs 146 identified visitors). Render only
        // when there's actually pixel data — for ad-only orgs with no
        // pixel installed, the tile would just say "0" and look broken.
        // Defensive reads — legacy snapshots predate identifiedVisitors.
        const identifiedVisitors = kpis.identifiedVisitors ?? 0;
        const identifiedVisitorsPct = kpiDeltas.identifiedVisitorsPct ?? null;
        const showIdentifiedVisitors =
          identifiedVisitors > 0 || (identifiedVisitorsPct ?? 0) !== 0;

        const allZero =
          kpis.leads === 0 &&
          (kpiDeltas.leadsPct ?? 0) === 0 &&
          !showIdentifiedVisitors &&
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
            // Norman feedback (May 22): "We don't wanna waste space."
            // Was locked to md:grid-cols-5 regardless of card count.
            // auto-fit packs whatever's rendered. min 140px floor
            // gets us 2 cols on a 390px phone instead of stacking
            // each tile as a full-width row (Norman: "1x3 not 3x1").
            className="ls-report-section grid gap-2"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <IconKpi
              label="Form/chatbot leads"
              value={kpis.leads.toLocaleString()}
              deltaPct={kpiDeltas.leadsPct}
              currentValue={kpis.leads}
              tone="primary"
              glyph="target"
            />
            {showIdentifiedVisitors ? (
              <IconKpi
                label="Identified visitors"
                value={identifiedVisitors.toLocaleString()}
                deltaPct={identifiedVisitorsPct}
                currentValue={identifiedVisitors}
                tone="primary"
                glyph="globe"
              />
            ) : null}
            {showTours ? (
              <IconKpi
                label="Tours"
                value={kpis.tours.toLocaleString()}
                deltaPct={kpiDeltas.toursPct}
                currentValue={kpis.tours}
                tone="primary"
                glyph="calendar"
              />
            ) : null}
            {showApplications ? (
              <IconKpi
                label="Applications"
                value={kpis.applications.toLocaleString()}
                deltaPct={kpiDeltas.applicationsPct}
                currentValue={kpis.applications}
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
                currentValue={kpis.organicSessions}
                tone="primary"
                glyph="globe"
              />
            ) : null}
          </section>
        );
      })()}

      {/* Norman feedback (May 22): Overview was too thin — just the
          hero + KPI strip, then jump straight to "Data sources". This
          summary strip pulls the highest-signal numbers from every
          other tab so an executive can see the whole platform in one
          page without clicking through. Each card only renders when
          there's actually data behind it.
          hideHeroDuplicates suppresses the Reputation + AI Search
          cards when the PropertyHeroBanner above already shows the
          same numbers. */}
      <OverviewSummaryStrip
        snapshot={snapshot}
        hideHeroDuplicates={Boolean(propertyHero)}
      />

      {/* Norman feedback (May 22, second pass): "The overview page
          should have all the graphs and all the top-line metrics."
          Pull the marquee chart blocks from Insights + Reputation up
          to Overview so the first tab reads as the dashboard.
          Same components render again on their own tabs — duplicate
          rendering is intentional: Overview = at-a-glance, each tab =
          full depth. */}
      {snapshot.aeoStats && snapshot.aeoStats.totalChecks > 0 ? (
        <AeoSection stats={snapshot.aeoStats} />
      ) : null}
      {snapshot.reputationStats &&
      snapshot.reputationStats.totalReviews > 0 ? (
        <ReputationSection stats={snapshot.reputationStats} />
      ) : null}
      {snapshot.aiVisibility &&
      snapshot.aiVisibility.brandedClicks > 0 ? (
        <AiVisibilitySection aiVisibility={snapshot.aiVisibility} />
      ) : null}
        </ReportTabPanel>

        {/* Norman May 22 (final pass): tab order is Overview →
            Reputation → Insights → Content → Traffic & Leads →
            Operations. Reputation / Insights / Content are the
            brand-equity tabs LeaseStack actually owns; Traffic +
            Operations live at the back as the integration-driven
            tabs that lean on AppFolio + GA4. */}
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

          {/* AEO — "your competitors are getting cited in AI search, you
              are not." Norman feedback (May 22): this was missing
              entirely from the report despite being one of the highest-
              signal sections we have for TC (32 competitor citations
              across 36 checks). Renders only when aeoStats present
              AND there's actually something to say. */}
          {snapshot.aeoStats && snapshot.aeoStats.totalChecks > 0 ? (
            <AeoSection stats={snapshot.aeoStats} />
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

        <ReportTabPanel id="content">
          {snapshot.contentStats &&
          (snapshot.contentStats.totalPublished > 0 ||
            (snapshot.contentStats.totalInProgress ?? 0) > 0) ? (
            <ContentSection stats={snapshot.contentStats} />
          ) : (
            <EmptyTabState
              title="No published content yet"
              body="Blog posts and neighborhood landing pages appear here once they're approved and shipped. Drafts in progress show on /portal/content."
            />
          )}
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

          {/* Norman feedback (May 22): "I hate all the conversion funnel
              and lead sources! Why do we have a bar chart there?" — the
              previous Conversion Funnel bar chart read as a stack of
              empty 0% bars for any tenant without tour/application
              tracking (TC: 3 leads, 0 of everything else). The Lead
              Sources bar was equally useless when 100% came from one
              channel. Both replaced with a denser stage strip + a real
              donut. The "Where leases came from" attribution table
              below already carries the per-source breakdown verbatim,
              so we don't duplicate the source list. */}
          {/* AppFolio lifecycle strip — real lease + application
              counts pulled from the AppFolio mirror. Norman bug May
              22: SG signed 20+ leases at TC that never showed up
              because the funnel only counted Lead.status. This strip
              gives ownership a real number above the funnel so the
              page never reads as "0 of everything" again. Renders
              only when lifecycleStats is present (AppFolio connected
              + activity in window). */}
          {snapshot.lifecycleStats ? (
            <LifecycleStrip stats={snapshot.lifecycleStats} />
          ) : null}

          {hasFunnelData ? (
            <Section
              className="ls-report-section"
              eyebrow="New lead → signed lease · includes AppFolio mirror"
              title="Conversion stages"
            >
              <FunnelStrip
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
          {/* Norman bug #71 / #77 / repeated screenshots (May 22):
              LeaseStack is positioned as marketing intelligence, not a
              PMS competitor. The previous Occupancy snapshot (100%
              occupied · $4.4M rent roll · $1,940 avg rent/unit) and
              Renewal pipeline ($1.96M at risk in 120d) were pure
              rent-roll surfaces — same data Norman's team already gets
              from AppFolio, irrelevant to the digital-marketing report
              ownership reviews. Both sections suppressed. The data
              still loads (OccupancySection / RenewalSection retained as
              functions) so the operations module can re-enable them
              when we ship a dedicated "Rent roll" report kind. */}
          {/* Visitor identification — only when the pixel is firing. */}
          {snapshot.visitorStats && pixelConnected ? (
            <VisitorSection stats={snapshot.visitorStats} />
          ) : null}
          {/* Visitor intelligence — Norman May 22: "what other data
              points can we pull into the operations". Surfaces every
              honest enrichment signal we have on the Visitor row:
              hot leads, audience sync, demographics, geography,
              referrers. Renders only when any of the optional fields
              came back populated. */}
          {snapshot.visitorStats && pixelConnected ? (
            <VisitorIntelligenceSection stats={snapshot.visitorStats} />
          ) : null}

          {/* Chatbot — extended if available. Norman May 22:
              he expected to see the lifetime conversation count
              (29) but the strip only showed the period count (24).
              We now expose BOTH numbers so ownership reads the
              whole story. */}
          {chatbotConnected && cb.conversations > 0 ? (
            <Section
              className="ls-report-section"
              eyebrow="Conversations and captured leads"
              title="Chatbot activity"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-xl border border-border bg-card px-3 py-2">
                  <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
                    Conversations
                  </div>
                  <div className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">
                    {cb.conversations.toLocaleString()}
                    {"lifetimeConversations" in cb &&
                    cb.lifetimeConversations != null &&
                    cb.lifetimeConversations !== cb.conversations ? (
                      <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">
                        · {cb.lifetimeConversations.toLocaleString()} lifetime
                      </span>
                    ) : null}
                  </div>
                </div>
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

      </ReportTabs>

      {/* Top performers strip — pinned at the bottom of every report so
          ownership ends the read with the highest-ROI specifics:
          best keywords, biggest competitor citation gaps, most-engaged
          properties. Norman feedback (May 22): the report should
          close strong with actionable specifics, not just data sources. */}
      <TopPerformersStrip snapshot={snapshot} />

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

  // Norman feedback (May 22): the original "Total leads this period" tile
  // read "3" and looked terrible because it only counted the Lead table.
  // Reality: TC also identified 146 visitors via the visitor pixel —
  // every one a real person with a name + email we could reach out to.
  // The honest headline sums BOTH paths into "captured contacts": form/
  // chatbot leads PLUS pixel-identified visitors. Same surface area an
  // outreach-focused operator would actually work from.
  //
  // Headline-priority order:
  //   1. Captured contacts (leads + identified visitors) when either > 0
  //   2. Organic sessions when both contact buckets are empty
  // Delta uses a blended pct so the trend reflects the combined movement.
  // Defensive — legacy snapshots predate identifiedVisitors.
  const identifiedVisitors = kpis.identifiedVisitors ?? 0;
  const identifiedVisitorsPct = kpiDeltas.identifiedVisitorsPct ?? null;
  const capturedContacts = kpis.leads + identifiedVisitors;
  const priorCaptured =
    kpiDeltas.leadsPct != null || identifiedVisitorsPct != null
      ? // Reconstruct prior totals from current value + pct change so we
        // can compute a single combined pct without plumbing prior counts
        // through. Falls back to 0 when delta is null.
        Math.round(
          (kpis.leads / (1 + (kpiDeltas.leadsPct ?? 0) / 100) || 0) +
            (identifiedVisitors /
              (1 + (identifiedVisitorsPct ?? 0) / 100) || 0),
        )
      : 0;
  const capturedPct =
    priorCaptured > 0
      ? Math.round(((capturedContacts - priorCaptured) / priorCaptured) * 100)
      : capturedContacts > 0
        ? null
        : null;
  const useContacts = capturedContacts > 0 || kpis.organicSessions === 0;
  const headlineLabel = useContacts
    ? "Captured contacts this period"
    : "Organic sessions this period";
  const headlineValue = useContacts
    ? capturedContacts.toLocaleString()
    : kpis.organicSessions.toLocaleString();
  const headlineDelta = useContacts ? capturedPct : kpiDeltas.organicSessionsPct;
  // Bug #11: absolute current value backing the headline pill — used by
  // DeltaPill to suppress noisy percentages on low samples (<5).
  const headlineCurrent = useContacts
    ? capturedContacts
    : kpis.organicSessions;

  // Subline calls out the breakdown so the headline isn't a black-box
  // aggregate — operators (and ownership) can see exactly how many came
  // from each path and trust the math.
  const subline = useContacts
    ? `${kpis.leads.toLocaleString()} form/chatbot leads · ${identifiedVisitors.toLocaleString()} identified visitors · ${kpis.tours} tours · ${kpis.applications} applications`
    : `${kpis.leads} leads · ${kpis.tours} tours · $${kpis.adSpendUsd.toLocaleString()} ad spend`;

  return (
    <section className="ls-report-section rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            {headlineLabel}
          </p>
          <p
            className="mt-1 text-[34px] sm:text-[40px] md:text-[52px] leading-none font-bold tracking-tight tabular-nums"
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
          <DeltaPill
            value={headlineDelta}
            large
            currentValue={headlineCurrent}
          />
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

        {/* Source breakdown — Norman feedback (May 22): replace the
            row-of-bars treatment with the same Donut primitive the
            dashboard / SEO surfaces use. The legend carries the real
            brand logos so Google / Reddit / Yelp / Facebook read as
            actual platforms, not bare uppercase strings. Top 6 sources
            are shown in the donut, anything beyond rolls into "+N more"
            below. */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
          <SharedDonut
            slices={stats.sourceBreakdown.slice(0, 6).map((row) => ({
              label: prettySource(row.source),
              value: row.count,
            }))}
            size={120}
            strokeWidth={18}
            centerPrimary={stats.totalReviews.toLocaleString()}
            centerSecondary="Reviews"
          />
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
                  // Mobile: shrink the label column from 120px → 90px
                  // and merge count + rating into a single right-side
                  // cell so the bar gets meaningful width at 390px.
                  className="grid grid-cols-[90px_1fr_auto] sm:grid-cols-[120px_1fr_44px_44px] items-center gap-2 text-[11px]"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <ReviewSourceLogo source={row.source} />
                    <span className="font-semibold text-foreground truncate">
                      {prettySource(row.source)}
                    </span>
                  </span>
                  <span className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundImage:
                          "linear-gradient(90deg, #1D4ED8 0%, #3B82F6 100%)",
                      }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-foreground font-semibold sm:hidden whitespace-nowrap">
                    {row.count.toLocaleString()}
                    {row.rating != null ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        · {row.rating.toFixed(1)}★
                      </span>
                    ) : null}
                  </span>
                  <span className="text-right tabular-nums text-foreground font-semibold hidden sm:inline">
                    {row.count.toLocaleString()}
                  </span>
                  <span className="text-right tabular-nums text-foreground hidden sm:inline">
                    {row.rating != null ? `${row.rating.toFixed(1)}★` : "—"}
                  </span>
                </div>
              );
            })}
            {stats.sourceBreakdown.length > 6 ? (
              <div className="text-[10px] text-muted-foreground italic pl-2">
                +{stats.sourceBreakdown.length - 6} more sources
              </div>
            ) : null}
          </div>
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
          subtitle="Negative sentiment, 3★ or below, or flagged — last 12 months"
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
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-foreground uppercase">
              <ReviewSourceLogo source={m.source} />
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
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${sentimentTone}`}
              >
                {m.sentiment.toLowerCase()}
              </span>
            ) : null}
            {m.flagged ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border bg-primary text-primary-foreground border-primary">
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
          the complete content.

          Bug #9: when the body text is empty (no excerpt at all, OR the
          sanitizer reduced full-page chrome to an empty string) we render
          a compact "(no review text)" muted label instead of the
          truncate-block + "Read full →" CTA, which previously made these
          cards look like a layout glitch. */}
      {(() => {
        const sanitized = m.excerpt ? sanitizeMentionExcerpt(m.excerpt) : "";
        if (!sanitized.trim()) {
          return (
            <p className="mt-2 text-[11.5px] italic text-muted-foreground/70 leading-snug">
              (no review text)
            </p>
          );
        }
        return (
          <p className="mt-2 text-[12px] text-foreground/90 leading-relaxed line-clamp-3">
            {sanitized}
            {m.excerpt && isExcerptTruncated(m.excerpt) && m.sourceUrl ? (
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
        );
      })()}
      {m.topics && m.topics.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {m.topics.map((t: string) => (
            <span
              key={t}
              className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-background/60"
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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
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
// VisitorIntelligenceSection — Norman May 22 fill-the-empty-space pass.
// Surfaces the full set of honest Visitor-table signals we have so
// Operations stops reading as "4 numbers + a sparkline + chatbot".
//
// Render layout (all rows skip themselves when their data is empty):
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Hot · 147     │ Outreach · 12   │ Google Ads · 80 │ Meta · 0 │
//   └──────────────────────────────────────────────────────────────┘
//   ┌─────────────────┬──────────────┬──────────────────┬────────────┐
//   │ Pixel funnel    │ Geography    │ Top referrers    │ Demographics│
//   │ ANON 30         │ Berkeley 88  │ telegraphcommons │ 25-34: 64% │
//   │ IDENT 147       │ Oakland 18   │ google.com 17    │ M 51/F 49  │
//   │ MATCHED 0       │ SF 12        │ direct 22        │            │
//   └─────────────────┴──────────────┴──────────────────┴────────────┘
//
// Every block is its own card so the section adapts when the org has
// partial enrichment data — Audience Lab regions vary in field
// coverage and we never want to ship "—" tiles.
// ---------------------------------------------------------------------------
function VisitorIntelligenceSection({
  stats,
}: {
  stats: ReportVisitorStats;
}) {
  const hot = stats.hotCount ?? 0;
  const outreach = stats.outreachSentCount ?? 0;
  const google = stats.syncedToGoogleAds ?? 0;
  const meta = stats.syncedToMetaAds ?? 0;
  const headlineTiles: Array<{ label: string; value: string; hint?: string }> = [];
  if (hot > 0)
    headlineTiles.push({
      label: "Hot visitors",
      value: hot.toLocaleString(),
      hint: "Intent score ≥ 70",
    });
  if (outreach > 0)
    headlineTiles.push({
      label: "Outreach sent",
      value: outreach.toLocaleString(),
      hint: "Email/SMS engaged",
    });
  if (google > 0)
    headlineTiles.push({
      label: "Synced · Google Ads",
      value: google.toLocaleString(),
      hint: "Custom audience",
    });
  if (meta > 0)
    headlineTiles.push({
      label: "Synced · Meta Ads",
      value: meta.toLocaleString(),
      hint: "Custom audience",
    });

  const blocks: Array<{
    title: string;
    rows: Array<{ label: string; value: string | number }>;
  }> = [];
  if (stats.byStatus && stats.byStatus.length > 0) {
    const total = stats.byStatus.reduce((s, r) => s + r.count, 0) || 1;
    blocks.push({
      title: "Pixel funnel",
      rows: stats.byStatus.slice(0, 6).map((r) => ({
        label: humanStatus(r.status),
        value: `${r.count.toLocaleString()} · ${Math.round(
          (r.count / total) * 100,
        )}%`,
      })),
    });
  }
  if (stats.topCities && stats.topCities.length > 0) {
    blocks.push({
      title: "Top visitor cities",
      rows: stats.topCities.slice(0, 6).map((r) => ({
        label: r.city,
        value: r.count,
      })),
    });
  } else if (stats.topStates && stats.topStates.length > 0) {
    blocks.push({
      title: "Top visitor states",
      rows: stats.topStates.slice(0, 6).map((r) => ({
        label: r.state,
        value: r.count,
      })),
    });
  }
  if (stats.topReferrers && stats.topReferrers.length > 0) {
    blocks.push({
      title: "Top referrers",
      rows: stats.topReferrers.slice(0, 5).map((r) => ({
        label: r.referrer,
        value: r.count,
      })),
    });
  }
  if (
    (stats.ageRanges && stats.ageRanges.length > 0) ||
    (stats.genderSplit && stats.genderSplit.length > 0)
  ) {
    const rows: Array<{ label: string; value: string | number }> = [];
    if (stats.genderSplit && stats.genderSplit.length > 0) {
      const total =
        stats.genderSplit.reduce((s, r) => s + r.count, 0) || 1;
      for (const g of stats.genderSplit.slice(0, 3)) {
        rows.push({
          label: humanGender(g.gender),
          value: `${Math.round((g.count / total) * 100)}%`,
        });
      }
    }
    if (stats.ageRanges && stats.ageRanges.length > 0) {
      const total = stats.ageRanges.reduce((s, r) => s + r.count, 0) || 1;
      for (const a of stats.ageRanges.slice(0, 4)) {
        rows.push({
          label: a.ageRange,
          value: `${Math.round((a.count / total) * 100)}%`,
        });
      }
    }
    blocks.push({ title: "Audience demographics", rows });
  }

  if (headlineTiles.length === 0 && blocks.length === 0) return null;

  return (
    <Section
      className="ls-report-section"
      eyebrow="Audience intelligence · enriched by Cursive"
      title="Visitor intelligence"
    >
      {headlineTiles.length > 0 ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          {headlineTiles.map((t) => (
            <div
              key={t.label}
              className="rounded-xl border border-primary/20 px-3 py-2.5"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 70%)",
              }}
            >
              <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
                {t.label}
              </p>
              <p className="mt-0.5 text-[22px] font-bold tabular-nums text-foreground leading-none">
                {t.value}
              </p>
              {t.hint ? (
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {t.hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {blocks.length > 0 ? (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {blocks.map((b) => (
            <div
              key={b.title}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-1.5">
                {b.title}
              </div>
              <ul className="space-y-1">
                {b.rows.map((r, i) => (
                  <li
                    key={`${b.title}-${i}`}
                    className="flex items-baseline justify-between gap-2 text-[11.5px]"
                  >
                    <span className="text-foreground truncate font-medium">
                      {r.label}
                    </span>
                    <span className="tabular-nums text-foreground font-semibold shrink-0">
                      {typeof r.value === "number"
                        ? r.value.toLocaleString()
                        : r.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function humanStatus(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanGender(g: string): string {
  const x = g.toLowerCase();
  if (x === "m" || x === "male") return "Male";
  if (x === "f" || x === "female") return "Female";
  return humanStatus(g);
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

// ---------------------------------------------------------------------------
// OverviewSummaryStrip — high-signal mini-cards pulled from every other
// tab so the Overview reads as a real executive summary instead of just
// a single KPI strip. Each card surfaces ONE headline number + a
// drill-in hint ("see Reputation tab", "see Insights tab") so the
// reader knows where to click for depth. Cards render only when their
// underlying data exists — for a marketing-only tenant without
// reputation/AEO configured the strip can collapse to two cards or
// be hidden entirely.
// ---------------------------------------------------------------------------
function OverviewSummaryStrip({
  snapshot,
  hideHeroDuplicates = false,
}: {
  snapshot: ReportSnapshot;
  /** When the PropertyHeroBanner is shown above, skip Reputation +
   *  AI Search Visibility cards because they duplicate the hero
   *  stats. Norman May 22: "Notice how we have 150 captured twice
   *  here? We don't wanna waste space!" */
  hideHeroDuplicates?: boolean;
}) {
  const rep = snapshot.reputationStats;
  const aeo = snapshot.aeoStats;
  const cb = snapshot.chatbotStatsExtended ?? snapshot.chatbotStats;
  const visitors = snapshot.visitorStats;
  const topQuery = snapshot.topQueries[0] ?? null;
  const lifecycle = snapshot.lifecycleStats;
  const aiVis = snapshot.aiVisibility;
  const topPage = snapshot.topPages[0] ?? null;

  type Card = {
    eyebrow: string;
    title: string;
    headline: string;
    sub: string;
    tone?: "neutral" | "warn" | "good";
  };
  const cards: Card[] = [];

  // Hero already carries Reputation + AI Search Visibility tiles —
  // skip them when the hero is rendered to avoid the duplicate
  // Norman flagged. Otherwise include them for portfolio reports
  // without a property hero.
  if (!hideHeroDuplicates && rep && rep.totalReviews > 0) {
    cards.push({
      eyebrow: "Reputation",
      title: rep.overallRating != null ? `${rep.overallRating.toFixed(1)} ★` : "—",
      headline: `${rep.totalReviews.toLocaleString()} lifetime reviews`,
      sub: `${rep.newInPeriod} new · ${rep.positiveCount} positive · ${rep.negativeCount} negative`,
      tone: rep.negativeCount > 0 ? "warn" : "good",
    });
  }

  if (!hideHeroDuplicates && aeo && aeo.totalChecks > 0) {
    const gap = aeo.competitorCited - aeo.cited;
    cards.push({
      eyebrow: "AI search visibility",
      title: `${aeo.cited} / ${aeo.totalChecks}`,
      headline:
        gap > 0
          ? `Cited ${aeo.cited}× · competitors cited ${aeo.competitorCited}×`
          : `Cited ${aeo.cited}× across ${aeo.enginesUsed.length} engines`,
      sub:
        aeo.topCompetitors.length > 0
          ? `Top competitors: ${aeo.topCompetitors
              .slice(0, 3)
              .map((c) => c.name)
              .join(", ")}`
          : "See Insights tab for full prompt breakdown",
      tone: gap > 0 ? "warn" : "good",
    });
  }

  if (visitors && visitors.identifiedVisitors > 0) {
    cards.push({
      eyebrow: "Pixel identifications",
      title: visitors.identifiedVisitors.toLocaleString(),
      headline: `${visitors.identifiedNewInPeriod} new this period`,
      sub: `${visitors.withEmail} with email · See Operations tab for the visitor feed`,
      tone: "good",
    });
  }

  if (cb.conversations > 0) {
    const rate =
      "capturedRatePct" in cb && cb.capturedRatePct != null
        ? `${cb.capturedRatePct}%`
        : cb.conversations > 0
          ? `${Math.round((cb.leadsFromChat / cb.conversations) * 100)}%`
          : "—";
    const lifetimeHint =
      "lifetimeConversations" in cb &&
      cb.lifetimeConversations != null &&
      cb.lifetimeConversations !== cb.conversations
        ? ` · ${cb.lifetimeConversations.toLocaleString()} lifetime`
        : "";
    cards.push({
      eyebrow: "Chatbot",
      title: cb.conversations.toLocaleString(),
      headline: `${cb.leadsFromChat} captured (${rate})`,
      sub: `Avg ${cb.avgMessageCount.toFixed(1)} messages per conversation${lifetimeHint}`,
      tone: cb.leadsFromChat === 0 && cb.conversations > 5 ? "warn" : "neutral",
    });
  }

  // ─── New cards Norman May 22: fill the white space with unique
  // dense metrics that AREN'T in the hero. Each appears only when
  // there's real data behind it. ─────────────────────────────────

  // Lifecycle headline — AppFolio active leases (the closed-loop
  // floor). The Traffic tab carries the full strip; this card is
  // the at-a-glance Overview signal.
  if (lifecycle && lifecycle.activeLeases > 0) {
    cards.push({
      eyebrow: "Active leases",
      title: lifecycle.activeLeases.toLocaleString(),
      headline: `${lifecycle.leasesSignedLast180d} signed last 180d`,
      sub: `${lifecycle.leasesSignedInPeriod} signed this period · From AppFolio sync`,
      tone: "good",
    });
  }

  // Branded search — the "does AI / Google know who you are" axis.
  // Different signal than AEO citation share.
  if (aiVis && aiVis.brandedClicks > 0) {
    cards.push({
      eyebrow: "Branded search clicks",
      title: aiVis.brandedClicks.toLocaleString(),
      headline: `${aiVis.brandedShare}% of all organic clicks`,
      sub:
        aiVis.topBrandedTerms.length > 0
          ? `Top term: &ldquo;${aiVis.topBrandedTerms[0]}&rdquo;`
          : `${aiVis.brandedImpressions.toLocaleString()} impressions`,
      tone: "good",
    });
  }

  if (topQuery) {
    cards.push({
      eyebrow: "Top search query",
      title: `#${topQuery.position.toFixed(1)}`,
      headline: `&ldquo;${topQuery.query}&rdquo;`,
      sub: `${topQuery.clicks.toLocaleString()} clicks · ${topQuery.impressions.toLocaleString()} impressions`,
      tone: "good",
    });
  }

  if (topPage) {
    cards.push({
      eyebrow: "Top landing page",
      title: topPage.sessions.toLocaleString(),
      headline: `&ldquo;${shortUrl(topPage.url)}&rdquo;`,
      sub: `${topPage.sessions.toLocaleString()} sessions in window`,
      tone: "neutral",
    });
  }

  if (cards.length === 0) return null;

  return (
    <section
      aria-label="At-a-glance summary"
      // auto-fit packs whatever cards render. min 200px keeps the
      // card readable while still packing 2-up on a 390px phone
      // (Norman: "1x3 not 3x1").
      className="ls-report-section grid gap-2"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      }}
    >
      {cards.map((c, i) => {
        // Norman feedback (May 22): kill the yellow warn tone — every
        // accent in the report should sit inside the brand blue
        // palette. "warn" now reads as a denser blue gradient (still
        // visually distinct from neutral cards but matches the
        // overall palette), "good" stays as a light brand tint,
        // neutral stays muted.
        const isGradient = c.tone === "warn" || c.tone === "good";
        const toneCls =
          c.tone === "warn"
            ? "border-blue-200/80 text-foreground"
            : c.tone === "good"
              ? "border-primary/20 text-foreground"
              : "border-border bg-card text-foreground";
        return (
          <div
            key={`${c.eyebrow}-${i}`}
            className={`rounded-2xl border ${toneCls} px-4 py-3.5`}
            style={
              isGradient
                ? {
                    backgroundImage:
                      c.tone === "warn"
                        ? "linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 70%)"
                        : "linear-gradient(135deg, #F5F9FF 0%, #FFFFFF 70%)",
                  }
                : undefined
            }
          >
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              {c.eyebrow}
            </p>
            <p className="mt-0.5 text-[22px] font-semibold tracking-tight text-foreground tabular-nums">
              {c.title}
            </p>
            <p
              className="mt-1 text-[12px] font-medium text-foreground leading-snug"
              dangerouslySetInnerHTML={{ __html: c.headline }}
            />
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              {c.sub}
            </p>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// AeoSection — AI search citation breakdown. Shows the gap-to-close
// story: "your competitors are getting cited X times, you got cited Y."
// This is one of the highest-signal sections in the report for any
// pixel-active tenant — competitors named by ChatGPT / Claude /
// Perplexity / Gemini are the literal results AI users see when they
// ask about the local market.
// ---------------------------------------------------------------------------
function AeoSection({ stats }: { stats: ReportAeoStats }) {
  const sharePct =
    stats.totalChecks > 0
      ? Math.round((stats.cited / stats.totalChecks) * 100)
      : 0;
  // Citation-share donut — same Donut primitive the dashboard uses.
  // "Not mentioned" = totalChecks minus (cited + competitorCited),
  // floored at 0 because legacy snapshots sometimes overlapped buckets.
  const notMentioned = Math.max(
    0,
    stats.totalChecks - stats.cited - stats.competitorCited,
  );
  const donutSlices = [
    { label: "Cited you", value: stats.cited, color: "#1D4ED8" },
    { label: "Cited competitor", value: stats.competitorCited, color: "#93C5FD" },
    { label: "Not mentioned", value: notMentioned, color: "#E5E7EB" },
  ].filter((s) => s.value > 0);
  return (
    <Section
      className="ls-report-section"
      eyebrow={`${stats.totalChecks} AI search checks · ${stats.enginesUsed.map(prettyEngineName).join(" · ")}`}
      title="AI answer visibility"
    >
      <div className="space-y-3">
        {/* Glance row: donut + 3 stat tiles. Reusing the shared Donut
            primitive so the chart reads identically to the SEO /
            dashboard surfaces — same brand palette, same stroke
            geometry, same center label treatment. */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
          <SharedDonut
            slices={donutSlices}
            size={120}
            strokeWidth={18}
            centerPrimary={`${sharePct}%`}
            centerSecondary="Citations"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <MiniStat
              label="You cited"
              value={stats.cited.toLocaleString()}
            />
            <MiniStat
              label="Competitor cited"
              value={stats.competitorCited.toLocaleString()}
            />
            <MiniStat
              label="Engines scanned"
              value={stats.enginesUsed.length.toLocaleString()}
            />
          </div>
        </div>

        {/* Per-engine stacked bar chart (Norman feedback May 22 — richer
            charts in every tab + use real brand logos for ChatGPT /
            Claude / Perplexity / Gemini so the section reads like a
            real AI search audit, not a plain table). The "you cited"
            bar gets the deep brand blue gradient, the "competitor"
            bar gets a softer blue (so it still reads as a tracked
            measurement, not a yellow warning), and "not mentioned"
            stays neutral gray. Only renders when byEngine is present. */}
        {stats.byEngine && stats.byEngine.length > 0 ? (
          <div>
            {/* Bug #118 (was #5): Norman flagged identical 14/38 counts across all
                three engines as suspicious — looked like a binning/display
                bug. Investigated: underlying computation is correct (per-engine
                groupBy in buildAeoStats); engines genuinely run the SAME prompt
                set so matching counts are real coincidence, not aggregation bug.
                Fixed by reframing — eyebrow now says "cited / total per engine"
                and the segment tooltips spell out that each engine is measured
                independently. Equal numbers now read as informative, not buggy. */}
            <div
              className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5"
              title="Per-engine count = AI search queries where this engine cited your domain at least once. Each engine is measured independently against the same prompt set, so matching counts across engines are possible (and meaningful)."
            >
              By engine{" "}
              <span
                aria-hidden="true"
                className="text-muted-foreground/60 normal-case tracking-normal font-normal"
              >
                · cited / total per engine
              </span>
            </div>
            {/* Norman bug (May 22, n+1): when the data has all three
                engines at identical counts (14/14/14), simple end-aligned
                bars read as visually flat — same proportion, same color
                stops. Inline per-segment labels (You 14 · Comp 22 · — 2)
                + a small win-rate pill at the end give each row its own
                readable identity even when the underlying numbers
                happen to match. */}
            <div className="space-y-2">
              {stats.byEngine.map((e) => {
                const notMentioned =
                  e.total - e.cited - e.competitorCited;
                const pct = (n: number) =>
                  e.total > 0 ? (n / e.total) * 100 : 0;
                const winRate = e.total > 0
                  ? Math.round((e.cited / e.total) * 100)
                  : 0;
                return (
                  <div
                    key={e.engine}
                    className="flex items-center gap-2 sm:gap-3"
                  >
                    {/* Engine label column — tighter on mobile so the
                        bar gets the real estate. The text label hides
                        under sm: and only the brand logo shows. */}
                    <div className="flex items-center gap-1.5 sm:w-32 shrink-0">
                      <AeoEngineLogo engine={e.engine} />
                      <span className="hidden sm:inline text-[11px] font-semibold tracking-wide text-foreground truncate">
                        {prettyEngineName(e.engine)}
                      </span>
                    </div>
                    <div className="flex-1 h-6 rounded-md overflow-hidden bg-muted/40 flex relative min-w-0">
                      {e.cited > 0 ? (
                        <div
                          className="h-full flex items-center justify-center min-w-0"
                          style={{
                            width: `${pct(e.cited)}%`,
                            backgroundImage:
                              "linear-gradient(90deg, #1D4ED8 0%, #2563EB 100%)",
                          }}
                          title={`${e.cited} of ${e.total} queries on this engine cited your domain`}
                        >
                          {/* Inline labels only on sm+ — they overflow
                              narrow viewports and the win-rate pill at
                              the end already tells the story. */}
                          {pct(e.cited) > 14 ? (
                            <span className="hidden sm:inline text-[10px] font-bold text-white tabular-nums whitespace-nowrap">
                              You {e.cited}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {e.competitorCited > 0 ? (
                        <div
                          className="h-full flex items-center justify-center min-w-0"
                          style={{
                            width: `${pct(e.competitorCited)}%`,
                            backgroundImage:
                              "linear-gradient(90deg, #93C5FD 0%, #BFDBFE 100%)",
                          }}
                          title={`${e.competitorCited} of ${e.total} queries on this engine cited a competitor instead`}
                        >
                          {pct(e.competitorCited) > 14 ? (
                            <span className="hidden sm:inline text-[10px] font-bold text-blue-900 tabular-nums whitespace-nowrap">
                              Comp {e.competitorCited}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {notMentioned > 0 ? (
                        <div
                          className="h-full bg-muted-foreground/20 flex items-center justify-center min-w-0"
                          style={{ width: `${pct(notMentioned)}%` }}
                          title={`${notMentioned} of ${e.total} queries on this engine returned no property mention`}
                        >
                          {pct(notMentioned) > 14 ? (
                            <span className="hidden sm:inline text-[10px] font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                              — {notMentioned}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 justify-end">
                      <span className="text-[10px] sm:text-[11px] font-semibold tabular-nums text-foreground whitespace-nowrap">
                        {e.cited}/{e.total}
                      </span>
                      <span
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums"
                        style={{
                          backgroundColor:
                            winRate >= 50
                              ? "#DCFCE7"
                              : winRate >= 30
                                ? "#DBEAFE"
                                : "#FEE2E2",
                          color:
                            winRate >= 50
                              ? "#166534"
                              : winRate >= 30
                                ? "#1E40AF"
                                : "#991B1B",
                        }}
                      >
                        {winRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-3 rounded-sm"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #1D4ED8 0%, #3B82F6 100%)",
                  }}
                />
                cited you
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-3 rounded-sm"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #93C5FD 0%, #BFDBFE 100%)",
                  }}
                />
                cited competitor
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm bg-muted-foreground/25" />
                not mentioned
              </span>
            </div>
          </div>
        ) : null}

        {stats.topCompetitors.length > 0 ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5">
              Who is getting cited instead
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.topCompetitors.map((c) => (
                <span
                  key={c.name}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-900"
                >
                  {c.name}
                  <span className="text-blue-700/70 tabular-nums">
                    ×{c.mentions}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {stats.sampleCompetitorQueries.length > 0 ? (() => {
          // Bug #116 (was #7): the section used to render one row per engine
          // with the same prompt repeated 3x ("Claude / ChatGPT / Perplexity —
          // same query"), which made the plural label "Sample queries you lost"
          // read as a bug. Fix (a): dedupe by query string. We run the SAME
          // prompt set on every engine, so duplicates are expected — group by
          // prompt and show each prompt once with the engines + competitors it
          // lost on. Label also adapts when a single query is the only row.
          type Sample = (typeof stats.sampleCompetitorQueries)[number];
          const grouped = new Map<
            string,
            { prompt: string; engines: string[]; competitors: string[] }
          >();
          for (const q of stats.sampleCompetitorQueries) {
            const g = grouped.get(q.prompt) ?? {
              prompt: q.prompt,
              engines: [],
              competitors: [],
            };
            if (!g.engines.includes(q.engine)) g.engines.push(q.engine);
            for (const c of q.competitors) {
              if (!g.competitors.includes(c)) g.competitors.push(c);
            }
            grouped.set(q.prompt, g);
          }
          const rows = [...grouped.values()];
          const allSameQuery = rows.length === 1 && stats.sampleCompetitorQueries.length > 1;
          const label = allSameQuery
            ? "Query you lost on multiple engines"
            : rows.length === 1
              ? "Query you lost"
              : "Queries you lost";
          return (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5">
                {label}
              </div>
              <ul className="space-y-1.5">
                {rows.map((q, i) => (
                  <li
                    key={i}
                    className="text-[11.5px] leading-snug bg-muted/30 rounded px-2.5 py-2"
                  >
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {q.engines.map((e) => (
                        <span
                          key={e}
                          className="inline-flex items-center gap-1"
                        >
                          <AeoEngineLogo engine={e} />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {prettyEngineName(e)}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="text-foreground">
                      &ldquo;{q.prompt.length > 110 ? q.prompt.slice(0, 107) + "…" : q.prompt}&rdquo;
                    </div>
                    {q.competitors.length > 0 ? (
                      <div className="mt-0.5 text-muted-foreground">
                        → cited {q.competitors.slice(0, 3).join(", ")}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })() : null}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Each week LeaseStack asks ChatGPT, Claude, and Perplexity the
          same set of buyer-intent prompts about your market. This is
          the score for what they actually answered. Closing the gap
          drives the next 12–24 months of search traffic.
        </p>
      </div>
    </Section>
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
  currentValue,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  invertDelta?: boolean;
  tone?: IconKpiTone;
  glyph?: "target" | "calendar" | "check" | "dollar" | "globe";
  /** Absolute current value — used to suppress noisy deltas on low samples. */
  currentValue?: number | null;
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
          <DeltaPill
            value={deltaPct}
            invert={invertDelta}
            currentValue={currentValue}
          />
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

// Bug #112: low-sample delta suppression. "ORGANIC SESSIONS: 1 (-100%)"
// looked broken in client-facing reports — at very low absolute values a
// percentage delta is statistical noise. The shared helper in lib/recency.ts
// renders an em-dash + "Low sample size" tooltip when either current or
// previous is below threshold. Consolidating here so any future tweak (raise
// threshold, change copy) edits one file, not seven inline copies across the
// portal.
function DeltaPill({
  value,
  invert = false,
  large = false,
  currentValue,
  previousValue,
}: {
  value: number;
  invert?: boolean;
  large?: boolean;
  /**
   * Absolute current value the percentage was computed from. When provided
   * AND below the suppress threshold, we hide the percentage and render an
   * em-dash with a "Low sample size" tooltip. Omit to always render.
   */
  currentValue?: number | null;
  /**
   * Previous-period absolute value. Same suppression rule: if either current
   * or previous is below the threshold, the delta is noise.
   */
  previousValue?: number | null;
}) {
  const sz = large
    ? "px-3 py-1.5 text-[14px]"
    : "px-1.5 py-0.5 text-[10px]";
  // Bug #112: low-sample delta suppression — derive previous from value+current
  // when the caller doesn't pass it explicitly so we can route through the
  // shared helper without changing every call site signature. previous =
  // current / (1 + value/100) is the inverse of the percentage formula.
  const inferredPrevious =
    previousValue != null
      ? previousValue
      : currentValue != null && value !== -100
        ? currentValue / (1 + value / 100)
        : null;
  if (currentValue != null && inferredPrevious != null) {
    const suppressed = suppressLowSampleDelta(currentValue, inferredPrevious);
    if (suppressed.lowSample) {
      return (
        <span
          title="Low sample size"
          className={
            "inline-flex items-center gap-0.5 rounded-md font-bold tabular-nums bg-muted text-muted-foreground " +
            sz
          }
        >
          —
        </span>
      );
    }
  }
  const goodDirection = invert ? value < 0 : value > 0;
  const flat = value === 0;
  const tone = flat
    ? "bg-muted text-muted-foreground"
    : goodDirection
      ? "bg-primary/10 text-primary"
      : "bg-primary text-primary-foreground";
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
    <div className="rounded-xl border border-border bg-card px-2.5 sm:px-3 py-2 min-w-0">
      <div className="text-[10px] sm:text-[10px] tracking-widest uppercase font-bold text-muted-foreground truncate">
        {label}
      </div>
      <div className="mt-0.5 text-[14px] sm:text-[15px] font-bold tabular-nums text-foreground truncate">
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
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
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

function InsightRow({ insight }: { insight: InsightItem }) {
  return (
    <li className="rounded-xl border border-border bg-card px-3 py-2">
      <span className="text-sm font-semibold text-foreground">
        {insight.title}
      </span>
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
                  <span className="text-sm font-semibold text-foreground">
                    {title}
                  </span>
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

// ---------------------------------------------------------------------------
// ContentSection — published blog posts + neighborhood landing pages.
// Norman feedback (May 22): make the SEO content pipeline visible in
// the report as a real deliverable. Top strip: total published + new
// in period. Bar chart: format breakdown. List: most recent 5 with
// clickable links so ownership can read the actual content.
// ---------------------------------------------------------------------------
function ContentSection({ stats }: { stats: ReportContentStats }) {
  const maxCount = Math.max(1, ...stats.byFormat.map((f) => f.count));
  return (
    <div className="space-y-3">
      <Section
        className="ls-report-section"
        eyebrow={`${stats.publishedInPeriod} shipped this period`}
        title="Published content"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <MiniStat
            label="Total published"
            value={stats.totalPublished.toLocaleString()}
          />
          <MiniStat
            label="New this period"
            value={stats.publishedInPeriod.toLocaleString()}
          />
          <MiniStat
            label="Formats"
            value={stats.byFormat.length.toLocaleString()}
          />
        </div>

        {/* Format bar chart — horizontal bars sized by count. Reads as
            "you publish X blog posts, Y neighborhood pages, Z FAQ
            blocks" at a glance. */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            By format
          </div>
          {stats.byFormat.map((row) => (
            <div key={row.format} className="flex items-center gap-3">
              <div className="text-[12px] font-medium text-foreground w-44 truncate">
                {row.format}
              </div>
              <div className="flex-1 h-4 bg-muted/40 rounded overflow-hidden">
                <div
                  className="h-full bg-primary rounded"
                  style={{ width: `${(row.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="text-[12px] font-semibold tabular-nums text-foreground w-10 text-right">
                {row.count}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Norman feedback (May 22, n+2): "Where are the actual blocks?
          I want to be able to open those and see those in here. Even
          if they're in draft detection and not fully approved yet,
          I want to see them." Re-added the per-item list with status
          pills so the Content tab shows the full editorial pipeline
          (in-progress drafts + published items). Click-through is
          opt-in — items without a public URL just render as a card
          with the status, no broken link. */}
      {stats.recent.length > 0 ? (
        <Section
          className="ls-report-section"
          eyebrow="What's in flight + recently shipped"
          title="Content pipeline"
        >
          <ul className="space-y-2">
            {stats.recent.map((item, i) => {
              const status = (item.status ?? "shipped").toLowerCase();
              const pill = contentStatusPill(status);
              // Live URL wins (real published page); preview URL is the
              // fallback so drafts/in-progress items can still be opened.
              // Norman May 22: "It would be awesome for the user to be
              // able to check out the blogs before they're posted."
              const href = item.url ?? item.previewUrl ?? null;
              const isPreview = !item.url && Boolean(item.previewUrl);
              const inner = (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9.5px] uppercase tracking-widest font-bold text-muted-foreground">
                      {item.format}
                    </span>
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: pill.bg,
                        color: pill.fg,
                      }}
                    >
                      {pill.label}
                    </span>
                    {href ? (
                      <span className="text-[9.5px] font-semibold text-primary ml-auto whitespace-nowrap">
                        {isPreview ? "Preview →" : "Open →"}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[13px] font-medium text-foreground mt-0.5 leading-snug">
                    {item.title}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">
                    Updated {new Date(item.publishedAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </div>
                </>
              );
              return (
                <li
                  key={`${item.title}-${i}`}
                  className="rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:bg-muted/30 -m-3 p-3 rounded-lg transition-colors"
                    >
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

// contentStatusPill — maps a ContentDraft / NeighborhoodPage status
// string to a colored chip so the operator can tell at a glance
// what's in draft vs. shipped vs. needs-review. Tones stay inside
// the blue palette so the report never breaks into amber/red except
// for explicit negative-review surfaces.
function contentStatusPill(status: string): {
  label: string;
  bg: string;
  fg: string;
} {
  const s = status.toLowerCase();
  if (s === "shipped" || s === "published")
    return { label: "live", bg: "#DCFCE7", fg: "#166534" };
  if (s === "approved") return { label: "approved", bg: "#DBEAFE", fg: "#1E40AF" };
  if (s === "pending_review")
    return { label: "in review", bg: "#FEF3C7", fg: "#92400E" };
  if (s === "changes_requested")
    return { label: "revising", bg: "#FEF3C7", fg: "#92400E" };
  if (s === "generating")
    return { label: "drafting", bg: "#EDE9FE", fg: "#5B21B6" };
  if (s === "draft") return { label: "draft", bg: "#E5E7EB", fg: "#374151" };
  return { label: s, bg: "#E5E7EB", fg: "#374151" };
}

// ---------------------------------------------------------------------------
// TopPerformersStrip — pinned at the bottom of every report. Three
// columns that answer "what's working RIGHT NOW?":
//   1. Top organic queries (clicks)
//   2. Top reputation source (mention count)
//   3. Top competitor citation gap (AEO)
// Each column is its own card so ownership ends the report on the most
// actionable specifics. Renders only when the underlying lists have
// content.
// ---------------------------------------------------------------------------
function TopPerformersStrip({ snapshot }: { snapshot: ReportSnapshot }) {
  const topQuery = snapshot.topQueries[0] ?? null;
  const topPage = snapshot.topPages[0] ?? null;
  const topCompetitor = snapshot.aeoStats?.topCompetitors[0] ?? null;
  const topMentionSource =
    snapshot.reputationStats?.sourceBreakdown
      ? [...snapshot.reputationStats.sourceBreakdown].sort(
          (a, b) => b.count - a.count,
        )[0] ?? null
      : null;
  // If everything is empty, render nothing — don't pad the bottom of
  // a brand-new report with empty cards.
  if (!topQuery && !topPage && !topCompetitor && !topMentionSource) return null;
  return (
    <section
      className="ls-report-section grid gap-2"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
      aria-label="Top performers this period"
    >
      {topQuery ? (
        <Card
          eyebrow="Top organic query"
          value={`#${topQuery.position.toFixed(1)}`}
          headline={`“${topQuery.query}”`}
          sub={`${topQuery.clicks.toLocaleString()} clicks · ${topQuery.impressions.toLocaleString()} impressions`}
          tone="good"
        />
      ) : null}
      {topCompetitor ? (
        <Card
          eyebrow="Biggest AI search gap"
          value={`×${topCompetitor.mentions}`}
          headline={topCompetitor.name}
          sub={`Cited ${topCompetitor.mentions}× more than you on discovery queries`}
          tone="warn"
        />
      ) : null}
      {topMentionSource ? (
        <Card
          eyebrow="Most active reputation channel"
          value={topMentionSource.count.toLocaleString()}
          headline={prettySource(topMentionSource.source)}
          sub={`${topMentionSource.count} mentions tracked across this source`}
          tone="neutral"
        />
      ) : topPage ? (
        <Card
          eyebrow="Top landing page"
          value={topPage.sessions.toLocaleString()}
          headline={topPage.url}
          sub={`${topPage.sessions} sessions · ${topPage.clicks} GSC clicks`}
          tone="good"
        />
      ) : null}
    </section>
  );
}

function Card({
  eyebrow,
  value,
  headline,
  sub,
  tone,
}: {
  eyebrow: string;
  value: string;
  headline: string;
  sub: string;
  tone: "good" | "warn" | "neutral";
}) {
  // Norman feedback (May 22): kill the yellow warn tone. All three
  // tones now sit in the brand blue palette — "warn" uses a denser
  // blue gradient so it still pops as the call-to-action tile, "good"
  // is a softer brand tint, neutral stays plain card.
  const isGradient = tone === "warn" || tone === "good";
  const toneCls =
    tone === "warn"
      ? "border-blue-200/80"
      : tone === "good"
        ? "border-primary/20"
        : "border-border bg-card";
  return (
    <div
      className={`rounded-2xl border ${toneCls} px-4 py-3.5`}
      style={
        isGradient
          ? {
              backgroundImage:
                tone === "warn"
                  ? "linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 70%)"
                  : "linear-gradient(135deg, #F5F9FF 0%, #FFFFFF 70%)",
            }
          : undefined
      }
    >
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {eyebrow}
      </p>
      <p className="mt-0.5 text-[22px] font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[12px] font-medium text-foreground leading-snug truncate">
        {headline}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
        {sub}
      </p>
    </div>
  );
}

function prettySource(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// AeoEngineLogo — maps engine names from the AEO scan to the real brand
// marks (ChatGPT, Claude, Perplexity, Gemini). Falls back to a neutral
// blue dot for unrecognised engines so a future addition (e.g. Grok)
// renders something sensible instead of blank space.
// ---------------------------------------------------------------------------
function AeoEngineLogo({ engine }: { engine: string }) {
  const key = engine.toLowerCase();
  if (key.includes("chatgpt") || key.includes("openai") || key === "gpt")
    return <ChatGPTMark size={16} />;
  if (key.includes("claude") || key.includes("anthropic"))
    return <ClaudeMark size={16} />;
  if (key.includes("perplexity") || key === "pplx")
    return <PerplexityMark size={16} />;
  if (key.includes("gemini") || key.includes("google"))
    return <GeminiMark size={16} />;
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
    </span>
  );
}

function prettyEngineName(engine: string): string {
  const key = engine.toLowerCase();
  if (key.includes("chatgpt") || key.includes("openai") || key === "gpt")
    return "ChatGPT";
  if (key.includes("claude") || key.includes("anthropic")) return "Claude";
  if (key.includes("perplexity") || key === "pplx") return "Perplexity";
  if (key.includes("gemini")) return "Gemini";
  // Already-prettified engines (e.g. "ChatGPT") pass through.
  return engine
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// ReviewSourceLogo — inline SVG brand marks for the reputation channels
// the platform tracks. Mirrors the icons in
// components/portal/reputation/source-logo.tsx but kept server-safe
// (no "use client") so the report can server-render without hydration.
// ---------------------------------------------------------------------------
function ReviewSourceLogo({ source }: { source: string }) {
  const key = source.toLowerCase();
  const sz = 14;
  if (key.includes("google"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    );
  if (key.includes("reddit"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="#FF4500" aria-hidden="true">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249z" />
      </svg>
    );
  if (key.includes("yelp"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="#AF0606" aria-hidden="true">
        <path d="M20.16 12.594l-4.995-1.433a1.085 1.085 0 0 0-1.318 1.548l2.247 4.692a1.088 1.088 0 0 0 1.48.428 6.967 6.967 0 0 0 2.883-4.154 1.087 1.087 0 0 0-.297-1.081zm-1.93 5.99l-3.98-3.121a1.086 1.086 0 0 0-1.748.753l-.328 5.16a1.08 1.08 0 0 0 .735 1.084c1.547.548 3.222.547 4.77-.002a1.083 1.083 0 0 0 .551-1.59zm-6.865-5.39a1.091 1.091 0 0 0-1.085-.785L4.58 12.12a1.08 1.08 0 0 0-.814.615 1.06 1.06 0 0 0-.049.865c.548 1.544 1.53 2.896 2.85 3.911a1.083 1.083 0 0 0 1.585-.32l3.222-4.029c.291-.364.365-.859.191-1.293zm2.14-2.51l-1.03-10.24a1.085 1.085 0 0 0-1.2-.984 6.967 6.967 0 0 0-4.766 2.626 1.085 1.085 0 0 0 .095 1.415l5.75 6.91c.4.477 1.1.58 1.632.247.452-.286.684-.836.516-1.361z" />
      </svg>
    );
  if (key.includes("facebook"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  if (key.includes("instagram"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="#E4405F" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    );
  // Fallback — a small globe glyph in muted blue so generic "WEB"
  // sources still pick up a visual indicator instead of empty space.
  return (
    <svg
      width={sz}
      height={sz}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2563EB"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LifecycleStrip — AppFolio lease + application counts pulled from the
// AppFolio mirror tables. Sits at the top of the Traffic & Leads tab
// so ownership sees the real pipeline number (e.g. "TC signed 20+
// leases this period") even when the form/chatbot Lead count is low.
// Norman bug May 22 — without this, every conversion stage past NEW
// read 0 because Lease rows weren't joined to Lead rows.
// ---------------------------------------------------------------------------
// LeaseVelocitySparkline — small monthly-bars chart pinned next to the
// active-leases hero so the 90-leases headline reads as a real curve
// (Jul/Aug move-in + Jan signing peak, May = off-season). Pure SVG so
// it server-renders + prints cleanly.
function LeaseVelocitySparkline({
  data,
}: {
  data: Array<{ month: string; count: number }>;
}) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 260;
  const h = 56;
  const barW = w / data.length;
  return (
    <div className="space-y-1">
      <div className="text-[9.5px] tracking-widest uppercase font-bold text-muted-foreground">
        12-month lease velocity
      </div>
      <svg
        viewBox={`0 0 ${w} ${h + 12}`}
        width="100%"
        height={h + 12}
        aria-hidden="true"
        className="overflow-visible"
      >
        {data.map((d, i) => {
          const barH = Math.max(2, (d.count / max) * h);
          const x = i * barW + 2;
          const y = h - barH;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={y}
                width={Math.max(2, barW - 4)}
                height={barH}
                rx={1.5}
                fill="#2563EB"
                opacity={d.count > 0 ? 1 : 0.18}
              />
              {d.count > 0 ? (
                <text
                  x={x + (barW - 4) / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fill="#1D4ED8"
                >
                  {d.count}
                </text>
              ) : null}
              <text
                x={x + (barW - 4) / 2}
                y={h + 9}
                textAnchor="middle"
                fontSize="7"
                fill="#94A3B8"
                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function monthLabel(yyyymm: string): string {
  const [, m] = yyyymm.split("-");
  const names = ["", "J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  return names[parseInt(m, 10)] ?? "";
}

function LifecycleStrip({ stats }: { stats: ReportLifecycleStats }) {
  const deltaPct =
    stats.priorLeasesSignedInPeriod > 0
      ? Math.round(
          ((stats.leasesSignedInPeriod - stats.priorLeasesSignedInPeriod) /
            stats.priorLeasesSignedInPeriod) *
            100,
        )
      : null;
  // Norman feedback (May 22, second pass): "the lifecycle pipeline
  // looks pretty bland". Root cause was sparse: with applications +
  // approved both 0 (AppFolio hasn't synced the application table for
  // SG), the strip read as half-empty zero tiles. We now only render
  // tiles that have real data — bland zeros never make it on screen
  // and the active-leases hero gets meaningful breathing room.
  const showApplications = stats.applicationsInPeriod > 0;
  const showSigned180 = stats.leasesSignedLast180d > 0;
  const showSignedPeriod = stats.leasesSignedInPeriod > 0;

  // Compute renewal/retention proxy: most tenants renew, so even a
  // zero-signed window typically has dozens of active leases churning
  // through. Surface "avg lease months remaining" if we have endDate
  // data downstream — but for the first cut, just keep the columns
  // honest. Span heroes when there's nothing to show beside them.
  const sideTiles = [showSignedPeriod, showSigned180, showApplications].filter(
    Boolean,
  ).length;
  // Norman feedback (May 22): the right-hand side tiles read as
  // empty wells when they were narrow + only carried a single
  // value. The hero now claims the whole row when there are zero
  // or just one side tile (so the velocity sparkline gets real
  // breathing room and we never ship a half-empty grid). With
  // multiple side tiles the layout reverts to a balanced 2-column
  // split where the hero still gets at least half the width.
  const heroSpan =
    sideTiles === 0
      ? "lg:col-span-4"
      : sideTiles === 1
        ? "lg:col-span-3"
        : "lg:col-span-2";
  // Side tiles stack vertically inside their column when we've got
  // two of them — much denser than parking them in narrow boxes
  // alongside the hero. Operations tab swaps to inline tiles only
  // when there are 3+ side metrics (rare — needs Application sync).
  const sideStacked = sideTiles === 2;
  return (
    <Section
      className="ls-report-section"
      eyebrow="AppFolio · live lease sync"
      title="Lifecycle pipeline"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-stretch">
        {/* Headline gradient tile — always rendered. Combines the
            closed-loop floor (active leases) with the 12-month
            velocity sparkline so ownership can immediately see WHEN
            those leases were signed (Jul/Aug move-in + Jan peak for
            student housing). Norman bug May 22: the 90 number read
            as suspicious next to the "1 signed in 28d" tile because
            the visual context was missing. */}
        <div
          className={`rounded-2xl border border-primary/20 px-4 sm:px-5 py-4 ${heroSpan}`}
          style={{
            backgroundImage:
              "linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 50%, #FFFFFF 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
                Active leases · right now
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                <div
                  className="text-[40px] sm:text-[52px] font-bold tabular-nums leading-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #1D4ED8 0%, #2563EB 35%, #3B82F6 70%, #60A5FA 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {stats.activeLeases.toLocaleString()}
                </div>
                <span className="text-[12px] font-semibold text-primary uppercase tracking-wider">
                  leases on the books
                </span>
              </div>
              <div className="mt-2 text-[11.5px] text-muted-foreground leading-relaxed max-w-md">
                Closed-loop floor straight from the AppFolio lease sync —
                the retained-revenue number ownership cares about most.
                Updates automatically with every AppFolio webhook.
              </div>
            </div>
            {stats.monthlySignedLast12 &&
            stats.monthlySignedLast12.length > 0 ? (
              <div className="w-full sm:w-auto sm:min-w-[280px]">
                <LeaseVelocitySparkline data={stats.monthlySignedLast12} />
              </div>
            ) : null}
          </div>
        </div>
        {/* Side tiles. When there are exactly 2 (SG case: Signed
            period + Signed 180d) we stack them vertically inside a
            single 2-col-spanning slot — short tiles look much less
            empty stacked than spread across two narrow boxes. With
            3+ they go inline. */}
        {sideStacked ? (
          // Norman May 22 mobile bug: was grid-cols-1 which stacked
          // the two tiles vertically as full-width rows. They should
          // sit side-by-side at every breakpoint so the strip reads
          // as a single horizontal row (1x3) on phone instead of a
          // 3-row tall column.
          <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-1 gap-2 self-stretch">
            {showSignedPeriod ? (
              <SideLifecycleTile
                label="Signed · period"
                value={stats.leasesSignedInPeriod}
                hint="Lease.startDate in window"
                delta={deltaPct}
              />
            ) : null}
            {showSigned180 ? (
              <SideLifecycleTile
                label="Signed · last 180d"
                value={stats.leasesSignedLast180d}
                hint="Seasonal rolling 6-month"
              />
            ) : null}
            {showApplications ? (
              <SideLifecycleTile
                label="Applications · period"
                value={stats.applicationsInPeriod}
                hint={`${stats.applicationsApprovedInPeriod} approved`}
              />
            ) : null}
          </div>
        ) : (
          <>
            {showSignedPeriod ? (
              <SideLifecycleTile
                label="Signed · period"
                value={stats.leasesSignedInPeriod}
                hint="Lease.startDate in window"
                delta={deltaPct}
              />
            ) : null}
            {showSigned180 ? (
              <SideLifecycleTile
                label="Signed · last 180d"
                value={stats.leasesSignedLast180d}
                hint="Seasonal rolling 6-month"
              />
            ) : null}
            {showApplications ? (
              <SideLifecycleTile
                label="Applications · period"
                value={stats.applicationsInPeriod}
                hint={`${stats.applicationsApprovedInPeriod} approved`}
              />
            ) : null}
          </>
        )}
      </div>
    </Section>
  );
}

function SideLifecycleTile({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: number;
  hint: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3 h-full">
      <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-[24px] font-bold tabular-nums text-foreground leading-none">
          {value.toLocaleString()}
        </div>
        {delta != null ? <DeltaPill value={delta} currentValue={value} /> : null}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FunnelStrip — replaces the old FunnelList bar chart Norman called out.
// Renders each non-empty stage as a flat MiniStat tile in a horizontal
// row with an inline conversion-rate hint between adjacent stages, so
// the reader sees "New 3 → Tour scheduled 0 (0%) → Toured 0 (—)" as a
// dense data strip instead of a row of empty bars.
// ---------------------------------------------------------------------------
function FunnelStrip({ stages }: { stages: ReportSnapshot["funnel"] }) {
  if (stages.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No pipeline activity in this window yet.
      </p>
    );
  }
  return (
    <ol
      className="grid gap-1.5"
      // Norman May 22 mobile bug: at 390px viewport with 7 stages,
      // each cell is ~50px wide and the labels truncate to "N...",
      // "T S...", etc. auto-fit wraps to 2 rows on mobile (4+3) so
      // each cell gets ~90px minimum and labels read cleanly.
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(85px, 1fr))`,
      }}
    >
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const dropPct =
          prev && prev.count > 0
            ? Math.round((s.count / prev.count) * 100)
            : null;
        // Norman May 22: zeros made the strip look bland. Non-zero
        // tiles now read as filled brand cards; zero tiles fade to
        // a tighter outline so the eye lands on the real data
        // (NEW 3, SIGNED 1) instead of a row of identical white
        // cells.
        const isZero = s.count === 0;
        return (
          <li
            key={s.stage}
            className={`rounded-xl border px-3 py-2.5 relative ${
              isZero
                ? "border-dashed border-border bg-transparent"
                : "border-primary/30 bg-primary/[0.04]"
            }`}
          >
            <p className="text-[9.5px] tracking-widest uppercase font-bold text-muted-foreground truncate">
              {s.stage}
            </p>
            <p
              className={`mt-0.5 text-[20px] font-bold tabular-nums leading-none ${
                isZero ? "text-muted-foreground/60" : "text-foreground"
              }`}
            >
              {s.count.toLocaleString()}
            </p>
            {dropPct != null ? (
              <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                {dropPct}% from prev
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
