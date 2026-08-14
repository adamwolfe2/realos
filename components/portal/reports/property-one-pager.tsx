import type { ReportSnapshot } from "@/lib/reports/generate";
import {
  type PropertyMeta,
  compactUsd,
  num,
  pct,
  periodLabel,
  addressLine,
  bucketWeekly,
  EngineMark,
  engineLabel,
  toMentionSource,
  SourceGlyph,
  SectionHeading,
  Stat,
  Sparkline,
  KpiCard,
  coverageRows,
  COVERAGE_DOT,
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

type Props = {
  snapshot: ReportSnapshot;
  property: PropertyMeta;
};

export function PropertyOnePager({ snapshot, property }: Props) {
  const { kpis, occupancyStats, renewalStats, lifecycleStats, reputationStats, aeoStats, chatbotStatsExtended, leadSources, trafficTrend } =
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
  // A wall of ~134 daily bars is unreadable; bucket to weekly once the
  // window passes ~8 weeks.
  const trafficIsWeekly = (trafficTrend?.length ?? 0) > 56;
  const trafficValues = trafficIsWeekly ? bucketWeekly(trafficTrend!) : trafficTrend;

  // Responsive note: every multi-column zone stacks (or drops to 2-up) below
  // `sm`, restores at `sm:`, and is pinned again with a `print:` variant.
  // The print viewport is US Letter minus 0.5in margins ≈ 720px — wider than
  // `sm` (640) but narrower than `md` (768) — so sm: alone would keep print
  // intact today, and the print: pin keeps it intact if margins ever grow.
  // KPI count is dynamic (2-4 surviving cards); Tailwind needs literal class
  // names, hence the lookup instead of string interpolation.
  const kpiColCount = 2 + (hideTurnover ? 0 : 1) + (hideMoney ? 0 : 1);
  const kpiCols: Record<number, string> = {
    2: "sm:grid-cols-2 print:grid-cols-2",
    3: "sm:grid-cols-3 print:grid-cols-3",
    4: "sm:grid-cols-4 print:grid-cols-4",
  };

  return (
    <div className="mx-auto w-full max-w-[880px] rounded-[2px] border border-border bg-card p-4 text-foreground shadow-sm sm:p-6 print:border-0 print:p-6 print:shadow-none">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-[21px] font-semibold leading-[1.05] tracking-tight">
            Marketing &amp; Performance Snapshot
          </h1>
          <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">
            {property.name}
            {addr ? ` · ${addr}` : ""}
            <br />
            {periodLabel(snapshot)} · First-touch attribution
          </p>
        </div>
        <div className="text-right">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Prepared by
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/leasestack-wordmark.png"
            alt="LeaseStack"
            className="ml-auto block h-7 w-auto"
          />
        </div>
      </header>

      {/* Headline KPIs. Occupancy (turnover) + rent roll (money) drop out
          when suppressed; the grid tightens to the surviving cards. */}
      <div className={`mt-5 grid grid-cols-2 gap-2.5 ${TILE_FILL} ${kpiCols[kpiColCount]}`}>
        <KpiCard
          value={num(kpis.leads)}
          label="New leads"
          delta={
            showDeltas && snapshot.kpiDeltas?.leadsPct != null
              ? { up: snapshot.kpiDeltas.leadsPct >= 0, text: `${snapshot.kpiDeltas.leadsPct >= 0 ? "Up" : "Down"} vs prior period` }
              : undefined
          }
        />
        <KpiCard
          value={num(lifecycleStats?.leasesSignedInPeriod ?? 0)}
          label="Leases signed"
          delta={(() => {
            if (!showDeltas) return undefined;
            const cur = lifecycleStats?.leasesSignedInPeriod ?? 0;
            const prior = lifecycleStats?.priorLeasesSignedInPeriod ?? 0;
            return cur === 0 && prior === 0
              ? undefined
              : { up: cur >= prior, text: `From ${prior} prior` };
          })()}
        />
        {!hideTurnover ? (
          <KpiCard
            value={occupancyStats?.occupancyPct != null ? pct(occupancyStats.occupancyPct) : "—"}
            label={`Occupancy across ${occupancyStats?.totalUnits ?? 0} units`}
            deltaNeutral={
              (occupancyStats?.onNotice ?? 0) > 0
                ? `${occupancyStats?.onNotice} residents on notice`
                : undefined
            }
          />
        ) : null}
        {!hideMoney ? (
          <KpiCard
            value={compactUsd(occupancyStats?.monthlyRentRollUsd)}
            label="Monthly rent roll"
            deltaNeutral={
              occupancyStats?.avgRentPerUnitUsd != null
                ? `${compactUsd(occupancyStats.avgRentPerUnitUsd)} avg per unit`
                : undefined
            }
          />
        ) : null}
      </div>

      {/* Acquisition + Leasing momentum */}
      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-[1.1fr_0.9fr] print:grid-cols-[1.1fr_0.9fr]">
        <section>
          <SectionHeading meta="first-touch">Lead acquisition</SectionHeading>
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
          {trafficValues?.length ? (
            <>
              <div className="mb-1.5 mt-3.5 text-[10px] font-medium text-muted-foreground">
                {trafficIsWeekly
                  ? `Weekly site traffic, trailing ${trafficValues.length} week${trafficValues.length === 1 ? "" : "s"}`
                  : `Daily site traffic, trailing ${trafficValues.length} day${trafficValues.length === 1 ? "" : "s"}`}
              </div>
              <Sparkline values={trafficValues} />
            </>
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
          {/* Traced lead→lease proof. Only rendered when at least one
              concrete Resident link exists — never a zero-padded claim. */}
          {snapshot.tracedSignedLeads ? (
            <p className="mt-3 text-[11.5px] font-semibold text-foreground">
              {snapshot.tracedSignedLeads}{" "}
              {snapshot.tracedSignedLeads === 1
                ? "signed lease this period traces"
                : "signed leases this period trace"}{" "}
              directly back to a captured lead
            </p>
          ) : null}
          {monthlySigned.length ? (
            <>
              <div className="mb-1.5 mt-3.5 text-[10px] font-medium text-muted-foreground">
                Leases signed, last 12 months
              </div>
              <Sparkline values={monthlySigned.map((m) => m.count)} />
              <div className="mt-1.5 flex justify-between text-[9px] font-medium text-muted-foreground">
                <span>{monthlySigned[0]?.month}</span>
                <span>{monthlySigned[monthlySigned.length - 1]?.month}</span>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {/* Renewals + Reputation — same column split as the Acquisition +
          Leasing zone above so the two left/right boundaries line up as
          the page scans down. When turnover is suppressed, reputation
          takes the full width. */}
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
                <span className="font-mono text-[22px] font-semibold leading-none tracking-tight tabular-nums">
                  {reputationStats.overallRating != null ? reputationStats.overallRating.toFixed(1) : "—"}
                </span>
                <span className="text-[13px] tracking-wide text-primary">★★★★★</span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {reputationStats.totalReviews} reviews · {reputationStats.positiveCount} positive, {reputationStats.negativeCount} negative
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {reputationStats.sourceBreakdown.slice(0, 4).map((row) => (
                  <div key={row.source} className="flex items-center gap-2.5 text-[12px]">
                    <span className="flex h-4 w-4 flex-none items-center justify-center">
                      <SourceGlyph source={toMentionSource(row.source)} className="h-4 w-4" />
                    </span>
                    <span className="w-[74px] font-medium text-muted-foreground">{row.source}</span>
                    <span className="h-4 flex-1 overflow-hidden rounded bg-muted">
                      <span
                        className="block h-full rounded bg-primary"
                        style={{ width: `${Math.round((row.count / repMaxCount) * 100)}%` }}
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

      {/* AI search visibility — the differentiator. Same 2px card language
          as every other section, just a touch more presence via a faint
          brand tint (no gradient, no side-stripe). */}
      {aeoStats && aeoStats.totalChecks > 0 ? (
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
                {(aeoStats.byEngine ?? []).map((row) => (
                  <div key={row.engine} className="flex items-center gap-2.5 text-[11.5px]">
                    <span className="flex h-[17px] w-[17px] flex-none items-center justify-center">
                      <EngineMark engine={row.engine} />
                    </span>
                    <span className="w-[74px] font-semibold text-foreground">{engineLabel(row.engine)}</span>
                    <span className="flex h-3 flex-1 overflow-hidden rounded bg-elevated">
                      <span
                        className="h-full bg-primary"
                        style={{ width: `${row.total ? Math.round((row.cited / row.total) * 100) : 0}%` }}
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
      ) : null}

      {/* Data-source status — one compact wrapping strip instead of a grid
          + a paragraph re-explaining what each dot color means. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3.5 text-[10px] font-medium text-muted-foreground">
        {coverageRows(snapshot).map((row) => (
          <span key={row.label} className="flex items-center gap-1.5">
            <span className={`h-[7px] w-[7px] flex-none rounded-full ${COVERAGE_DOT[row.state]}`} />
            {row.label}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Cohort report — reflects leads created in the window and downstream activity for them, even if it occurs later. Green data flowing, blue connected and in progress, grey not yet integrated.
      </p>
    </div>
  );
}
