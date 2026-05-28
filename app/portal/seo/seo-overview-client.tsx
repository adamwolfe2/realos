"use client";

import * as React from "react";
import { SeoKpiCard, type KpiDelta } from "./seo-kpi-card";
import { SeoTimeseriesChart, type TimeseriesPoint } from "./seo-timeseries-chart";
import { SeoAnnotationsPanel, type SeoAnnotation } from "./seo-annotations-panel";
import {
  SeoQueriesPagesTables,
  type RankedRow,
} from "./seo-queries-pages-tables";

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
  clicks:      { value: number; delta: KpiDelta; spark: number[] };
  impressions: { value: number; delta: KpiDelta; spark: number[] };
  ctr:         { value: number; delta: KpiDelta; spark: number[] }; // 0-1
  position:    { value: number; delta: KpiDelta; spark: number[] };
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
    <div className="space-y-4">
      {/* Source chip row. Mirrors the inspiration: data origin on the left,
          range descriptor on the right. The range selector itself is not
          interactive yet — we currently fix the window to 30d-vs-prior-30d
          so the eyebrow text reflects that honestly. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-primary"
          />
          <span>{props.source}</span>
          {props.propertyLabel ? (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
                {props.propertyLabel}
              </span>
            </>
          ) : null}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {props.rangeLabel}
        </div>
      </div>

      {/* KPI strip — 2 cols on mobile, 4 on md+ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <SeoKpiCard
          label="Clicks"
          value={fmtNumber(props.kpis.clicks.value)}
          delta={props.kpis.clicks.delta}
          sparkline={props.kpis.clicks.spark}
        />
        <SeoKpiCard
          label="Impressions"
          value={fmtNumber(props.kpis.impressions.value)}
          delta={props.kpis.impressions.delta}
          sparkline={props.kpis.impressions.spark}
        />
        <SeoKpiCard
          label="Avg CTR"
          value={fmtPercent(props.kpis.ctr.value)}
          delta={props.kpis.ctr.delta}
          sparkline={props.kpis.ctr.spark}
        />
        <SeoKpiCard
          label="Avg Position"
          value={fmtPosition(props.kpis.position.value)}
          delta={props.kpis.position.delta}
          sparkline={props.kpis.position.spark}
          invertSparkline
        />
      </section>

      {/* Chart + annotations rail. On lg+ we run a 3-col grid so the chart
          gets 2/3 and the annotations rail gets 1/3 — exactly the
          Searchable proportion. Stacks on smaller breakpoints. */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 ls-card p-4">
          <div className="mb-3">
            <h2
              className="text-[14px] font-semibold tracking-tight text-foreground leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Clicks & Impressions
            </h2>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">
              Daily totals over the selected window. Toggle a series above to
              focus on just one line.
            </p>
          </div>
          <SeoTimeseriesChart data={props.timeseries} />
        </div>
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
