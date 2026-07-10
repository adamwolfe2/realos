import * as React from "react";
import type {
  AiAnalysis,
  DataSourceStatus,
  ReportDataSources,
  ReportSnapshot,
} from "@/lib/reports/generate";
import {
  Card,
  DeltaPill,
  Section,
  prettySource,
  shortUrl,
} from "@/components/portal/reports/sections/report-primitives";

export function DataSourcesFooter({ sources }: { sources: ReportDataSources }) {
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
            className="flex items-center justify-between gap-2 rounded-[2px] border border-border bg-card/60 px-2.5 py-1.5"
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

export function HeroKpi({ snapshot }: { snapshot: ReportSnapshot }) {
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
    <section className="ls-report-section rounded-[2px] border border-border bg-card px-5 py-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            {headlineLabel}
          </p>
          <p
            className="mt-1 text-[34px] sm:text-[40px] md:text-[52px] leading-none font-bold tracking-tight tabular-nums"
            style={{ color: "#0f62fe" }}
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
// AI sections (unchanged structure, restyled)
// ---------------------------------------------------------------------------

export function AiAnalysisSection({ analysis }: { analysis: AiAnalysis }) {
  return (
    <section aria-label="AI analysis" className="ls-report-section">
      <div className="rounded-[2px] border border-border bg-card overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-b border-border flex items-center gap-2">
          <span className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
            AI analysis · recommended actions
          </span>
        </div>
        <div className="p-4 pt-3 space-y-3">
          <div className="border-l-2 border-primary bg-primary/5 px-3 py-2 rounded-r-[2px]">
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
    <div className="rounded-[2px] border border-border bg-muted/30 px-3 py-2.5">
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
export function OverviewSummaryStrip({
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
        const isTinted = c.tone === "warn" || c.tone === "good";
        const toneCls =
          c.tone === "warn"
            ? "border-[#a6c8ff] text-foreground"
            : c.tone === "good"
              ? "border-primary/20 text-foreground"
              : "border-border bg-card text-foreground";
        return (
          <div
            key={`${c.eyebrow}-${i}`}
            className={`rounded-[2px] border ${toneCls} px-4 py-3.5`}
            style={
              isTinted
                ? {
                    backgroundColor:
                      c.tone === "warn" ? "#d0e2ff" : "#edf5ff",
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
// TopPerformersStrip — pinned at the bottom of every report. Three
// columns that answer "what's working RIGHT NOW?":
//   1. Top organic queries (clicks)
//   2. Top reputation source (mention count)
//   3. Top competitor citation gap (AEO)
// Each column is its own card so ownership ends the report on the most
// actionable specifics. Renders only when the underlying lists have
// content.
// ---------------------------------------------------------------------------
export function TopPerformersStrip({ snapshot }: { snapshot: ReportSnapshot }) {
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
