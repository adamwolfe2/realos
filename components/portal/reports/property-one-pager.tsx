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
import {
  BadgeCheck,
  Bot,
  Building2,
  DollarSign,
  FileSignature,
  FileText,
  Link2,
  MessageSquare,
  MousePointerClick,
  PanelTop,
  Percent,
  Search,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BarList, ChevronFunnel, IconStat, KpiTile, MonthBars, Panel, TakeawayCard } from "./one-pager-blocks";

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
  const pageRows = [
    ...(topPages ?? []).filter((p) => p.sessions > 0)
      .reduce((acc, p) => {
        const label = pageLabel(p.url);
        if (label) acc.set(label, (acc.get(label) ?? 0) + p.sessions);
        return acc;
      }, new Map<string, number>()),
  ]
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

  // Layout (2026-10-20 refresh, modelled on Adam's infographic one-pager):
  // cover -> KPI tiles -> takeaways -> paired panels -> AI visibility.
  // Every multi-column zone stacks below `sm` and is pinned with `print:`
  // (print viewport ~720px, between sm and md).
  const leasesSigned = lifecycleStats?.leasesSignedInPeriod ?? 0;
  const priorLeases = lifecycleStats?.priorLeasesSignedInPeriod ?? 0;
  const traced = snapshot.tracedSignedLeads ?? 0;
  const kpiTiles: Array<{
    icon: LucideIcon;
    value: string;
    label: string;
    series?: number[];
    note?: string;
    delta?: { up: boolean; text: string };
  }> = [
    {
      icon: Users,
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
    ...(lifecycleStats?.applicationsInPeriod
      ? [{ icon: FileText, value: num(lifecycleStats.applicationsInPeriod), label: "Applications" }]
      : []),
    {
      icon: FileSignature,
      value: num(leasesSigned),
      label: "Leases signed",
      // The bars are the 12-month signing history, the one real series
      // behind a headline tile. Other tiles carry no chart rather than a
      // decorative one.
      series: monthlySigned.length > 1 ? monthlySigned.map((m) => m.count) : undefined,
      delta:
        showDeltas && !(leasesSigned === 0 && priorLeases === 0)
          ? { up: leasesSigned >= priorLeases, text: `From ${priorLeases} prior` }
          : undefined,
      note: monthlySigned.length > 1 ? "Bars: last 12 months" : undefined,
    },
    ...(traced
      ? [{ icon: Link2, value: num(traced), label: "Traced to a captured lead", note: "Lead \u2192 lease, same resident" }]
      : []),
    ...(chatConversations > 0
      ? [{ icon: MessageSquare, value: num(chatConversations), label: "Chatbot conversations" }]
      : []),
    ...(organicSessions > 0 ? [{ icon: Search, value: num(organicSessions), label: "Organic search sessions" }] : []),
    ...(hideTurnover || occupancyStats?.occupancyPct == null
      ? []
      : [
          {
            icon: Building2,
            value: pct(occupancyStats.occupancyPct),
            label: `Occupancy, ${occupancyStats.totalUnits ?? 0} units`,
            note: (occupancyStats.onNotice ?? 0) > 0 ? `${occupancyStats.onNotice} residents on notice` : undefined,
          },
        ]),
    ...(hideMoney || occupancyStats?.monthlyRentRollUsd == null
      ? []
      : [
          {
            icon: DollarSign,
            value: compactUsd(occupancyStats.monthlyRentRollUsd),
            label: "Monthly rent roll",
            note:
              occupancyStats.avgRentPerUnitUsd != null
                ? `${compactUsd(occupancyStats.avgRentPerUnitUsd)} avg per unit`
                : undefined,
          },
        ]),
  ];
  // Literal class strings so Tailwind can see them.
  const kpiCols =
    kpiTiles.length <= 3
      ? "sm:grid-cols-3 print:grid-cols-3"
      : kpiTiles.length === 4 || kpiTiles.length >= 7
        ? "sm:grid-cols-4 print:grid-cols-4"
        : kpiTiles.length === 5
          ? "sm:grid-cols-5 print:grid-cols-5"
          : "sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6";

  // Takeaways: one sentence each, built only from numbers already on the
  // page. A missing input drops its card; zero cards drops the band.
  const capturedRate = chatbotStatsExtended?.capturedRatePct;
  const topTheme = themeRows[0];
  const takeaways = [
    traced && leasesSigned
      ? {
          lead: "Signed leases that trace back to a lead LeaseStack captured:",
          figure: `${num(traced)} of ${num(leasesSigned)}`,
          tail: "Same resident, from first contact to signed lease.",
        }
      : null,
    capturedRate != null && chatConversations > 0
      ? {
          lead: "Chatbot conversations that turned into a lead:",
          figure: pct(capturedRate),
          tail: `${num(chatbotStatsExtended?.capturedConversations)} of ${num(chatConversations)} conversations, answered 24/7.`,
        }
      : null,
    aeoStats && aeoStats.totalChecks > 0 && aeoStats.cited > 0
      ? {
          lead: `AI answers that cite ${property.name}:`,
          figure: `${num(aeoStats.cited)} of ${num(aeoStats.totalChecks)}`,
          tail: `Across ${(aeoStats.enginesUsed ?? []).map(engineLabel).join(", ")}.`,
        }
      : topTheme
        ? {
            lead: "The question prospects ask most:",
            figure: topTheme.label,
            tail: `Raised in ${num(topTheme.count)} chatbot conversations.`,
          }
        : null,
  ].filter((t): t is { lead: string; figure: string; tail: string } => t !== null);

  // Chatbot funnel. Chevrons imply each step is a subset of the last, so
  // they only render when the three counts actually narrow.
  const captured = chatbotStatsExtended?.capturedConversations ?? 0;
  const funnelOk = chatConversations > 0 && chatConversations >= captured && captured >= chatLeads && chatLeads > 0;
  const popup = snapshot.popupStats;

  const sourceRows = [
    ...sources.map((s) => ({ label: s.source, value: s.count, display: `${s.count} \u00b7 ${Math.round(s.pct)}%` })),
    ...(!hideUntracked
      ? ["Zillow", "Apartments.com"].map((s) => ({ label: s, value: 0, display: "not tracked", muted: true }))
      : []),
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
        <header className="-mx-4 -mt-4 mb-4 border-b border-border sm:-mx-6 sm:-mt-6 print:-mx-6 print:-mt-6">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-1.5 sm:gap-4 sm:px-6 print:px-6">
            <span className="ls-eyebrow min-w-0 flex-1">Marketing &amp; Performance Report</span>
            <div className="flex flex-none items-center gap-2">
              <span className="ls-eyebrow hidden sm:inline print:inline">Prepared by</span>
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
                  <span aria-hidden className="hidden h-3 w-px bg-border sm:inline-block" />
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
                {addr || site ? <span aria-hidden className="h-3 w-px bg-border" /> : null}
                <span className="font-medium text-foreground">{periodLabel(snapshot)}</span>
              </p>
            </div>
          </div>
        </header>
      </div>

      {/* Headline numbers: icon tiles, one row on desktop and print. */}
      <div className="ls-view-rise">
        <div className={`grid grid-cols-2 gap-2.5 ${kpiCols}`}>
          {kpiTiles.map((t) => (
            <KpiTile key={t.label} {...t} />
          ))}
        </div>
      </div>

      {takeaways.length > 0 ? (
        <div className="ls-view-rise">
          <section className="mt-6">
            <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.01em]">
              {takeaways.length === 1 ? "Key takeaway" : `${takeaways.length} key takeaways`}
            </h2>
            <div
              className={`grid grid-cols-1 gap-2.5 ${takeaways.length === 3 ? "sm:grid-cols-3 print:grid-cols-3" : takeaways.length === 2 ? "sm:grid-cols-2 print:grid-cols-2" : ""}`}
            >
              {takeaways.map((t, i) => (
                <TakeawayCard key={t.lead} index={i + 1} {...t} />
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {/* Where leads came from | what prospects ask. */}
      <div className="ls-view-rise">
        <div
          className={`mt-6 grid grid-cols-1 gap-4 ${prospect && themeRows.length ? "sm:grid-cols-2 print:grid-cols-2" : ""}`}
        >
          <Panel title="Where leads came from" subtitle="New leads by first touch, this period">
            {sourceRows.length === 0 ? (
              <div className="text-[12px] text-muted-foreground">No leads in period.</div>
            ) : (
              <BarList rows={sourceRows} labelWidth="w-[130px]" />
            )}
            {acquisitionClaim ? (
              <p className="mt-4 rounded-[2px] bg-primary/[0.05] px-3 py-2.5 text-[11.5px] leading-relaxed text-foreground">
                {acquisitionClaim}
              </p>
            ) : null}
          </Panel>

          {prospect && themeRows.length > 0 ? (
            <Panel title="What prospects are asking" subtitle={`Top topics in ${num(prospect.conversations)} chatbot conversations`}>
              <BarList rows={themeRows.map((t) => ({ label: t.label, value: t.count }))} labelWidth="w-[165px]" />
              {prospect.examples.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2 rounded-[2px] bg-primary/[0.05] px-3 py-2.5">
                  <div className="ls-eyebrow">In their words</div>
                  {prospect.examples.slice(0, 2).map((q) => (
                    <p key={q} className="text-[11.5px] leading-snug text-foreground">
                      &ldquo;{q}&rdquo;
                    </p>
                  ))}
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </div>

      {/* Conversation -> lead | leasing momentum. */}
      <div className="ls-view-rise">
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
          <Panel title="From conversation to lead" subtitle="Website chatbot and popups, this period">
            {funnelOk ? (
              <ChevronFunnel
                stages={[
                  { value: num(chatConversations), label: "Conversations" },
                  { value: num(captured), label: "Shared details" },
                  { value: num(chatLeads), label: "New leads" },
                ]}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <IconStat icon={MessageSquare} value={num(chatConversations)} label="Chatbot conversations" />
                <IconStat
                  icon={Percent}
                  value={capturedRate != null ? pct(capturedRate) : "\u2014"}
                  label="Lead capture rate"
                />
              </div>
            )}
            {popup ? (
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
                <IconStat icon={PanelTop} value={num(popup.shown)} label="Popups shown" />
                <IconStat icon={MousePointerClick} value={num(popup.ctaClicks)} label="Button clicks" />
                {popup.converted > 0 ? (
                  <IconStat icon={BadgeCheck} value={num(popup.converted)} label="Converted" />
                ) : (
                  <IconStat
                    icon={Percent}
                    value={popup.shown > 0 ? pct((popup.ctaClicks / popup.shown) * 100) : "\u2014"}
                    label="Click rate"
                  />
                )}
              </div>
            ) : null}
          </Panel>

          <Panel title="Leasing momentum" subtitle="Leases signed by month, last 12 months">
            {monthlySigned.length ? <MonthBars months={monthlySigned} /> : null}
            <div className={`mt-4 grid gap-3 border-t border-border pt-4 ${hideMoney ? "grid-cols-2" : "grid-cols-3"}`}>
              <IconStat icon={FileSignature} value={num(lifecycleStats?.leasesSignedLast180d)} label="Signed, last 180 days" />
              <IconStat icon={Users} value={num(lifecycleStats?.activeLeases)} label="Active leases" />
              {!hideMoney ? (
                <IconStat icon={DollarSign} value={compactUsd(renewalStats?.pastDueBalanceUsd)} label="Past-due balance" />
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      {/* Site traffic: pages | Google searches. */}
      {pageRows.length > 0 ? (
        <div className="ls-view-rise">
          <Panel className="mt-4" title="Site traffic" subtitle={trafficClaim ?? "Sessions in period"}>
            <div className={`grid grid-cols-1 gap-6 ${queryRows.length ? "sm:grid-cols-2 print:grid-cols-2" : ""}`}>
              <div>
                <div className="ls-eyebrow mb-2.5">Most-visited pages</div>
                <BarList rows={pageRows.map((p) => ({ label: p.label, value: p.sessions }))} labelWidth="w-[120px]" />
              </div>
              {queryRows.length ? (
                <div>
                  <div className="ls-eyebrow mb-2.5 flex justify-between">
                    <span>Top Google searches</span>
                    <span>Shown · Clicks</span>
                  </div>
                  <div className="flex flex-col gap-2 text-[11.5px]">
                    {queryRows.map((q) => (
                      <div key={q.query} className="flex justify-between gap-3 font-medium text-muted-foreground">
                        <span className="flex min-w-0 items-center gap-2">
                          <Search className="h-3 w-3 flex-none" aria-hidden="true" />
                          <span className="truncate">{q.query}</span>
                        </span>
                        <span className="flex-none tabular-nums">
                          <b className="font-bold text-foreground">{num(q.impressions)}</b> · {num(q.clicks)}
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

      {/* Renewals | reputation. Reputation takes the row when turnover is hidden. */}
      <div className="ls-view-rise">
        <div className={`mt-4 grid grid-cols-1 gap-4 ${hideTurnover ? "" : "sm:grid-cols-2 print:grid-cols-2"}`}>
          {!hideTurnover ? (
            <Panel title="Renewals at risk" subtitle="Leases ending soon">
              <div className="grid grid-cols-3 gap-3">
                <IconStat icon={FileText} value={num(renewalStats?.expiringNext30)} label="Within 30 days" />
                <IconStat icon={FileText} value={num(renewalStats?.expiringNext60)} label="Within 60 days" />
                <IconStat icon={FileText} value={num(renewalStats?.expiringNext120)} label="Within 120 days" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                {!hideMoney ? (
                  <IconStat icon={DollarSign} value={compactUsd(renewalStats?.monthlyAtRiskUsd)} label="Monthly revenue at risk, 120 days" />
                ) : null}
                <IconStat icon={Users} value={num(occupancyStats?.onNotice)} label="Residents on notice" />
              </div>
            </Panel>
          ) : null}

          <Panel title="Online reputation" subtitle="Reviews across the web">
            {reputationStats ? (
              <>
                <div className="mb-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="ls-metric text-[26px] leading-none">
                    {reputationStats.overallRating != null ? reputationStats.overallRating.toFixed(1) : "\u2014"}
                  </span>
                  <Stars rating={reputationStats.overallRating} className="text-[14px]" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {reputationStats.totalReviews} reviews · {reputationStats.positiveCount} positive, {reputationStats.negativeCount} negative
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {reputationStats.sourceBreakdown.slice(0, 4).map((row, i) => (
                    <div key={row.source} className="flex items-center gap-2.5 text-[12px]">
                      <span className="flex h-4 w-4 flex-none items-center justify-center">
                        <SourceGlyph source={toMentionSource(row.source)} className="h-4 w-4" />
                      </span>
                      <span className="w-[74px] font-medium text-muted-foreground">{row.source}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="ls-view-grow-x block h-full rounded-full bg-primary"
                          style={{ width: `${Math.round((row.count / repMaxCount) * 100)}%`, "--reveal-step": i } as React.CSSProperties}
                        />
                      </span>
                      <span className="w-6 text-right font-bold">{row.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-[12px] text-muted-foreground">No reputation data yet.</div>
            )}
          </Panel>
        </div>
      </div>

      {/* AI search visibility: the differentiator, on a faint brand tint. */}
      {aeoStats && aeoStats.totalChecks > 0 ? (
        <div className="ls-view-rise">
          <section className="mt-4 break-inside-avoid rounded-[2px] border border-primary/20 bg-primary/[0.03] p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              AI search visibility
              <span className="ml-auto rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
                LeaseStack exclusive
              </span>
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              What ChatGPT, Claude, Gemini and Perplexity tell prospects
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4">
              <IconStat icon={Sparkles} value={num(aeoStats.totalChecks)} label="AI answers checked" />
              <IconStat
                icon={BadgeCheck}
                value={`${num(aeoStats.cited)} (${pct((aeoStats.cited / aeoStats.totalChecks) * 100)})`}
                label={`Answers citing ${property.name}`}
              />
              <IconStat icon={Bot} value={num(aeoStats.enginesUsed?.length ?? 0)} label="AI engines monitored" />
              <IconStat icon={Trophy} value={num(aeoStats.competitorCited)} label="Answers naming a competitor" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-7 border-t border-primary/15 pt-4 sm:grid-cols-[1.25fr_1fr] print:grid-cols-[1.25fr_1fr]">
              <div>
                <div className="ls-eyebrow mb-2.5">Citations by engine</div>
                <div className="flex flex-col gap-2.5">
                  {(aeoStats.byEngine ?? []).map((row, i) => (
                    <div key={row.engine} className="flex items-center gap-2.5 text-[11.5px]">
                      <span className="flex h-[17px] w-[17px] flex-none items-center justify-center">
                        <EngineMark engine={row.engine} />
                      </span>
                      <span className="w-[74px] font-semibold text-foreground">{engineLabel(row.engine)}</span>
                      <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-[#c6c6c6]">
                        <span
                          className="ls-view-grow-x h-full rounded-full bg-primary"
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
              </div>
              <div>
                <div className="ls-eyebrow mb-2.5">Who AI recommends instead</div>
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

      <footer className="mt-6 flex break-inside-avoid print:mt-3 print:pt-2 items-center gap-2.5 border-t border-border pt-4 text-[11px] text-muted-foreground">
        <LeaseStackMark className="block h-5 w-auto" />
        <span>
          Prepared by <b className="font-semibold text-foreground">LeaseStack</b> · leasestack.co · {periodLabel(snapshot)}
        </span>
      </footer>
    </div>
  );
}
