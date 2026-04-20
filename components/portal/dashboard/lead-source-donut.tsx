"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ---------------------------------------------------------------------------
// LeadSourceDonut
//
// Donut + legend pair for the "Where leads come from" tile. Pure presentation
// component — accepts a clean `slices` array. Colors come from a fixed
// palette tuned to the Claude-warm system (terracotta + warm neutrals + a
// few muted brand-ish tones).
//
// Real wiring (when ad/seo agents land):
//   slices = await aggregateLeadsBySource({ orgId, sinceDays: 28 })
// ---------------------------------------------------------------------------

export type LeadSourceSlice = {
  source: string;          // "Google Ads", "Meta Ads", "Organic", "Direct", "Chatbot", "Referral"
  count: number;
  color?: string;          // optional override
};

const PALETTE = [
  "#c96442", // terracotta (brand)
  "#3d3d3a", // dark warm
  "#5e5d59", // olive gray
  "#87867f", // stone gray
  "#b0aea5", // warm silver
  "#e8e6dc", // warm sand
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
      <div className="text-xs text-[var(--stone-gray)]">
        No lead source data yet. Once your channels report in, this fills out.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-5">
      <div className="relative h-[160px] w-[160px] mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              cursor={false}
              contentStyle={{
                fontSize: 12,
                background: "var(--white)",
                border: "1px solid var(--border-cream)",
                borderRadius: 8,
                boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
              }}
              labelStyle={{ color: "var(--olive-gray)" }}
              formatter={(v: number, n: string) => [v, n]}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={75}
              stroke="var(--ivory)"
              strokeWidth={2}
              paddingAngle={1.5}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
            Total
          </span>
          <span className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--near-black)]">
            {total}
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {data.map((d) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={d.name}
              className="grid grid-cols-[12px_1fr_auto_42px] items-center gap-2.5 text-xs"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-[var(--charcoal-warm)] truncate">{d.name}</span>
              <span className="tabular-nums text-[var(--olive-gray)]">{d.value}</span>
              <span className="text-right tabular-nums text-[var(--stone-gray)]">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
