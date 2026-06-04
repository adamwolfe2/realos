"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { MentionSource } from "@prisma/client";
import { SourceLogo } from "./source-logo";

// ---------------------------------------------------------------------------
// Shared donut renderer for the reputation panel — split into its own file
// (2026-06-04) so recharts can be lazy-loaded. metrics-panel.tsx imports
// this via next/dynamic + ssr:false so the recharts chunk (~95-110KB gzip)
// no longer ships in the reputation tab's first-paint bundle. The MetricsPanel
// hand-rolled SVG chart (MonthlyVolumeChart) doesn't touch recharts so the
// extraction fully removes the lib from the eager bundle.
// ---------------------------------------------------------------------------

export type DonutDatum = {
  name: string;
  value: number;
  color: string;
  key: string;
  logoSource?: MentionSource;
  logoUrl?: string;
};

export function DonutWithLegend({
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
