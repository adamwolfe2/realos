"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { LeadSourceDonutChartDatum } from "./lead-source-donut-chart";
import { SourceBars } from "./source-bars";
import { StaggerGroup, StaggerItem } from "@/components/portal/ui/motion";

// Defer the recharts-bearing inner chart so the dashboard initial bundle
// doesn't ship recharts. The legend below the chart renders immediately
// in HTML; only the SVG donut waits for the chunk.
const LeadSourceDonutChart = dynamic(
  () => import("./lead-source-donut-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-full border border-dashed border-border" aria-hidden="true" />
    ),
  },
);

export type LeadSourceSlice = {
  source: string;
  count: number;
  color?: string;
};

// Monochromatic blue ramp. Brand decision: every category slice across the
// product (lead source donut, conversion funnel, channel breakdowns, …)
// stays on the LeaseStack blue ramp — no orange / green / amber / violet
// distractions. Slices step from darkest (largest) to palest (smallest);
// for >6 slices we cycle and the brand intent still reads. Mirrors the
// ramp used in the product-tour demo so the live portal and the marketing
// dashboard look like the same product.
const PALETTE = [
  "#002d9c", // Carbon Blue 80
  "#0f62fe", // Carbon Blue 60 (brand)
  "#4589ff", // Carbon Blue 50
  "#78a9ff", // Carbon Blue 40
  "#a6c8ff", // Carbon Blue 30
  "#c6dcff", // Carbon Blue 20
];

export function LeadSourceDonut({ slices }: { slices: LeadSourceSlice[] }) {
  const total = slices.reduce((acc, s) => acc + s.count, 0);
  const data = slices.map((s, i) => ({
    name: s.source,
    value: s.count,
    color: s.color ?? PALETTE[i % PALETTE.length],
  }));

  if (total === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No lead source data yet. Once your channels report in, this fills out.
      </div>
    );
  }

  // Sparse-data treatment: when every lead lands in the same channel (or the
  // dataset is so small a donut would render as a single-colour ring), fall
  // back to a horizontal bar list. A 100% solid circle reads as a broken
  // chart; a single bar with "All N from Chatbot" reads as intentional.
  // Threshold of 5 mirrors the dashboard's "below 5 looks sparse" rule and
  // catches launches like SG (4 leads, mostly one source) without flipping
  // a normal-sized dataset into the bar fallback.
  if (slices.length <= 1 || total <= 5) {
    return (
      <SourceBars
        rows={data.map((d) => ({ label: d.name, value: d.value }))}
        total={total}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-5">
      <div className="relative h-[160px] w-[160px] mx-auto">
        <LeadSourceDonutChart data={data as LeadSourceDonutChartDatum[]} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Total
          </span>
          <span className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
            {total}
          </span>
        </div>
      </div>

      <StaggerGroup as="ul" className="space-y-1.5">
        {data.map((d, i) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <StaggerItem
              as="li"
              index={i}
              key={d.name}
              className="grid grid-cols-[12px_1fr_auto_42px] items-center gap-2.5 text-xs"
              direction="left"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[1px]"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-foreground truncate">{d.name}</span>
              <span className="tabular-nums text-muted-foreground">{d.value}</span>
              <span className="text-right tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </div>
  );
}
