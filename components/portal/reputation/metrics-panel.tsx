"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { Star, AlertCircle, MessageSquare, Flag } from "lucide-react";
import type { MentionSource, Sentiment } from "@prisma/client";
import type { ReputationMetrics } from "@/lib/reputation/aggregate";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { SourceLogo, sourceLabel } from "./source-logo";

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
  NEUTRAL: "#6b7280", // gray
  UNCLASSIFIED: "#d1d5db", // light gray
};

const SOURCE_COLORS: Record<string, string> = {
  GOOGLE_REVIEW: "#4285F4",
  REDDIT: "#FF4500",
  YELP: "#AF0606",
  FACEBOOK_PUBLIC: "#1877F2",
  TAVILY_WEB: "#2563EB",
  OTHER: "#6b7280",
};

export function MetricsPanel({ metrics }: { metrics: ReputationMetrics }) {
  const hasAnyData = metrics.totalMentions > 0;
  if (!hasAnyData) return null;

  return (
    <div className="space-y-4">
      {/* KPI tile row — platform-level hero numbers */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Google rating"
          value={
            metrics.googleAvgRating !== null ? (
              <span className="inline-flex items-baseline gap-1.5">
                <span>{metrics.googleAvgRating.toFixed(1)}</span>
                <Star
                  className="h-4 w-4 text-amber-500 fill-current translate-y-0.5"
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
              : "No Google reviews yet"
          }
        />
        <KpiTile
          label="Total mentions"
          value={metrics.totalMentions}
          hint={
            metrics.newLast30d > 0
              ? `${metrics.newLast30d} new in last 30d`
              : "No new in last 30d"
          }
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <KpiTile
          label="% Negative"
          value={
            metrics.negativePct === null ? "—" : `${metrics.negativePct}%`
          }
          hint="Share of classified mentions"
          icon={<AlertCircle className="h-4 w-4" />}
        />
        <KpiTile
          label="Needs response"
          value={metrics.unreviewedCount}
          hint={
            metrics.flaggedCount > 0
              ? `${metrics.flaggedCount} flagged for action`
              : "Unreviewed mentions"
          }
          icon={<Flag className="h-4 w-4" />}
        />
      </section>

      {/* Chart row — sentiment donut, source donut, topic bars */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardSection title="Sentiment" eyebrow="Classified mentions">
          <SentimentDonut data={metrics.sentimentBreakdown} />
        </DashboardSection>
        <DashboardSection title="Platform mix" eyebrow="By source">
          <SourceDonut data={metrics.sourceBreakdown} />
        </DashboardSection>
        <DashboardSection title="Top topics" eyebrow="Recurring themes">
          <TopicBars data={metrics.topicBreakdown} />
        </DashboardSection>
      </section>

      {/* Monthly volume + negative keywords */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardSection
          title="Mentions over time"
          eyebrow="Last 6 months"
          className="lg:col-span-2"
        >
          <MonthlyVolumeChart data={metrics.monthlyVolume} />
        </DashboardSection>
        <DashboardSection
          title="Recurring complaints"
          eyebrow="Top phrases in negative mentions"
        >
          <NegativeKeywords data={metrics.negativeKeywords} />
        </DashboardSection>
      </section>
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
    color: SOURCE_COLORS[d.source] ?? "#6b7280",
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
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-center gap-4">
      <div className="relative h-[140px] w-[140px] mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              cursor={false}
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
              innerRadius={44}
              outerRadius={66}
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
// Monthly volume chart — count + negative slice stacked.
// ---------------------------------------------------------------------------

function MonthlyVolumeChart({
  data,
}: {
  data: Array<{ month: string; count: number; negative: number }>;
}) {
  const hasAny = data.some((d) => d.count > 0);
  if (!hasAny) return <EmptyChart />;

  const formatted = data.map((d) => {
    const [year, month] = d.month.split("-");
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString(
      "en-US",
      { month: "short" },
    );
    return {
      month: label,
      total: d.count - d.negative,
      negative: d.negative,
    };
  });

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
          <XAxis
            dataKey="month"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#f3f4f6" }}
            contentStyle={{
              fontSize: 12,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
            }}
            formatter={(v: number, n: string) => [
              v,
              n === "negative" ? "Negative" : "Other",
            ]}
          />
          <Bar
            dataKey="negative"
            stackId="a"
            fill="#ef4444"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="total"
            stackId="a"
            fill="#2563EB"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
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
