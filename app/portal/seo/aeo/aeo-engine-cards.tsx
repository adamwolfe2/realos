import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import type { AeoEngine } from "@prisma/client";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// Per-engine summary strip rendered above the All Responses table.
// 4 cards, one per AI assistant. Each card shows engine logo + name on
// top, the headline citation % below in tabular nums, a hand-rolled 7-day
// citation-rate sparkline, total queries hint, and last-scan relative
// time. Engines without an API key configured render an opacity-60 card
// with a "Not configured" pill instead of the metric.
//
// All accent strokes use LeaseStack blue (text-primary / currentColor)
// — no per-engine rainbow.

export type EngineCardData = {
  engine: AeoEngine;
  configured: boolean;
  rate: number;
  cited: number;
  total: number;
  lastScan: Date | null;
  /** Citation rate per day for the last 7 days, oldest → newest. */
  sparkline7d: number[];
};

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};

function EngineLogo({ engine, size = 20 }: { engine: AeoEngine; size?: number }) {
  switch (engine) {
    case "CHATGPT":
      return <ChatGPTMark size={size} />;
    case "PERPLEXITY":
      return <PerplexityMark size={size} />;
    case "CLAUDE":
      return <ClaudeMark size={size} />;
    case "GEMINI":
      return <GeminiMark size={size} />;
  }
}

function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

// Hand-rolled SVG sparkline. Avoids pulling recharts into a card that
// only ever shows 7 points. Renders a smooth polyline between [0..1]
// y-values, with an end-cap dot at the most-recent value.
function Sparkline({ data }: { data: number[] }) {
  const W = 100;
  const H = 24;
  if (!data.length || data.every((v) => v === 0)) {
    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full h-6"
        aria-hidden
      >
        <line
          x1={0}
          x2={W}
          y1={H - 1}
          y2={H - 1}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? W / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * step;
    const y = H - 2 - (v / max) * (H - 4);
    return { x, y };
  });
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full h-6 text-primary"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2} fill="currentColor" />
    </svg>
  );
}

export function AeoEngineCards({ rows }: { rows: EngineCardData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      {rows.map((row) => {
        const dim = !row.configured;
        return (
          <div
            key={row.engine}
            className={
              "ls-card p-4 flex flex-col gap-3 " + (dim ? "opacity-60" : "")
            }
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <EngineLogo engine={row.engine} size={20} />
                <span className="text-[13px] font-semibold text-foreground truncate">
                  {ENGINE_LABELS[row.engine]}
                </span>
              </div>
              {dim ? (
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Not configured
                </span>
              ) : null}
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground leading-none">
                  {row.configured ? fmtPercent(row.rate) : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1.5">
                  {!row.configured
                    ? "API key missing"
                    : row.total === 0
                      ? "No queries yet"
                      : `${row.cited} of ${row.total} queries`}
                </div>
              </div>
              <div className="w-[100px] shrink-0">
                <Sparkline data={row.sparkline7d} />
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {row.lastScan
                ? `Last scan ${formatDistanceToNow(row.lastScan, {
                    addSuffix: true,
                  })}`
                : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
