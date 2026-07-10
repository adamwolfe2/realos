import * as React from "react";
import type { ReportSnapshot } from "@/lib/reports/generate";
import {
  ReportTabs,
  ReportTabPanel,
} from "@/components/portal/reports/report-tabs";
import { PropertyHeroBanner } from "@/components/portal/properties/property-hero-banner";
import {
  ReportPrintHeader,
  ReportHeaderStrip,
} from "@/components/portal/reports/sections/report-header";
import {
  EmptyTabState,
  IconKpi,
  MiniStat,
  Section,
  Table,
  TrendChart,
  formatDate,
  shortUrl,
} from "@/components/portal/reports/sections/report-primitives";
import {
  AiAnalysisSection,
  DataSourcesFooter,
  HeroKpi,
  OverviewSummaryStrip,
  TopPerformersStrip,
} from "@/components/portal/reports/sections/overview-sections";
import { ReputationSection } from "@/components/portal/reports/sections/reputation-section";
import {
  AeoSection,
  AiVisibilitySection,
} from "@/components/portal/reports/sections/aeo-sections";
import {
  ContentSection,
  GroupedInsights,
} from "@/components/portal/reports/sections/insights-content-sections";
import {
  FunnelStrip,
  LifecycleStrip,
  VisitorSection,
  VisitorIntelligenceSection,
} from "@/components/portal/reports/sections/operations-sections";

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

      <ReportPrintHeader
        kindLabel={kindLabel}
        periodLabel={periodLabel}
        orgName={orgName}
        orgLogoUrl={orgLogoUrl}
        headline={headline}
        notes={notes}
        propertyName={snapshot.scope?.propertyName ?? null}
      />

      {/* Header strip */}
      <ReportHeaderStrip
        kindLabel={kindLabel}
        periodLabel={periodLabel}
        orgName={orgName}
        orgLogoUrl={orgLogoUrl}
        headline={headline}
        notes={notes}
        propertyName={snapshot.scope?.propertyName ?? null}
      />

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
                <div className="rounded-[2px] border border-border bg-card px-3 py-2">
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
