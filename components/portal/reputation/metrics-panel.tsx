"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Star, AlertCircle, MessageSquare, Flag } from "lucide-react";
import type { MentionSource, Sentiment } from "@prisma/client";
import type { ReputationMetrics } from "@/lib/reputation/aggregate";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { SourceLogo, sourceLabel } from "./source-logo";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Metrics panel — all numbers are real, computed server-side from the
// persisted PropertyMention table (see lib/reputation/aggregate.ts). Nothing
// is mocked. The panel renders above the mention feed and refreshes on each
// full page load (i.e. after every Scan Now completes and the stream closes,
// the server-component parent re-queries).
// ---------------------------------------------------------------------------

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: "#10b981", // emerald
  NEGATIVE: "#ef4444", // rose
  MIXED: "#f59e0b", // amber
  NEUTRAL: "#94A3B8", // gray
  UNCLASSIFIED: "#d1d5db", // light gray
};

const SOURCE_COLORS: Record<string, string> = {
  GOOGLE_REVIEW: "#4285F4",
  REDDIT: "#FF4500",
  YELP: "#AF0606",
  FACEBOOK_PUBLIC: "#1877F2",
  TAVILY_WEB: "#2563EB",
  OTHER: "#94A3B8",
};

export function MetricsPanel({ metrics }: { metrics: ReputationMetrics }) {
  const hasAnyData = metrics.totalMentions > 0;
  if (!hasAnyData) return null;

  const hasTopics = metrics.topicBreakdown.length > 0;
  const hasKeywords = metrics.negativeKeywords.length > 0;
  const hasTrend = metrics.monthlyVolume.some((d) => d.count > 0);

  return (
    <div className="space-y-3">
      {/* KPI tile row — platform-level hero numbers */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Google rating"
          value={
            metrics.googleAvgRating !== null ? (
              <span className="inline-flex items-baseline gap-1.5">
                <span>{metrics.googleAvgRating.toFixed(1)}</span>
                <Star
                  className="h-4 w-4 text-primary fill-current translate-y-0.5"
                  aria-hidden="true"
                />
              </span>
            ) : (
              "—"
            )
          }
          hint={
            metrics.googleReviewCount > 0
              ? `${metrics.googleReviewCount} Google reviews`
              : "Scan to populate"
          }
        />
        <KpiTile
          label="Total mentions"
          value={metrics.totalMentions}
          hint={(() => {
            // Bug #39 — the "+35 in last 30d" subtitle was equal to
            // the total because the count was keyed off ingestion
            // date, not publication date. Now newLast30d reflects
            // publication-date matches (with createdAt fallback) so
            // the delta is honest. When the delta equals the total
            // we render "all within last 30d" instead of "+35"
            // (avoids implying recent growth from a backfilled
            // history).
            if (metrics.totalMentions === 0) return "—";
            if (metrics.newLast30d <= 0) return "No new in last 30d";
            if (metrics.newLast30d >= metrics.totalMentions) {
              return `All within last 30d`;
            }
            return `+${metrics.newLast30d} in last 30d`;
          })()}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <KpiTile
          label="% Negative"
          value={
            metrics.negativePct === null ? "—" : `${metrics.negativePct}%`
          }
          hint="Of classified mentions"
          icon={<AlertCircle className="h-4 w-4" />}
        />
        <KpiTile
          label="Needs response"
          value={metrics.unreviewedCount}
          hint={
            metrics.flaggedCount > 0
              ? `${metrics.flaggedCount} flagged`
              : "Unreviewed"
          }
          icon={<Flag className="h-4 w-4" />}
        />
      </section>

      {/* Chart row — sentiment donut + source donut + optional topics bars.
          When topics are empty (early-stage property) we collapse to a
          2-column layout so the row doesn't look sparse. */}
      <section
        className={
          hasTopics
            ? "grid grid-cols-1 lg:grid-cols-3 gap-3"
            : "grid grid-cols-1 lg:grid-cols-2 gap-3"
        }
      >
        <DashboardSection title="Sentiment" eyebrow="Classified">
          <SentimentDonut data={metrics.sentimentBreakdown} />
        </DashboardSection>
        <DashboardSection title="Platforms" eyebrow="By source">
          <SourceDonut data={metrics.sourceBreakdown} />
          {/* Bug #15/#22 — operators kept asking why "5 Google reviews"
              showed in the donut while the rating tile showed 49.
              Honest explanation: the Google Places API hard-caps the
              individual-reviews response at 5 most-helpful per place.
              The aggregate rating + count are accurate; the per-review
              feed is sampled. Surface this so the discrepancy doesn't
              look like a sync bug. */}
          {(() => {
            const googleRow = metrics.sourceBreakdown.find(
              (r) => r.source === "GOOGLE_REVIEW",
            );
            const fetched = googleRow?.count ?? 0;
            const total = metrics.googleReviewCount ?? 0;
            if (total > fetched) {
              const pct =
                total > 0 ? Math.round((fetched / total) * 100) : 0;
              return (
                <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground border-t border-border pt-2 space-y-1.5">
                  <p>
                    <span className="font-semibold text-foreground">
                      {fetched} of {total} Google reviews
                    </span>{" "}
                    fetched ({pct}%). Google&apos;s Places API hard-caps the
                    individual-reviews response at 5 most-helpful per
                    business. The {metrics.googleAvgRating?.toFixed(1) ?? "—"}{" "}
                    star rating and total count reflect every review on the
                    listing.
                  </p>
                  {/* Bug #42 — Norman flagged 10% surface as a deal-
                      breaker. Disclose the mitigation paths so the
                      operator knows what they CAN do: GBP API for
                      verified owners gets all reviews; periodic
                      re-scan rotates which 5 land. */}
                  <p className="text-[10px]">
                    To act on all {total}: claim the listing in Google
                    Business Profile (returns every review through the
                    GBP API). Re-scan rotates which 5 surface — recent
                    scans often pull different reviews as Google updates
                    its &ldquo;most helpful&rdquo; ranking.
                  </p>
                </div>
              );
            }
            return null;
          })()}
        </DashboardSection>
        {hasTopics ? (
          <DashboardSection title="Top topics" eyebrow="Recurring themes">
            <TopicBars data={metrics.topicBreakdown} />
          </DashboardSection>
        ) : null}
      </section>

      {/* Trend + complaints — only render sections that have data. If both
          are empty (brand new property), skip the entire row. */}
      {hasTrend || hasKeywords ? (
        <section
          className={
            hasTrend && hasKeywords
              ? "grid grid-cols-1 lg:grid-cols-3 gap-3"
              : "grid grid-cols-1 gap-3"
          }
        >
          {hasTrend ? (
            <DashboardSection
              title="Mentions over time"
              eyebrow="Last 12 months"
              className={hasKeywords ? "lg:col-span-2" : undefined}
            >
              <MonthlyVolumeChart data={metrics.monthlyVolume} />
            </DashboardSection>
          ) : null}
          {hasKeywords ? (
            <DashboardSection
              title="Recurring complaints"
              eyebrow="In negative mentions"
            >
              <NegativeKeywords data={metrics.negativeKeywords} />
            </DashboardSection>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sentiment donut.
// ---------------------------------------------------------------------------

function SentimentDonut({
  data,
}: {
  data: Array<{ sentiment: Sentiment | "UNCLASSIFIED"; count: number }>;
}) {
  const total = data.reduce((a, d) => a + d.count, 0);
  if (total === 0) return <EmptyChart />;

  // Render order: NEGATIVE, MIXED, NEUTRAL, POSITIVE, UNCLASSIFIED.
  const order = [
    "NEGATIVE",
    "MIXED",
    "NEUTRAL",
    "POSITIVE",
    "UNCLASSIFIED",
  ] as const;
  const sorted = [...data].sort(
    (a, b) => order.indexOf(a.sentiment) - order.indexOf(b.sentiment),
  );
  const pieData = sorted.map((d) => ({
    name: labelForSentiment(d.sentiment),
    value: d.count,
    color: SENTIMENT_COLORS[d.sentiment] ?? "#d1d5db",
    key: d.sentiment,
  }));

  return (
    <DonutWithLegend total={total} data={pieData} centerLabel="Classified" />
  );
}

function labelForSentiment(s: Sentiment | "UNCLASSIFIED"): string {
  switch (s) {
    case "POSITIVE":
      return "Positive";
    case "NEGATIVE":
      return "Negative";
    case "MIXED":
      return "Mixed";
    case "NEUTRAL":
      return "Neutral";
    default:
      return "Unclassified";
  }
}

// ---------------------------------------------------------------------------
// Source donut.
// ---------------------------------------------------------------------------

function SourceDonut({
  data,
}: {
  data: Array<{ source: MentionSource; count: number }>;
}) {
  const total = data.reduce((a, d) => a + d.count, 0);
  if (total === 0) return <EmptyChart />;

  // Build a representative URL per source for SourceLogo resolution in the
  // legend. The logo component does hostname inference, so we pass a
  // matching hostname even when we don't have a real URL at hand.
  const sampleUrl: Record<MentionSource, string> = {
    GOOGLE_REVIEW: "https://google.com",
    REDDIT: "https://reddit.com",
    YELP: "https://yelp.com",
    FACEBOOK_PUBLIC: "https://facebook.com",
    TAVILY_WEB: "https://example.com",
    OTHER: "https://example.com",
  };

  const pieData = data.map((d) => ({
    name: sourceLabel(d.source, sampleUrl[d.source]),
    value: d.count,
    color: SOURCE_COLORS[d.source] ?? "#94A3B8",
    key: d.source,
    logoSource: d.source as MentionSource,
    logoUrl: sampleUrl[d.source],
  }));

  return <DonutWithLegend total={total} data={pieData} centerLabel="Total" />;
}

// ---------------------------------------------------------------------------
// Shared donut renderer.
// ---------------------------------------------------------------------------

type DonutDatum = {
  name: string;
  value: number;
  color: string;
  key: string;
  logoSource?: MentionSource;
  logoUrl?: string;
};

function DonutWithLegend({
  total,
  data,
  centerLabel,
}: {
  total: number;
  data: DonutDatum[];
  centerLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-3">
      <div className="relative h-[120px] w-[120px] mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              cursor={false}
              // Bump the wrapper z-index so the hover bubble renders above
              // the centered "Total N" overlay (the overlay sits inside the
              // same absolute container and was occluding the tooltip).
              wrapperStyle={{ zIndex: 50, outline: "none" }}
              contentStyle={{
                fontSize: 12,
                background: "white",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
              }}
              formatter={(v: number, n: string) => [v, n]}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={38}
              outerRadius={56}
              stroke="white"
              strokeWidth={2}
              paddingAngle={1.5}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            {centerLabel}
          </span>
          <span className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
            {total}
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {data.map((d) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={d.key}
              className="grid grid-cols-[14px_1fr_auto_38px] items-center gap-2 text-xs"
            >
              {d.logoSource && d.logoUrl ? (
                <SourceLogo
                  source={d.logoSource}
                  url={d.logoUrl}
                  className="h-3.5 w-3.5"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm justify-self-center"
                  style={{ backgroundColor: d.color }}
                />
              )}
              <span className="text-foreground truncate">{d.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {d.value}
              </span>
              <span className="text-right tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topic bar chart — horizontal bars with count + percentage.
// ---------------------------------------------------------------------------

function TopicBars({
  data,
}: {
  data: Array<{ topic: string; count: number }>;
}) {
  if (data.length === 0) return <EmptyChart />;
  const max = data[0].count;
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const pct = max > 0 ? (d.count / max) * 100 : 0;
        return (
          <li key={d.topic} className="text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="capitalize text-foreground">{d.topic}</span>
              <span className="tabular-nums text-muted-foreground">
                {d.count}
              </span>
            </div>
            <div
              className="mt-1 h-2 rounded-sm bg-muted overflow-hidden"
              aria-hidden="true"
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Monthly volume chart — inline SVG bar chart.
//
// Replaced the recharts BarChart because it rendered sparse with axis
// chrome and tooltip styling that fought the rest of the editorial
// palette. The new chart is custom SVG: 12 vertical bars with negative
// share rendered as a darker stack atop the neutral mass, a dashed
// 12-month average line drawn across, the most recent month rendered
// at full brand-blue saturation, and inline labels beneath each bar.
// Title attributes provide hover details without recharts overhead.
// ---------------------------------------------------------------------------

function MonthlyVolumeChart({
  data,
}: {
  data: Array<{ month: string; count: number; negative: number }>;
}) {
  const hasAny = data.some((d) => d.count > 0);
  if (!hasAny) return <EmptyChart />;

  const formatted = data.map((d, i) => {
    const [year, month] = d.month.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return {
      monthLabel: date.toLocaleString("en-US", { month: "short" }),
      yearLabel: date.toLocaleString("en-US", { year: "numeric" }),
      neutral: Math.max(0, d.count - d.negative),
      negative: Math.max(0, d.negative),
      total: d.count,
      isMostRecent: i === data.length - 1,
    };
  });

  const maxTotal = Math.max(...formatted.map((d) => d.total), 1);
  const avg =
    formatted.reduce((s, d) => s + d.total, 0) / formatted.length;
  // Avg as a fraction of maxTotal for placement on the chart canvas.
  const avgPct = avg / maxTotal;

  // Total + negative aggregate for header annotation
  const totalAll = formatted.reduce((s, d) => s + d.total, 0);
  const negAll = formatted.reduce((s, d) => s + d.negative, 0);
  const negPct = totalAll > 0 ? Math.round((negAll / totalAll) * 100) : 0;

  // Chart canvas: 100% wide, 140px high. Each bar takes equal share
  // with a small gap. Bars grow from the baseline; negative renders on
  // top of neutral as a stacked segment.
  const CHART_H = 140;
  const BAR_GAP_PCT = 18; // % of bar width that's gap
  const slot = 100 / formatted.length;
  const barWidth = slot * (1 - BAR_GAP_PCT / 100);
  const slotPad = (slot - barWidth) / 2;

  return (
    <div className="space-y-3">
      {/* Mini context strip — total, negative %, avg/month */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {totalAll}
          </span>{" "}
          total mentions
        </span>
        {negAll > 0 ? (
          <span>
            <span className="font-semibold text-foreground tabular-nums">
              {negPct}%
            </span>{" "}
            negative
          </span>
        ) : null}
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {avg.toFixed(1)}
          </span>{" "}
          avg / month
        </span>
      </div>

      {/* SVG chart */}
      <div className="relative" style={{ height: CHART_H + 22 }}>
        <svg
          width="100%"
          height={CHART_H}
          viewBox={`0 0 100 ${CHART_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Mentions over time, last 12 months"
        >
          {/* Hairline baseline */}
          <line
            x1="0"
            y1={CHART_H - 0.5}
            x2="100"
            y2={CHART_H - 0.5}
            stroke="#E2E8F0"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
          {/* Average reference line — only renders when avg > 0 */}
          {avg > 0 ? (
            <line
              x1="0"
              y1={CHART_H - avgPct * (CHART_H - 8)}
              x2="100"
              y2={CHART_H - avgPct * (CHART_H - 8)}
              stroke="#94A3B8"
              strokeWidth="0.5"
              strokeDasharray="1.5 1.5"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {/* Bars */}
          {formatted.map((d, i) => {
            const x = i * slot + slotPad;
            const neutralH =
              d.total > 0 ? (d.neutral / maxTotal) * (CHART_H - 8) : 0;
            const negativeH =
              d.total > 0 ? (d.negative / maxTotal) * (CHART_H - 8) : 0;
            const yBase = CHART_H;
            const yNeutralTop = yBase - neutralH;
            const yNegativeTop = yNeutralTop - negativeH;

            // Most recent month rendered at full brand blue. Older
            // months rendered at a slightly muted tone so the eye lands
            // on the latest reading first.
            const neutralFill = d.isMostRecent ? "#2563EB" : "#3B82F6";
            const neutralOpacity = d.isMostRecent ? 1 : 0.55;

            return (
              <g key={d.monthLabel + i}>
                <title>
                  {`${d.monthLabel}: ${d.total} mention${d.total === 1 ? "" : "s"}${d.negative > 0 ? `, ${d.negative} negative` : ""}`}
                </title>
                {neutralH > 0 ? (
                  <rect
                    x={x}
                    y={yNeutralTop}
                    width={barWidth}
                    height={neutralH}
                    fill={neutralFill}
                    fillOpacity={neutralOpacity}
                    rx="0.4"
                  />
                ) : null}
                {negativeH > 0 ? (
                  <rect
                    x={x}
                    y={yNegativeTop}
                    width={barWidth}
                    height={negativeH}
                    fill="#DC2626"
                    fillOpacity={d.isMostRecent ? 1 : 0.7}
                    rx="0.4"
                  />
                ) : null}
                {/* Tiny dot above empty months so the row reads as
                    intentional, not broken */}
                {d.total === 0 ? (
                  <circle
                    cx={x + barWidth / 2}
                    cy={CHART_H - 1.5}
                    r="0.6"
                    fill="#CBD5E1"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="absolute left-0 right-0 -bottom-1 flex">
          {formatted.map((d, i) => (
            <div
              key={`label-${i}`}
              className="text-center"
              style={{ width: `${slot}%` }}
            >
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  d.isMostRecent
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {d.monthLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: "#2563EB" }}
          />
          Neutral / positive
        </span>
        {negAll > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: "#DC2626" }}
            />
            Negative
          </span>
        ) : null}
        {avg > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-0.5 w-3"
              style={{
                background:
                  "repeating-linear-gradient(to right, #94A3B8 0 2px, transparent 2px 4px)",
              }}
            />
            12-month avg
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Negative keyword list — extracted bigrams from NEGATIVE mentions.
// ---------------------------------------------------------------------------

function NegativeKeywords({
  data,
}: {
  data: Array<{ phrase: string; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No recurring complaint phrases yet. Runs once you have a few negative
        mentions classified.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {data.map((d) => (
        <li
          key={d.phrase}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px]"
        >
          <span className="text-foreground">{d.phrase}</span>
          <span className="text-muted-foreground tabular-nums">
            {d.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyChart() {
  return (
    <p className="text-xs text-muted-foreground">
      Not enough data yet. Run a scan to populate this chart.
    </p>
  );
}
