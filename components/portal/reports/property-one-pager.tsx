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
  Stars,
} from "./snapshot-shared";
import { LeaseStackMark } from "@/components/brand/leasestack-logo";
import { Search } from "lucide-react";
import {
  BarList,
  ChevronFunnel,
  FigureBand,
  FigureRow,
  MonthBars,
  Panel,
  type Figure,
} from "./one-pager-blocks";
import { leadsSplitNote } from "@/lib/reports/leads-split";

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
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // GA4 landing pages are already site-relative paths ("/availability").
  }
  path = path.replace(/\/$/, "");
  return path === "" ? "Home page" : path;
}

// Client-facing label for a page path: "/" -> "Home page",
// "/availability/655d…" -> "Unit listings", "/floor-plans" -> "Floor plans".
// Per-unit pages are grouped because a column of UUIDs reads as noise.
export function pageLabel(url: string): string {
  const path = pagePath(url);
  if (path === "Home page" || path === "(not set)") return path === "(not set)" ? "" : path;
  const segs = path.split("/").filter(Boolean);
  if (segs.length > 1 && /^[0-9a-f-]{16,}$/i.test(segs[segs.length - 1])) return "Unit listings";
  const last = decodeURIComponent(segs[segs.length - 1] ?? "").replace(/[-_]+/g, " ");
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export function PropertyOnePager({ snapshot, property, hero }: Props) {
  const { kpis, occupancyStats, renewalStats, lifecycleStats, reputationStats, aeoStats, chatbotStatsExtended, leadSources, topPages } =
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
  const pageTotals = [
    ...(topPages ?? []).filter((p) => p.sessions > 0)
      .reduce((acc, p) => {
        const label = pageLabel(p.url);
        if (label) acc.set(label, (acc.get(label) ?? 0) + p.sessions);
        return acc;
      }, new Map<string, number>()),
  ];
  // "/availabilities" is a legacy alias of "/availability": one page to the
  // reader, so a plural label folds into its singular when both are present.
  const merged = new Map<string, number>();
  for (const [label, sessions] of pageTotals) {
    const singular = label.replace(/ies$/, "y");
    const key = singular !== label && pageTotals.some(([l]) => l === singular) ? singular : label;
    merged.set(key, (merged.get(key) ?? 0) + sessions);
  }
  const pageRows = [...merged]
    .map(([label, sessions]) => ({ label, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 6);
  // Google searches that showed the site, most-seen first. Impressions is
  // the honest headline number for a small site: clicks on unbranded
  // queries are often single digits while the appearance itself is the win.
  const queryRows = [...(snapshot.topQueries ?? [])]
    .filter((q) => q.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 6);
  const prospect = snapshot.prospectQuestions;
  const themeRows = (prospect?.themes ?? []).slice(0, 6);

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

  // Layout (2026-10-20 refresh, after Adam's infographic one-pager and an
  // impeccable critique): cover -> one answer sentence -> hairline figure
  // band -> paired panels -> AI visibility. No decorative icon chips; icons
  // only where they identify a source or engine. Every multi-column zone
  // stacks below `sm` and is pinned with `print:` (print viewport ~720px).
  const leasesSigned = lifecycleStats?.leasesSignedInPeriod ?? 0;
  const priorLeases = lifecycleStats?.priorLeasesSignedInPeriod ?? 0;
  const traced = snapshot.tracedSignedLeads ?? 0;
  const plural = (n: number, one: string, many: string) =>
    `${num(n)} ${n === 1 ? one : many}`;

  // The one sentence the report exists to say. Proof first (leases traced to
  // captured leads), falling back to whatever outcome the period has.
  const answer =
    traced && leasesSigned
      ? {
          lead: `${plural(leasesSigned, "lease", "leases")} started this period.`,
          proof: `${num(traced)} ${traced === 1 ? "traces" : "trace"} back to a lead LeaseStack captured.`,
        }
      : leasesSigned
        ? {
            lead: `${plural(leasesSigned, "lease", "leases")} started this period.`,
            proof: null,
          }
        : kpis.leads > 0
          ? {
              lead: `${plural(kpis.leads, "new lead", "new leads")} this period.`,
              proof: null,
            }
          : null;

  const figures: Figure[] = [
    {
      value: num(kpis.leads),
      label: "New leads",
      note: leadsSplitNote(kpis) ?? undefined,
      delta:
        showDeltas && snapshot.kpiDeltas?.leadsPct != null
          ? {
              up: snapshot.kpiDeltas.leadsPct >= 0,
              text: `${snapshot.kpiDeltas.leadsPct >= 0 ? "Up" : "Down"} vs prior period`,
            }
          : undefined,
    },
    ...(lifecycleStats?.applicationsInPeriod
      ? [
          {
            value: num(lifecycleStats.applicationsInPeriod),
            label: "Applications",
          },
        ]
      : []),
    {
      value: num(leasesSigned),
      label: "Leases started",
      delta:
        showDeltas && !(leasesSigned === 0 && priorLeases === 0)
          ? {
              up: leasesSigned >= priorLeases,
              text: `From ${priorLeases} prior`,
            }
          : undefined,
    },
    ...(traced
      ? [{ value: num(traced), label: "Traced to a captured lead" }]
      : []),
    ...(chatConversations > 0
      ? [{ value: num(chatConversations), label: "Chatbot conversations" }]
      : []),
    ...(hideTurnover || occupancyStats?.occupancyPct == null
      ? []
      : [
          {
            value: pct(occupancyStats.occupancyPct),
            label: `Occupancy across ${occupancyStats.totalUnits ?? 0} units`,
            note:
              (occupancyStats.onNotice ?? 0) > 0
                ? `${occupancyStats.onNotice} residents on notice`
                : undefined,
          },
        ]),
    ...(hideMoney || occupancyStats?.monthlyRentRollUsd == null
      ? []
      : [
          {
            value: compactUsd(occupancyStats.monthlyRentRollUsd),
            label: "Monthly rent roll",
            note:
              occupancyStats.avgRentPerUnitUsd != null
                ? `${compactUsd(occupancyStats.avgRentPerUnitUsd)} avg per unit`
                : undefined,
          },
        ]),
  ];

  // Chatbot funnel. Chevrons imply each step is a subset of the last, so
  // they only render when the three counts actually narrow.
  const captured = chatbotStatsExtended?.capturedConversations ?? 0;
  const capturedRate = chatbotStatsExtended?.capturedRatePct;
  const funnelOk =
    chatConversations > 0 &&
    chatConversations >= captured &&
    captured >= chatLeads &&
    chatLeads > 0;
  const popup = snapshot.popupStats;
  const showConversion = chatConversations > 0 || Boolean(popup);
  const conversionLine =
    capturedRate != null && chatConversations > 0
      ? `${pct(capturedRate)} of conversations ended with the visitor sharing contact details.`
      : "Website chatbot and popups, this period.";

  const sourceRows = [
    ...sources.map((s) => ({
      label: s.source,
      value: s.count,
      display: `${s.count} \u00b7 ${Math.round(s.pct)}%`,
    })),
    // Untracked channels only add context next to real rows; under an empty
    // period they would be the whole panel.
    ...(!hideUntracked && sources.length > 0
      ? ["Zillow", "Apartments.com"].map((s) => ({
          label: s,
          value: 0,
          display: "not tracked",
          muted: true,
        }))
      : []),
  ];

  const hasProspect = Boolean(prospect && themeRows.length > 0);
  const showRenewals = !hideTurnover && Boolean(renewalStats);
  const engines = (aeoStats?.enginesUsed ?? []).map(engineLabel);
  const pair = (both: boolean) =>
    `grid grid-cols-1 gap-4 ${both ? "sm:grid-cols-2 print:grid-cols-2" : ""}`;

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
        <header className="-mx-4 -mt-4 mb-4 border-b border-border sm:-mx-6 sm:-mt-6 print:-mx-6 print:-mt-6">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-1.5 sm:gap-4 sm:px-6 print:px-6">
            <span className="ls-eyebrow min-w-0 flex-1">
              Marketing &amp; Performance Report
            </span>
            <div className="flex flex-none items-center gap-2">
              <span className="ls-eyebrow hidden sm:inline print:inline">
                Prepared by
              </span>
              {/* The asset is the bare building mark on a padded canvas (no
                  lettering), so the name is set alongside it — a prospect
                  seeing the mark alone wouldn't know who prepared this. */}
              <LeaseStackMark className="block h-6 w-auto" />
              <span className="text-[14px] font-semibold tracking-[-0.01em]">
                LeaseStack
              </span>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${hero ? "sm:grid-cols-[158px_1fr] print:grid-cols-[148px_1fr]" : ""}`}
          >
            {hero ? (
              /* Transparent by design: the stored hero is a background-removed
                 cutout, so it sits directly on the card with a soft ground
                 shadow instead of inside a tinted tile. Rendered at ~2x its
                 display width (source is 466px wide) so it stays crisp. */
              <figure className="flex flex-col items-start justify-end px-4 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-4 print:px-6 print:pb-3 print:pt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero.imageUrl}
                  alt={hero.name}
                  className="block h-auto max-h-[104px] w-auto max-w-full object-contain [filter:drop-shadow(0_8px_12px_rgba(22,22,22,0.16))] sm:max-h-[116px] print:max-h-[104px]"
                />
                {hero.caption ? (
                  <figcaption className="mt-2.5 text-[10px] font-medium leading-tight text-muted-foreground">
                    {hero.caption}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}

            <div className="flex min-w-0 flex-col justify-end px-4 pb-3 pt-1 sm:px-6 sm:pb-4 sm:pt-4 print:px-6 print:pb-3 print:pt-4">
              <h1 className="text-[27px] font-semibold leading-[1.03] tracking-[-0.025em] sm:text-[34px] print:text-[30px]">
                {property.name}
              </h1>
              {/* One meta line. The period used to need its own labelled row
                  beside "Attribution: First-touch" — a band of chrome to say
                  what the section headings already say inline. */}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {addr ? <span>{addr}</span> : null}
                {addr && site ? (
                  <span
                    aria-hidden
                    className="hidden h-3 w-px bg-border sm:inline-block"
                  />
                ) : null}
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
                {addr || site ? (
                  <span aria-hidden className="h-3 w-px bg-border" />
                ) : null}
                <span className="font-medium text-foreground">
                  {periodLabel(snapshot)}
                </span>
              </p>
            </div>
          </div>
        </header>
      </div>

      {/* The answer, then the figures behind it. */}
      <div className="ls-view-rise">
        {answer ? (
          <p className="mb-4 mt-1 max-w-[62ch] text-[21px] font-semibold leading-snug tracking-[-0.015em] text-foreground sm:text-[24px] print:text-[21px]">
            {answer.lead}
            {answer.proof ? (
              <span className="text-primary"> {answer.proof}</span>
            ) : null}
          </p>
        ) : null}
        <FigureBand figures={figures} />
      </div>

      {/* Lead sources and conversion, stacked, beside what prospects ask. */}
      <div className="ls-view-rise">
        <div className={`mt-6 ${pair(hasProspect)}`}>
          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              title="Where leads came from"
              subtitle={
                acquisitionClaim ?? "New leads by first touch, this period."
              }
            >
              {sourceRows.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  No leads came in during this period.
                </p>
              ) : (
                <BarList rows={sourceRows} labelWidth="w-[130px]" />
              )}
            </Panel>
            {showConversion ? (
              <Panel
                title="From conversation to lead"
                subtitle={conversionLine}
              >
                {funnelOk ? (
                  <ChevronFunnel
                    stages={[
                      { value: num(chatConversations), label: "Conversations" },
                      { value: num(captured), label: "Shared contact info" },
                      { value: num(chatLeads), label: "New leads" },
                    ]}
                  />
                ) : chatConversations > 0 ? (
                  <FigureRow
                    figures={[
                      {
                        value: num(chatConversations),
                        label: "Chatbot conversations",
                      },
                      {
                        value:
                          capturedRate != null ? pct(capturedRate) : "\u2014",
                        label: "Lead capture rate",
                      },
                    ]}
                  />
                ) : null}
                {popup ? (
                  <div
                    className={
                      chatConversations > 0
                        ? "mt-4 border-t border-border pt-4"
                        : ""
                    }
                  >
                    <FigureRow
                      figures={[
                        { value: num(popup.shown), label: "Popups shown" },
                        {
                          value: num(popup.ctaClicks),
                          label: "Popup button clicks",
                        },
                        popup.converted > 0
                          ? { value: num(popup.converted), label: "Converted" }
                          : {
                              value:
                                popup.shown > 0
                                  ? pct((popup.ctaClicks / popup.shown) * 100)
                                  : "\u2014",
                              label: "Click rate",
                            },
                      ]}
                    />
                  </div>
                ) : null}
              </Panel>
            ) : null}
          </div>
          {prospect && hasProspect ? (
            <Panel
              title="What prospects are asking"
              subtitle={`Topics across the ${num(prospect.conversations)} conversations where a visitor asked a question.`}
            >
              <BarList
                rows={themeRows.map((t) => ({
                  label: t.label,
                  value: t.count,
                }))}
                labelWidth="w-[165px]"
              />
              {prospect.examples.length > 0 ? (
                <figure className="mt-4 border-t border-border pt-3.5">
                  <figcaption className="ls-eyebrow mb-2">
                    In their words
                  </figcaption>
                  {prospect.examples.slice(0, 2).map((q) => (
                    <blockquote
                      key={q}
                      className="mt-1.5 text-[12px] leading-snug text-foreground"
                    >
                      &ldquo;{q}&rdquo;
                    </blockquote>
                  ))}
                </figure>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </div>

      {/* Leasing momentum: the 12-month chart beside its figures. */}
      {lifecycleStats ? (
        <div className="ls-view-rise">
          <Panel
            className="mt-4"
            title="Leasing momentum"
            subtitle="Leases started by month, last 12 months."
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_190px] sm:items-end print:grid-cols-[1fr_190px] print:items-end">
              {monthlySigned.length ? (
                <MonthBars months={monthlySigned} />
              ) : (
                <div />
              )}
              <FigureRow
                stacked
                figures={[
                  {
                    value: num(lifecycleStats.leasesSignedLast180d),
                    label: "Started, last 180 days",
                  },
                  {
                    value: num(lifecycleStats.activeLeases),
                    label: "Active leases",
                  },
                  ...(!hideMoney
                    ? [
                        {
                          value: compactUsd(renewalStats?.pastDueBalanceUsd),
                          label: "Past-due balance",
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </Panel>
        </div>
      ) : null}

      {/* Site traffic: pages | Google searches. */}
      {pageRows.length > 0 ? (
        <div className="ls-view-rise">
          <Panel
            className="mt-4"
            title="Site traffic"
            subtitle={trafficClaim ?? "Sessions in period."}
          >
            <div
              className={`grid grid-cols-1 gap-6 ${queryRows.length ? "sm:grid-cols-2 print:grid-cols-2" : ""}`}
            >
              <div>
                <div className="ls-eyebrow mb-2.5">Most-visited pages</div>
                <BarList
                  rows={pageRows.map((p) => ({
                    label: p.label,
                    value: p.sessions,
                  }))}
                  labelWidth="w-[120px]"
                />
              </div>
              {queryRows.length ? (
                <div>
                  <div className="ls-eyebrow mb-2.5 flex justify-between gap-3">
                    <span>Top Google searches</span>
                    <span>Times shown · Clicks</span>
                  </div>
                  <div className="flex flex-col gap-2 text-[12px]">
                    {queryRows.map((q) => (
                      <div
                        key={q.query}
                        className="flex justify-between gap-3 font-medium text-muted-foreground"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Search
                            className="h-3 w-3 flex-none"
                            aria-hidden="true"
                          />
                          <span className="truncate" title={q.query}>
                            {q.query}
                          </span>
                        </span>
                        <span className="flex-none tabular-nums">
                          <b className="font-semibold text-foreground">
                            {num(q.impressions)}
                          </b>{" "}
                          · {num(q.clicks)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>
      ) : null}

      {/* Renewals | reputation. Either takes the row when the other is absent. */}
      {showRenewals || reputationStats ? (
        <div className="ls-view-rise">
          <div
            className={`mt-4 ${pair(showRenewals && Boolean(reputationStats))}`}
          >
            {!hideTurnover && renewalStats ? (
              <Panel
                title="Renewals at risk"
                subtitle="Leases ending in the next four months."
              >
                <FigureRow
                  figures={[
                    {
                      value: num(renewalStats.expiringNext30),
                      label: "Within 30 days",
                    },
                    {
                      value: num(renewalStats.expiringNext60),
                      label: "Within 60 days",
                    },
                    {
                      value: num(renewalStats.expiringNext120),
                      label: "Within 120 days",
                    },
                  ]}
                />
                <div className="mt-4 border-t border-border pt-4">
                  <FigureRow
                    figures={[
                      ...(!hideMoney
                        ? [
                            {
                              value: compactUsd(renewalStats.monthlyAtRiskUsd),
                              label: "Monthly revenue at risk, next 120 days",
                            },
                          ]
                        : []),
                      {
                        value: num(occupancyStats?.onNotice),
                        label: "Residents on notice",
                      },
                    ]}
                  />
                </div>
              </Panel>
            ) : null}

            {reputationStats ? (
              <Panel
                title="Online reputation"
                subtitle="Star ratings, plus mentions tracked across the web."
              >
                <div className="mb-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  {reputationStats.overallRating != null ? (
                    <>
                      <span className="ls-metric text-[26px] leading-none">
                        {reputationStats.overallRating.toFixed(1)}
                      </span>
                      <Stars
                        rating={reputationStats.overallRating}
                        className="text-[14px]"
                      />
                      <span className="text-[11px] font-medium text-muted-foreground">
                        average star rating
                      </span>
                    </>
                  ) : null}
                  <span className="basis-full text-[11.5px] text-muted-foreground">
                    {plural(
                      reputationStats.totalReviews,
                      "review or mention",
                      "reviews and mentions",
                    )}{" "}
                    · {num(reputationStats.positiveCount)} positive ·{" "}
                    {num(reputationStats.negativeCount)} negative
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {reputationStats.sourceBreakdown.slice(0, 4).map((row, i) => (
                    <div
                      key={row.source}
                      className="flex items-center gap-3 text-[12px]"
                    >
                      <span className="flex h-4 w-4 flex-none items-center justify-center">
                        <SourceGlyph
                          source={toMentionSource(row.source)}
                          className="h-4 w-4"
                        />
                      </span>
                      <span className="w-[74px] font-medium text-foreground">
                        {row.source}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-[1px] bg-muted">
                        <span
                          className="ls-view-grow-x block h-full rounded-[1px] bg-primary"
                          style={
                            {
                              width: `${Math.round((row.count / repMaxCount) * 100)}%`,
                              "--reveal-step": i,
                            } as React.CSSProperties
                          }
                        />
                      </span>
                      <span className="w-6 text-right font-semibold tabular-nums">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* AI search visibility, on a faint brand tint. */}
      {aeoStats && aeoStats.totalChecks > 0 ? (
        <div className="ls-view-rise">
          <section className="mt-4 break-inside-avoid rounded-[2px] border border-primary/20 bg-primary/[0.03] p-5 print:p-3.5">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              AI search visibility
            </h2>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              {engines.length
                ? `What ${engines.join(", ")} tell prospects who ask about housing here.`
                : "What AI assistants tell prospects."}
            </p>
            <div className="mt-4">
              <FigureRow
                figures={[
                  {
                    value: num(aeoStats.totalChecks),
                    label: "AI answers checked",
                  },
                  {
                    value: num(aeoStats.cited),
                    label: `Answers citing this property (${pct((aeoStats.cited / aeoStats.totalChecks) * 100)})`,
                  },
                  {
                    value: num(aeoStats.competitorCited),
                    label: "Answers naming a competitor",
                  },
                ]}
              />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-7 border-t border-primary/15 pt-4 sm:grid-cols-[1.25fr_1fr] print:grid-cols-[1.25fr_1fr]">
              <div>
                <div className="ls-eyebrow mb-2.5">Citations by engine</div>
                <div className="flex flex-col gap-2.5">
                  {(aeoStats.byEngine ?? []).map((row, i) => (
                    <div
                      key={row.engine}
                      className="flex items-center gap-3 text-[12px]"
                    >
                      <span className="flex h-[17px] w-[17px] flex-none items-center justify-center">
                        <EngineMark engine={row.engine} />
                      </span>
                      <span className="w-[74px] font-medium text-foreground">
                        {engineLabel(row.engine)}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-[1px] bg-muted">
                        <span
                          className="ls-view-grow-x block h-full rounded-[1px] bg-primary"
                          style={
                            {
                              width: `${row.total ? Math.round((row.cited / row.total) * 100) : 0}%`,
                              "--reveal-step": i,
                            } as React.CSSProperties
                          }
                        />
                      </span>
                      <span className="w-14 text-right tabular-nums text-muted-foreground">
                        {row.cited} / {row.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {aeoStats.topCompetitors.length > 0 ? (
                <div>
                  <div className="ls-eyebrow mb-2.5">
                    Who AI recommends instead
                  </div>
                  <div className="flex flex-col gap-2 text-[12px]">
                    {aeoStats.topCompetitors.slice(0, 5).map((c) => (
                      <div
                        key={c.name}
                        className="flex justify-between gap-3 font-medium text-muted-foreground"
                      >
                        <span className="truncate" title={c.name}>
                          {c.name}
                        </span>
                        <b className="font-semibold tabular-nums text-foreground">
                          {c.mentions}
                        </b>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      <footer className="mt-6 flex break-inside-avoid items-center gap-2.5 border-t border-border pt-4 text-[11px] text-muted-foreground print:mt-3 print:pt-2">
        <LeaseStackMark className="block h-5 w-auto" />
        <span>
          Prepared by{" "}
          <b className="font-semibold text-foreground">LeaseStack</b> ·
          leasestack.co · {periodLabel(snapshot)}
        </span>
      </footer>
    </div>
  );
}
