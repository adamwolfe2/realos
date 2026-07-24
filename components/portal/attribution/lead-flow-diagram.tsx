"use client";

import * as React from "react";
import { SourceLogo } from "@/components/portal/attribution/source-logo";
import { CHART_COLORS } from "@/components/portal/ui/chart-theme";
import { EmptyState } from "@/components/portal/ui/empty-state";

// ---------------------------------------------------------------------------
// LeadFlowDiagram — the attribution hero. Source logos on the left, their
// volume-weighted streams converging into a central "Leads" hub, then fanning
// out to the funnel outcomes (Toured → Applied → Signed) on the right.
//
// Pure analytic layout inside one responsive SVG so node logos (foreignObject)
// and the bezier streams stay pixel-aligned at any width. Hovering a source
// isolates its stream. Honors prefers-reduced-motion (CSS handles it).
// ---------------------------------------------------------------------------

export type FlowSourceVM = {
  id: string;
  label: string;
  color: string;
  logo: string;
  leads: number;
  sessions: number;
  conversionRate: number | null;
};

export type FlowStageVM = { id: string; label: string; count: number };

const MAX_SOURCES = 8;

export function LeadFlowDiagram({
  sources,
  stages,
  totalLeads,
  totalSessions,
  imported,
}: {
  sources: FlowSourceVM[];
  stages: FlowStageVM[];
  totalLeads: number;
  totalSessions: number;
  imported?: { leads: number };
}) {
  const [hovered, setHovered] = React.useState<string | null>(null);

  // Collapse the long tail into a single muted "Other sources" node.
  const shown = sources.slice(0, MAX_SOURCES);
  const rest = sources.slice(MAX_SOURCES);
  const display: FlowSourceVM[] = [...shown];
  if (rest.length > 0) {
    display.push({
      id: "__other__",
      label: `${rest.length} more sources`,
      color: CHART_COLORS.silver,
      logo: "other",
      leads: rest.reduce((s, r) => s + r.leads, 0),
      sessions: rest.reduce((s, r) => s + r.sessions, 0),
      conversionRate: null,
    });
  }

  // --- Geometry -----------------------------------------------------------
  const W = 1000;
  const rowH = 58;
  const padY = 28;
  const n = Math.max(display.length, 4);
  const H = padY * 2 + n * rowH;
  const midY = H / 2;

  const NODE_X = 16; // left edge of logo
  const SRC_ANCHOR_X = 286; // where a source stream departs
  const HUB_X = W / 2;
  const HUB_R = 56;
  const STAGE_ANCHOR_X = W - 286; // where a stage stream lands
  const STAGE_X = W - 256; // left edge of stage card

  const maxLeads = Math.max(1, ...display.map((d) => d.leads));
  const maxStage = Math.max(1, ...stages.map((s) => s.count));

  const srcY = (i: number) => padY + i * rowH + rowH / 2;

  const stageGap = 78;
  const stageY = (j: number) => midY + (j - (stages.length - 1) / 2) * stageGap;

  const strokeW = (value: number, max: number, lo = 1.5, hi = 16) =>
    lo + (value / max) * (hi - lo);

  const dim = (id: string) => hovered !== null && hovered !== id;

  return (
    <div className="ls-card p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Where your leads flow in from
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every channel — ILS sites, search, ads, your chatbot &amp; forms —
            mapped to leads and pipeline. Stream width = lead volume.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-lg font-semibold text-foreground tabular-nums">
            {totalLeads.toLocaleString()}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            leads mapped · {totalSessions.toLocaleString()} sessions
          </div>
        </div>
      </div>

      {imported && imported.leads > 0 ? (
        <div className="mb-3 flex items-center gap-2 rounded-[2px] border border-dashed border-border bg-muted/30 px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {imported.leads.toLocaleString()}
            </span>{" "}
            {imported.leads === 1 ? "lead" : "leads"} couldn&apos;t be matched to
            any channel or PMS source and {imported.leads === 1 ? "is" : "are"}{" "}
            excluded from the flow above. AppFolio-synced leads now appear as
            their own leasing lane.
          </span>
        </div>
      ) : null}

      {display.length === 0 ? (
        <EmptyState
          variant="bare"
          title="No attributed sources in this window yet."
        />
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto ls-flow-svg"
          style={{ minHeight: 240 }}
          role="img"
          aria-label="Lead source flow diagram"
        >
          <defs>
            <style>{`
              @keyframes lsFlowDash { to { stroke-dashoffset: -28; } }
              .ls-flow-stream { stroke-dasharray: 10 18; animation: lsFlowDash 1.4s linear infinite; }
              @media (prefers-reduced-motion: reduce) {
                .ls-flow-stream { animation: none; stroke-dasharray: none; }
              }
            `}</style>
          </defs>

          {/* Source → hub streams */}
          {display.map((s, i) => {
            const sw = s.leads > 0 ? strokeW(s.leads, maxLeads) : 1.2;
            const active = !dim(s.id);
            return (
              <path
                key={`src-${s.id}`}
                d={curve(SRC_ANCHOR_X, srcY(i), HUB_X - HUB_R, midY)}
                fill="none"
                stroke={s.color}
                strokeWidth={sw}
                strokeLinecap="round"
                className={s.leads > 0 ? "ls-flow-stream" : undefined}
                style={{
                  opacity: active ? (s.leads > 0 ? 0.55 : 0.25) : 0.08,
                  transition: "opacity 160ms ease",
                }}
              />
            );
          })}

          {/* Hub → stage streams */}
          {stages.map((st, j) => (
            <path
              key={`stage-${st.id}`}
              d={curve(HUB_X + HUB_R, midY, STAGE_ANCHOR_X, stageY(j))}
              fill="none"
              stroke={CHART_COLORS.brand}
              strokeWidth={strokeW(st.count, maxStage, 1.5, 14)}
              strokeLinecap="round"
              style={{ opacity: hovered ? 0.12 : 0.4, transition: "opacity 160ms ease" }}
            />
          ))}

          {/* Source nodes (logo + label + counts) */}
          {display.map((s, i) => {
            const y = srcY(i);
            return (
              <foreignObject
                key={`node-${s.id}`}
                x={NODE_X}
                y={y - rowH / 2 + 4}
                width={SRC_ANCHOR_X - NODE_X - 8}
                height={rowH - 8}
                style={{ overflow: "visible" }}
              >
                <div
                  className="flex items-center gap-2.5 h-full cursor-default"
                  style={{ opacity: dim(s.id) ? 0.4 : 1, transition: "opacity 160ms ease" }}
                  onMouseEnter={() => setHovered(s.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <SourceLogo logo={s.id} size={34} />
                  <div className="min-w-0 leading-tight">
                    <div className="text-[12.5px] font-semibold text-foreground truncate">
                      {s.label}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground font-mono tabular-nums">
                      {s.leads.toLocaleString()} lead{s.leads === 1 ? "" : "s"}
                      {s.conversionRate !== null && s.sessions > 0
                        ? ` · ${(s.conversionRate * 100).toFixed(1)}% CVR`
                        : s.sessions > 0
                          ? ` · ${s.sessions.toLocaleString()} sess`
                          : ""}
                    </div>
                  </div>
                </div>
              </foreignObject>
            );
          })}

          {/* Central Leads hub — Carbon Blue 10 fill, Blue 60 stroke/ink. */}
          <circle
            cx={HUB_X}
            cy={midY}
            r={HUB_R}
            fill="#edf5ff"
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
          />
          <text
            x={HUB_X}
            y={midY - 6}
            textAnchor="middle"
            fill={CHART_COLORS.brand}
            style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}
          >
            {totalLeads.toLocaleString()}
          </text>
          <text
            x={HUB_X}
            y={midY + 14}
            textAnchor="middle"
            fill={CHART_COLORS.brandDeep}
            style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em" }}
          >
            LEADS
          </text>

          {/* Stage cards */}
          {stages.map((st, j) => {
            const y = stageY(j);
            return (
              <foreignObject
                key={`stagecard-${st.id}`}
                x={STAGE_X}
                y={y - 24}
                width={W - STAGE_X - 12}
                height={48}
              >
                <div className="flex h-full items-center justify-between rounded-[2px] border border-border bg-card px-3 shadow-[var(--shadow-xs)]">
                  <span className="text-xs font-semibold text-foreground">
                    {st.label}
                  </span>
                  <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                    {st.count.toLocaleString()}
                  </span>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// Smooth horizontal cubic bezier between two points.
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}
