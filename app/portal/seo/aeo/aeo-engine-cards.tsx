import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Link2 } from "lucide-react";
import type { AeoEngine } from "@prisma/client";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// Per-engine summary cards.
//
// Each card surfaces TWO numbers, not one:
//   • Mention rate  — share of queries where the engine *named* the brand
//                     anywhere in its answer (your brand is in the AI's
//                     awareness even if it doesn't link out).
//   • Citation rate — share of queries where the engine *linked* the
//                     brand's URL (the harder, AEO-money signal).
//
// The previous single-headline-percent design surfaced only citation
// rate, which routinely reads 0% even when the brand is being
// mentioned 80% of the time. That made the page feel "broken" when it
// was actually showing real, actionable signal — just badly framed.
//
// All accent strokes use LeaseStack blue. No per-engine rainbow.
// ---------------------------------------------------------------------------

export type EngineCardData = {
  engine: AeoEngine;
  configured: boolean;
  /** Mention rate over the last 30d (mentioned / total queries). */
  mentionRate: number;
  mentioned: number;
  /** Citation rate over the last 30d (citedUrl present / total queries). */
  citationRate: number;
  cited: number;
  total: number;
  lastScan: Date | null;
  /** Mention rate per day for the last 7 days, oldest → newest. */
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

// Compact dual-metric row — "Mentioned 67%" / "Cited 0%" stacked on
// the right of the card, with the metric label in caps-mono and the
// value in tabular nums. This is the visual switch from "single
// misleading 0%" to "honest two-number split".
function MetricLine({
  icon: Icon,
  label,
  value,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  count: { hits: number; total: number };
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.10em] text-muted-foreground">
        <Icon className="w-2.5 h-2.5" />
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {count.hits}/{count.total}
        </span>
        <span className="text-[13px] tabular-nums font-semibold text-foreground">
          {fmtPercent(value)}
        </span>
      </div>
    </div>
  );
}

export function AeoEngineCards({ rows }: { rows: EngineCardData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      {rows.map((row) => {
        const dim = !row.configured;
        const noData = row.configured && row.total === 0;
        return (
          <div
            key={row.engine}
            className={
              "ls-card p-4 flex flex-col gap-3 " + (dim ? "opacity-60" : "")
            }
          >
            {/* Header: logo + name + (sparkline | Not configured pill) */}
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
              ) : (
                <div className="w-[64px] shrink-0">
                  <Sparkline data={row.sparkline7d} />
                </div>
              )}
            </div>

            {/* Dual-metric block */}
            {dim ? (
              <p className="text-[11px] text-muted-foreground">
                API key missing on server.
              </p>
            ) : noData ? (
              <p className="text-[11px] text-muted-foreground">
                No queries yet. The scanner runs Mondays — or hit "Scan now"
                above to start one.
              </p>
            ) : (
              <div className="space-y-1.5">
                <MetricLine
                  icon={Check}
                  label="Mentioned"
                  value={row.mentionRate}
                  count={{ hits: row.mentioned, total: row.total }}
                />
                <MetricLine
                  icon={Link2}
                  label="Cited"
                  value={row.citationRate}
                  count={{ hits: row.cited, total: row.total }}
                />
              </div>
            )}

            <div className="text-[10px] text-muted-foreground tabular-nums mt-auto">
              {row.lastScan
                ? `Last scan ${formatDistanceToNow(row.lastScan, {
                    addSuffix: true,
                  })}`
                : "Never scanned"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
