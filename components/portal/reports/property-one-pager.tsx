import type * as React from "react";
import type { ReportSnapshot } from "@/lib/reports/generate";
import { ReportMotionStyles } from "./report-motion-styles";
import {
  type PropertyMeta,
  compactUsd,
  num,
  pct,
  periodLabel,
  addressLine,
  websiteLink,
  EngineMark,
  engineLabel,
  toMentionSource,
  SourceGlyph,
  SectionHeading,
  Stat,
  Sparkline,
  Stars,
  TILE_FILL,
} from "./snapshot-shared";

// ---------------------------------------------------------------------------
// PropertyOnePager — a single-page "Marketing & Performance Snapshot" for one
// property, rendered from a ReportSnapshot. Pure presentation: every number
// comes from the snapshot, so the same component works for any property in any
// org. Sections degrade gracefully when their data is absent.
//
// This is the PRINT / PDF surface. The interactive on-screen experience is the
// tabbed ReportDashboard (components/portal/reports/dashboard) — both share the
// primitives in snapshot-shared.tsx so they never drift.
// ---------------------------------------------------------------------------

// Optional building image shown in the report header. Portfolio reports
// (propertyId null) are titled with the ORG name, so `caption` names the
// building the photo actually shows — a report headed "SG Real Estate"
// carrying an unlabelled Telegraph Commons photo would read as if the
// whole portfolio were that one building.
export type ReportHeroImage = {
  imageUrl: string;
  name: string;
  caption: string | null;
};

type Props = {
  snapshot: ReportSnapshot;
  property: PropertyMeta;
  hero?: ReportHeroImage | null;
};

// "https://www.telegraphcommons.com/floor-plans/1-bed" -> "/floor-plans/1-bed".
// A client reading their own report does not need the host repeated six
// times, and the full URL wraps at this column width. Falls back to the
// raw string if the value was never a parseable URL.
function pagePath(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    return path === "" ? "Home page" : path;
  } catch {
    return url;
  }
}

