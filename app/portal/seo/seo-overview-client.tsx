"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Metric, MetricStrip, Panel, type Tone } from "@/components/portal/overview/kit";
import type { TimeseriesPoint } from "./seo-timeseries-chart";
import { SeoAnnotationsPanel, type SeoAnnotation } from "./seo-annotations-panel";
import {
  SeoQueriesPagesTables,
  type RankedRow,
} from "./seo-queries-pages-tables";

// Recharts loads only when this chart renders (mirrors conversations-trend.tsx).
const SeoTimeseriesChart = dynamic(
  () => import("./seo-timeseries-chart").then((m) => m.SeoTimeseriesChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-72 w-full border border-dashed border-border"
        aria-hidden="true"
      />
    ),
  },
);

// Pre-formatted delta produced by page.tsx's buildDelta/buildPositionDelta.
// "positive" is already brand-aware (true only for a genuine improvement);
// everything else collapses to muted/flat in the old hand-rolled card. The
// canonical KpiTile wants an explicit up/down/flat trend, so `toTrend` below
// derives it from the same two fields without touching the server-side
// delta builders.
export type KpiDelta = {
  label: string; // pre-formatted "+12%", "-3%", "+0.4"
  positive: boolean;
};

// `null` means there is no prior period to compare against. It is not a flat
// trend, and it must not render a pill: an em-dash in the delta slot claims a
// comparison that was never made.
function toDelta(delta: KpiDelta | null): { text: string; tone: Tone } | null {
  if (!delta) return null;
  return { text: delta.label, tone: delta.positive ? "good" : "bad" };
}

// ---------------------------------------------------------------------------
// SeoOverviewClient — the assembled client view for /portal/seo. The server
// component fetches and shapes data, then hands the whole bundle to this
// component which owns layout + interactivity.
//
// Layout, top-to-bottom:
//   1. Source picker chip row (data origin + range eyebrow).
//   2. KPI strip — 4 hero cards with sparklines.
//   3. Unified time-series chart (left, ~2/3) + annotations panel (right, ~1/3).
//   4. Queries + Pages compact tables, side-by-side.
//
// All interactivity (legend toggle, future range selector) lives here so the
// surrounding page stays a fast server component.
// ---------------------------------------------------------------------------

export type SeoOverviewKpis = {
  clicks:      { value: number; delta: KpiDelta | null; spark: number[] };
  impressions: { value: number; delta: KpiDelta | null; spark: number[] };
  ctr:         { value: number; delta: KpiDelta | null; spark: number[] }; // 0-1
  position:    { value: number; delta: KpiDelta | null; spark: number[] };
};

export type SeoOverviewClientProps = {
  source: string;                // "Google Search Console"
  propertyLabel: string | null;  // shown in the source chip
  rangeLabel: string;            // "Last 30 days vs prior 30 days"
  kpis: SeoOverviewKpis;
  timeseries: TimeseriesPoint[];
  annotations: SeoAnnotation[];
  topQueries: RankedRow[];
  topPages: RankedRow[];
};

export function SeoOverviewClient(props: SeoOverviewClientProps) {
  return (
    <div className="space-y-5">
      <MetricStrip cols={4}>
        <Metric label="Clicks" value={fmtNumber(props.kpis.clicks.value)} delta={toDelta(props.kpis.clicks.delta)} note="From Google search" />
        <Metric label="Impressions" value={fmtNumber(props.kpis.impressions.value)} delta={toDelta(props.kpis.impressions.delta)} note="Times your pages showed" />
        <Metric label="Click-through rate" value={fmtPercent(props.kpis.ctr.value)} delta={toDelta(props.kpis.ctr.delta)} note="Clicks over impressions" />
        <Metric label="Average position" value={fmtPosition(props.kpis.position.value)} delta={toDelta(props.kpis.position.delta)} note="Lower is better" />
      </MetricStrip>

      {/* Chart + annotations rail. On lg+ we run a 3-col grid so the chart
          gets 2/3 and the annotations rail gets 1/3 — exactly the
          Searchable proportion. Stacks on smaller breakpoints. */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Clicks and impressions" aside="Daily, last 12 months" className="lg:col-span-2">
          <SeoTimeseriesChart data={props.timeseries} />
        </Panel>
        <SeoAnnotationsPanel annotations={props.annotations} />
      </section>

      {/* Queries + Pages compact side-by-side tables */}
      <section>
        <SeoQueriesPagesTables
          queries={props.topQueries}
          pages={props.topPages}
        />
      </section>
    </div>
  );
}

function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function fmtPosition(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return value.toFixed(1);
}