export function PropertyOnePager({ snapshot, property, hero }: Props) {
  const { kpis, occupancyStats, renewalStats, lifecycleStats, reputationStats, aeoStats, chatbotStatsExtended, leadSources, topPages, visitorStats } =
    snapshot;

  // Presentation-only suppression (2026-08-13). Operator-chosen at
  // generation time (snapshot.hiddenSections) — for client-facing reports
  // where a sensitive or zero-data section reads as noise. Absent = show
  // everything (legacy snapshots unchanged).
  const hidden = new Set(snapshot.hiddenSections ?? []);
  const hideMoney = hidden.has("money");
  const hideTurnover = hidden.has("turnover");
  const hideUntracked = hidden.has("untracked-sources");

  const addr = addressLine(property);
  const site = websiteLink(property.websiteUrl);
  const sources = leadSources ?? [];
  // Only visitors filed under a launched building reach the snapshot, so 0
  // means "nothing attributable", not "no traffic". See the tile below.
  const identifiedVisitors = kpis.identifiedVisitors ?? 0;
  const monthlySigned = lifecycleStats?.monthlySignedLast12 ?? [];
  const repMaxCount = Math.max(
    1,
    ...(reputationStats?.sourceBreakdown ?? []).map((r) => r.count),
  );
  // "custom" (all-time) reports compare against a prior window that
  // predates tracking entirely — a "From 36 prior" pill there is not a
  // real comparison, just noise. Weekly/monthly reports keep their pills.
  const showDeltas = snapshot.kind !== "custom";
  // Most-visited pages, strongest first. `clicks` is 0 on every row for
  // GA4-only orgs (it needs GSC page-level data), so the list reports
  // sessions alone rather than a column of zeros. Pages with no sessions
  // are dropped, not listed at 0.
  const pageRows = (topPages ?? []).filter((p) => p.sessions > 0).slice(0, 6);
  // Geography is the only visitor cut that survives scrutiny. The stored
  // age/gender breakdowns come from third-party enrichment and are plainly
  // wrong for this asset class (they skew 55+ for student housing next to a
  // university) — a client who spots that stops trusting the whole document.
  const cityRows = (visitorStats?.topCities ?? []).filter((c) => c.count > 0).slice(0, 5);
  const stateRows = (visitorStats?.topStates ?? []).filter((r) => r.count > 0).slice(0, 3);
  const topStateLine = stateRows.length
    ? `Top states: ${stateRows.map((r) => `${r.state} ${r.count}`).join(" \u00b7 ")}`
    : null;

  // Section claims. The report used to be a grid of labelled panels and left
  // the reader to assemble the argument; each of these states in one sentence
  // what the numbers below it prove. Assembled from clauses so a missing or
  // zero input drops its clause instead of writing "0 sessions reached the
  // site" — same rule as every tile on the page. No surviving clause means
  // no sentence.
  const organicSessions = kpis.organicSessions ?? 0;
  const trafficClauses = [
    organicSessions > 0
      ? `${num(organicSessions)} organic search sessions reached the site in this window`
      : null,
    identifiedVisitors > 0
      ? organicSessions > 0
        ? `and the visitor pixel put a name and an email to ${num(identifiedVisitors)} of the people behind them`
        : `The visitor pixel put a name and an email to ${num(identifiedVisitors)} of the people who came through`
      : null,
  ].filter(Boolean);
  const trafficClaim = trafficClauses.length ? `${trafficClauses.join(", ")}.` : null;

  const chatConversations = chatbotStatsExtended?.conversations ?? 0;
  const chatLeads = chatbotStatsExtended?.leadsFromChat ?? 0;
  const acquisitionClaim =
    chatConversations > 0 && chatLeads > 0 && kpis.leads > 0
      ? `The chatbot answered ${num(chatConversations)} conversations and captured ${num(chatLeads)} of the ${num(kpis.leads)} leads that came in.`
      : chatConversations > 0
        ? `The chatbot answered ${num(chatConversations)} conversations in this window.`
        : null;

  // Responsive note: every multi-column zone stacks (or drops to 2-up) below
  // `sm`, restores at `sm:`, and is pinned again with a `print:` variant.
  // The print viewport is US Letter minus 0.5in margins ≈ 720px — wider than
  // `sm` (640) but narrower than `md` (768) — so sm: alone would keep print
  // intact today, and the print: pin keeps it intact if margins ever grow.
  // Headline band. Order is the story the report tells: leads came in,
  // leases got signed, and N of those trace back to a lead we captured.
  // Occupancy + rent roll join the row when they aren't suppressed.
  const leasesSigned = lifecycleStats?.leasesSignedInPeriod ?? 0;
  const priorLeases = lifecycleStats?.priorLeasesSignedInPeriod ?? 0;
  const headlineResults: Array<{
    value: string;
    label: string;
    delta?: { up: boolean; text: string };
    note?: string;
  }> = [
    {
      value: num(kpis.leads),
      label: "New leads",
      delta:
        showDeltas && snapshot.kpiDeltas?.leadsPct != null
          ? {
              up: snapshot.kpiDeltas.leadsPct >= 0,
              text: `${snapshot.kpiDeltas.leadsPct >= 0 ? "Up" : "Down"} vs prior period`,
            }
          : undefined,
    },
    {
      value: num(leasesSigned),
      label: "Leases signed",
      delta:
        showDeltas && !(leasesSigned === 0 && priorLeases === 0)
          ? { up: leasesSigned >= priorLeases, text: `From ${priorLeases} prior` }
          : undefined,
    },
    ...(snapshot.tracedSignedLeads
      ? [
          {
            value: num(snapshot.tracedSignedLeads),
            label: "Traced to a captured lead",
            note: "Lead \u2192 lease, same resident",
          },
        ]
      : []),
    ...(hideTurnover
      ? []
      : [
          {
            value:
              occupancyStats?.occupancyPct != null
                ? pct(occupancyStats.occupancyPct)
                : "\u2014",
            label: `Occupancy across ${occupancyStats?.totalUnits ?? 0} units`,
            note:
              (occupancyStats?.onNotice ?? 0) > 0
                ? `${occupancyStats?.onNotice} residents on notice`
                : undefined,
          },
        ]),
    ...(hideMoney
      ? []
      : [
          {
            value: compactUsd(occupancyStats?.monthlyRentRollUsd),
            label: "Monthly rent roll",
            note:
              occupancyStats?.avgRentPerUnitUsd != null
                ? `${compactUsd(occupancyStats.avgRentPerUnitUsd)} avg per unit`
                : undefined,
          },
        ]),
  ];

  return (
    <div className="mx-auto w-full max-w-[880px] rounded-[2px] border border-border bg-card p-4 text-foreground shadow-sm sm:p-6 print:border-0 print:p-6 print:shadow-none">
      {/* Cover. Bleeds to the card edges (negative margins cancel the card
          padding) so it reads as the report's title page, not a dashboard
          strip. Property name is the headline; the document type is a label.
          The building sits on a flat tinted panel with object-contain +
          bottom anchoring: stored heroes are small background-removed
          cutouts (TC is 466x536), so a full-bleed cover crop would blur and
          clip the roofline — the reason the old wide banner was pulled. */}
      <ReportMotionStyles />
      <div className="ls-view-rise">
        <header className="-mx-4 -mt-4 mb-5 border-b border-border sm:-mx-6 sm:-mt-6 print:-mx-6 print:-mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-1.5 sm:px-6 print:px-6">
            <span className="ls-eyebrow">Marketing &amp; Performance Report</span>
            <div className="flex items-center gap-2">
              <span className="ls-eyebrow hidden sm:inline print:inline">Prepared by</span>
              {/* The asset is the bare building mark on a padded canvas (no
                  lettering), so the name is set alongside it — a prospect
                  seeing the mark alone wouldn't know who prepared this. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/leasestack-wordmark.png"
                alt=""
                aria-hidden
                className="-mx-1 block h-9 w-auto"
              />
              <span className="text-[14px] font-semibold tracking-[-0.01em]">
                LeaseStack
              </span>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${hero ? "sm:grid-cols-[210px_1fr] print:grid-cols-[190px_1fr]" : ""}`}
          >
            {hero ? (
              /* Transparent by design: the stored hero is a background-removed
                 cutout, so it sits directly on the card with a soft ground
                 shadow instead of inside a tinted tile. Rendered at ~2x its
                 display width (source is 466px wide) so it stays crisp. */
              <figure className="flex flex-col items-center justify-end px-4 pb-4 pt-4 sm:items-start sm:px-6 sm:pb-5 sm:pt-6 print:px-6 print:pt-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero.imageUrl}
                  alt={hero.name}
                  className="block h-auto max-h-[150px] w-auto max-w-full object-contain [filter:drop-shadow(0_12px_16px_rgba(22,22,22,0.16))] sm:max-h-[168px] print:max-h-[150px]"
                />
                {hero.caption ? (
                  <figcaption className="mt-2.5 text-[10px] font-medium leading-tight text-muted-foreground">
                    {hero.caption}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}

            <div className="flex min-w-0 flex-col justify-end px-4 pb-4 pt-1 sm:px-6 sm:pb-5 sm:pt-6 print:px-6 print:pt-5">
              <h1 className="text-[27px] font-semibold leading-[1.03] tracking-[-0.025em] sm:text-[34px] print:text-[30px]">
                {property.name}
              </h1>
              {/* One meta line. The period used to need its own labelled row
                  beside "Attribution: First-touch" — a band of chrome to say
                  what the section headings already say inline. */}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {addr ? <span>{addr}</span> : null}
                {addr && site ? <span aria-hidden className="h-3 w-px bg-border" /> : null}
                {site ? (
                  <a
                    href={site.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                  >
                    {site.label}
                  </a>
                ) : null}
                {addr || site ? <span aria-hidden className="h-3 w-px bg-border" /> : null}
                <span className="font-medium text-foreground">{periodLabel(snapshot)}</span>
              </p>

            </div>
          </div>
        </header>
      </div>

      {/* Headline results. One band, not a row of half-empty cards: with
          money + turnover suppressed only two KPIs survive, and two cards
          stretched across 880px is mostly padding. The band is built from
          whatever survives, so a full-data report still reads as one row.
          `traced` sits here rather than beside the leases chart — it is the
          proof the marketing caused the leases, which is the whole point of
          the document. */}
      <div className="ls-view-rise">
        <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-[2px] border border-border bg-card sm:flex sm:divide-y-0 print:flex print:divide-y-0">
          {headlineResults.map((r) => (
            <div key={r.label} className="min-w-0 flex-1 px-4 py-3.5">
              <div className="ls-metric text-[26px] leading-none sm:text-[30px]">
                {r.value}
              </div>
              <div className="mt-1.5 truncate text-[11px] font-medium text-muted-foreground">
                {r.label}
              </div>
              {r.delta ? (
                <div
                  className={`mt-1 truncate text-[10px] font-semibold ${
                    r.delta.up ? "text-success" : "text-destructive"
                  }`}
                >
                  {r.delta.up ? "\u25b2" : "\u25bc"} {r.delta.text}
                </div>
              ) : r.note ? (
                <div className="mt-1 truncate text-[10px] font-medium text-muted-foreground">
                  {r.note}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Reach. The document argues a chain — we drove traffic, we captured
          leads from it, they became leases — so the traffic evidence has to
          come BEFORE the capture section that spends it.

          There is no trend line here on purpose. The weekly series is real
          but falls across a long window, and a descending chart set full
          width is the loudest thing on a page whose job is to prove the
          work landed. Which pages carry the site is the same claim ("people
          arrive and go deep") without the editorial. The trend stays on the
          operator dashboard, where a decline is information rather than a
          pitch. */}
      {pageRows.length > 0 || cityRows.length > 0 ? (
        <div className="ls-view-rise">
          <section className="mt-5">
            <SectionHeading>Site traffic</SectionHeading>
            {trafficClaim ? (
              <p className="-mt-1 mb-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {trafficClaim}
              </p>
            ) : null}
            <div
              className={`grid grid-cols-1 gap-6 ${
                pageRows.length > 0 && cityRows.length > 0
                  ? "sm:grid-cols-[1.1fr_0.9fr] print:grid-cols-[1.1fr_0.9fr]"
                  : ""
              }`}
            >
              {pageRows.length > 0 ? (
                <div>
                  <div className="mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    Most-visited pages
                  </div>
                  <div className="flex flex-col gap-2 text-[11.5px]">
                    {pageRows.map((row) => (
                      <div key={row.url} className="flex justify-between gap-3 font-medium text-muted-foreground">
                        <span className="truncate">{pagePath(row.url)}</span>
                        <b className="flex-none font-bold tabular-nums text-foreground">
                          {row.sessions}
                        </b>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[9.5px] font-medium text-muted-foreground">
                    Sessions in period
                  </div>
                </div>
              ) : null}

              {cityRows.length > 0 ? (
                <div>
                  <div className="mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    Where identified visitors are
                  </div>
                  <div className="flex flex-col gap-2 text-[11.5px]">
                    {cityRows.map((c) => (
                      <div key={c.city} className="flex justify-between font-medium text-muted-foreground">
                        <span>{c.city}</span>
                        <b className="font-bold tabular-nums text-foreground">{c.count}</b>
                      </div>
                    ))}
                  </div>
                  {topStateLine ? (
                    <div className="mt-2.5 text-[9.5px] font-medium leading-relaxed text-muted-foreground">
                      {topStateLine}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {/* Acquisition + Leasing momentum */}
      <div className="ls-view-rise">
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-[1.1fr_0.9fr] print:grid-cols-[1.1fr_0.9fr]">
          <section>
            <SectionHeading meta="first-touch">Lead acquisition</SectionHeading>
            {acquisitionClaim ? (
              <p className="-mt-1 mb-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {acquisitionClaim}
              </p>
            ) : null}
            <div className="mb-4 flex flex-col gap-2.5 text-[12.5px]">
              {sources.length === 0 ? (
                <div className="text-muted-foreground">No leads in period.</div>
              ) : (
                sources.map((src) => (
                  <div key={src.source} className="flex items-center gap-2.5 font-medium">
                    <span className="h-2 w-2 flex-none rounded-sm bg-primary" />
                    <span>{src.source}</span>
                    <span className="ml-auto font-semibold text-muted-foreground">
                      {src.count} · {Math.round(src.pct)}%
                    </span>
                  </div>
                ))
              )}
              {!hideUntracked
                ? ["Zillow", "Apartments.com"].map((s) => (
                    <div key={s} className="flex items-center gap-2.5 font-medium text-muted-foreground">
                      <span className="h-2 w-2 flex-none rounded-sm bg-muted-foreground/30" />
                      <span>{s}</span>
                      <span className="ml-auto">not tracked</span>
                    </div>
                  ))
                : null}
            </div>
            {/* identifiedVisitors === 0 is dropped rather than rendered as "0",
                the same rule the popup tiles below already follow. A zero here
                almost never means "nobody visited" — it means no visitor row
                could be filed under a launched building (Visitor.propertyId
                unstamped, or every property inactive), so the pixel section has
                nothing it can honestly claim. Printing "0 Identified visitors"
                next to real chatbot numbers reads as a measured result instead
                of absent data. Omit the claim; the coverage strip below still
                reports the pixel's actual state. */}
            <div className={`grid grid-cols-2 gap-2.5 ${TILE_FILL} ${identifiedVisitors > 0 ? "sm:grid-cols-3 print:grid-cols-3" : ""}`}>
              <Stat value={num(chatbotStatsExtended?.conversations)} label="Chatbot conversations" />
              <Stat value={chatbotStatsExtended?.capturedRatePct != null ? pct(chatbotStatsExtended.capturedRatePct) : "—"} label="Lead capture rate" />
              {identifiedVisitors > 0 ? (
                <Stat value={num(identifiedVisitors)} label="Identified visitors" />
              ) : null}
            </div>
            {snapshot.popupStats ? (
              <div className={`mt-3.5 grid grid-cols-2 gap-2.5 ${TILE_FILL} ${snapshot.popupStats.converted > 0 ? "sm:grid-cols-4 print:grid-cols-4" : "sm:grid-cols-3 print:grid-cols-3"}`}>
                {snapshot.popupStats.converted > 0 ? (
                  <>
                    <Stat value={num(snapshot.popupStats.shown)} label="Popups shown" />
                    <Stat value={num(snapshot.popupStats.ctaClicks)} label="CTA clicks" />
                    <Stat value={num(snapshot.popupStats.converted)} label="Converted" />
                    <Stat
                      value={snapshot.popupStats.conversionRate != null ? pct(snapshot.popupStats.conversionRate) : "—"}
                      label="Conversion rate"
                    />
                  </>
                ) : (
                  // converted=0 means the feature is unused/unwired this period —
                  // don't give "0 Converted" / "0% Conversion rate" equal billing
                  // next to real numbers. Show what actually happened instead.
                  <>
                    <Stat value={num(snapshot.popupStats.shown)} label="Popups shown" />
                    <Stat value={num(snapshot.popupStats.ctaClicks)} label="CTA clicks" />
                    <Stat
                      value={snapshot.popupStats.shown > 0 ? pct((snapshot.popupStats.ctaClicks / snapshot.popupStats.shown) * 100) : "—"}
                      label="CTA rate"
                    />
                  </>
                )}
              </div>
            ) : null}
          </section>

          <section>
            <SectionHeading>Leasing momentum</SectionHeading>
            <div className={`grid grid-cols-2 gap-2.5 ${TILE_FILL} ${hideMoney ? "" : "sm:grid-cols-3 print:grid-cols-3"}`}>
              <Stat value={num(lifecycleStats?.leasesSignedLast180d)} label="Signed, last 180 days" />
              <Stat value={num(lifecycleStats?.activeLeases)} label="Active leases" />
              {!hideMoney ? (
                <Stat value={compactUsd(renewalStats?.pastDueBalanceUsd)} label="Past-due balance" />
              ) : null}
            </div>
            {monthlySigned.length ? (
              <>
                <div className="mb-1.5 mt-3.5 text-[10px] font-medium text-muted-foreground">
                  Leases signed, last 12 months
                </div>
                <Sparkline values={monthlySigned.map((m) => m.count)} reveal />
                <div className="mt-1.5 flex justify-between text-[9px] font-medium text-muted-foreground">
                  <span>{monthlySigned[0]?.month}</span>
                  <span>{monthlySigned[monthlySigned.length - 1]?.month}</span>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>

      {/* Renewals + Reputation — same column split as the Acquisition +
          Leasing zone above so the two left/right boundaries line up as
          the page scans down. When turnover is suppressed, reputation
          takes the full width. */}
      <div className="ls-view-rise">
        <div className={`mt-5 grid grid-cols-1 gap-6 ${hideTurnover ? "" : "sm:grid-cols-[1.1fr_0.9fr] print:grid-cols-[1.1fr_0.9fr]"}`}>
          {!hideTurnover ? (
            <section>
              <SectionHeading>Renewals at risk</SectionHeading>
              <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 print:grid-cols-3 ${TILE_FILL}`}>
                <Stat value={num(renewalStats?.expiringNext30)} label="Expiring within 30 days" />
                <Stat value={num(renewalStats?.expiringNext60)} label="Expiring within 60 days" />
                <Stat value={num(renewalStats?.expiringNext120)} label="Expiring within 120 days" />
              </div>
              <div className={`mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 print:grid-cols-3 ${TILE_FILL}`}>
                {!hideMoney ? (
                  <div className="col-span-2">
                    <Stat value={compactUsd(renewalStats?.monthlyAtRiskUsd)} label="Monthly revenue at risk, next 120 days" flag />
                  </div>
                ) : null}
                {/* Money tile above spans both mobile columns, which would
                    strand this one half-width next to a hole — give it the
                    full row on mobile too. */}
                <div className="max-sm:col-span-2">
                  <Stat value={num(occupancyStats?.onNotice)} label="Residents on notice" />
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <SectionHeading>Online reputation</SectionHeading>
            {reputationStats ? (
              <>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="ls-metric text-[22px] leading-none">
                    {reputationStats.overallRating != null ? reputationStats.overallRating.toFixed(1) : "—"}
                  </span>
                  <Stars rating={reputationStats.overallRating} className="text-[13px]" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {reputationStats.totalReviews} reviews · {reputationStats.positiveCount} positive, {reputationStats.negativeCount} negative
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {reputationStats.sourceBreakdown.slice(0, 4).map((row, i) => (
                    <div key={row.source} className="flex items-center gap-2.5 text-[12px]">
                      <span className="flex h-4 w-4 flex-none items-center justify-center">
                        <SourceGlyph source={toMentionSource(row.source)} className="h-4 w-4" />
                      </span>
                      <span className="w-[74px] font-medium text-muted-foreground">{row.source}</span>
                      <span className="h-4 flex-1 overflow-hidden rounded-[2px] bg-muted">
                        <span
                          className="ls-view-grow-x block h-full rounded-[2px] bg-primary"
                          style={
                            {
                              width: `${Math.round((row.count / repMaxCount) * 100)}%`,
                              "--reveal-step": i,
                            } as React.CSSProperties
                          }
                        />
                      </span>
                      <span className="w-6 text-right font-bold">{row.count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {reputationStats.responseRatePct != null ? (
                    // Neutral always — red is reserved for metrics that sell the
                    // product's value (revenue-at-risk). A low response rate is
                    // an ops stat, not a risk pill that should draw the eye.
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground">
                      {Math.round(reputationStats.responseRatePct)}% response rate
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="text-[12px] text-muted-foreground">No reputation data yet.</div>
            )}
          </section>
        </div>
      </div>

      {/* AI search visibility — the differentiator. Same 2px card language
          as every other section, just a touch more presence via a faint
          brand tint (no gradient, no side-stripe). */}
      {aeoStats && aeoStats.totalChecks > 0 ? (
        <div className="ls-view-rise">
          <section className="mt-5 rounded-[2px] border border-primary/20 bg-primary/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
              <span className="inline-block h-3.5 w-1 rounded-sm bg-primary" />
              AI search visibility
              <span className="ml-auto rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
                LeaseStack exclusive
              </span>
            </h2>
            <p className="my-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {property.name} was cited in{" "}
              <b className="text-foreground">
                {aeoStats.cited} of {aeoStats.totalChecks}
              </b>{" "}
              AI answers ({pct((aeoStats.cited / aeoStats.totalChecks) * 100)}) across the major engines. Competitor properties appeared in {aeoStats.competitorCited}.
            </p>
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-[1.25fr_1fr] print:grid-cols-[1.25fr_1fr]">
              <div>
                <div className="flex flex-col gap-2.5">
                  {(aeoStats.byEngine ?? []).map((row, i) => (
                    <div key={row.engine} className="flex items-center gap-2.5 text-[11.5px]">
                      <span className="flex h-[17px] w-[17px] flex-none items-center justify-center">
                        <EngineMark engine={row.engine} />
                      </span>
                      <span className="w-[74px] font-semibold text-foreground">{engineLabel(row.engine)}</span>
                      <span className="flex h-3 flex-1 overflow-hidden rounded-[2px] bg-elevated">
                        <span
                          className="ls-view-grow-x h-full bg-primary"
                          style={
                            {
                              width: `${row.total ? Math.round((row.cited / row.total) * 100) : 0}%`,
                              "--reveal-step": i,
                            } as React.CSSProperties
                          }
                        />
                      </span>
                      <span className="w-12 text-right font-semibold text-muted-foreground">
                        {row.cited} / {row.total}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-3.5 text-[9.5px] font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block h-2 w-2 rounded-sm bg-primary" /> Times cited
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block h-2 w-2 rounded-sm bg-elevated" /> Total answers checked
                  </span>
                </div>
              </div>
              <div>
                <div className="mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Who AI recommends instead
                </div>
                <div className="flex flex-col gap-2 text-[11.5px]">
                  {aeoStats.topCompetitors.slice(0, 5).map((c) => (
                    <div key={c.name} className="flex justify-between font-medium text-muted-foreground">
                      <span>{c.name}</span>
                      <b className="font-bold text-foreground">{c.mentions}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

    </div>
  );
}
