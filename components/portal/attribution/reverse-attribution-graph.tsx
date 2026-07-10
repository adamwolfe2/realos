"use client";

import * as React from "react";
import { SourceLogo } from "@/components/portal/attribution/source-logo";
import { CHART_COLORS } from "@/components/portal/ui/chart-theme";

// ---------------------------------------------------------------------------
// ReverseAttributionGraph — interactive 3-stage flow:
//   Referrer / Source  →  Landing page  →  Outcome
//
// Hover any node to trace its full path (connected links + nodes highlighted,
// the rest dimmed). Click a source or landing node to filter the resolutions
// table below. Analytic layout in one responsive SVG so node boxes
// (foreignObject) and bezier links stay aligned at any width.
// ---------------------------------------------------------------------------

export type RvNode = {
  id: string;
  label: string;
  kind: "source" | "landing" | "outcome";
  color: string;
  logo?: string;
  value: number;
};
export type RvLink = { source: string; target: string; value: number };

export type GraphFilter = { type: "source" | "landing"; value: string } | null;

const COL = {
  src: { x: 8, w: 210 },
  land: { x: 388, w: 244 },
  out: { x: 792, w: 200 },
};
const ROW_H = 52;
const BOX_H = 44;
const W = 1000;
const MAX_PER_COL = 8;

export function ReverseAttributionGraph({
  sources,
  landings,
  outcomes,
  links,
  selected,
  onSelect,
}: {
  sources: RvNode[];
  landings: RvNode[];
  outcomes: RvNode[];
  links: RvLink[];
  selected: GraphFilter;
  onSelect: (f: GraphFilter) => void;
}) {
  const [hovered, setHovered] = React.useState<string | null>(null);

  const src = sources.slice(0, MAX_PER_COL);
  const land = landings.slice(0, MAX_PER_COL);
  const out = outcomes;

  const kept = new Set<string>([
    ...src.map((n) => n.id),
    ...land.map((n) => n.id),
    ...out.map((n) => n.id),
  ]);
  const shownLinks = links.filter(
    (l) => kept.has(l.source) && kept.has(l.target),
  );

  const rows = Math.max(src.length, land.length, out.length, 3);
  const H = rows * ROW_H + 16;

  // node id → geometry
  const geo = new Map<
    string,
    { cyc: number; leftX: number; rightX: number; col: keyof typeof COL }
  >();
  const place = (nodes: RvNode[], col: keyof typeof COL) => {
    const k = nodes.length;
    const top = (H - k * ROW_H) / 2;
    nodes.forEach((n, i) => {
      geo.set(n.id, {
        cyc: top + i * ROW_H + ROW_H / 2,
        leftX: COL[col].x,
        rightX: COL[col].x + COL[col].w,
        col,
      });
    });
  };
  place(src, "src");
  place(land, "land");
  place(out, "out");

  const maxLink = Math.max(1, ...shownLinks.map((l) => l.value));
  const strokeW = (v: number) => 1.5 + (v / maxLink) * 13;

  // neighbor set for hover highlight
  const neighbors = new Set<string>();
  if (hovered) {
    neighbors.add(hovered);
    for (const l of shownLinks) {
      if (l.source === hovered) neighbors.add(l.target);
      if (l.target === hovered) neighbors.add(l.source);
    }
  }
  const linkActive = (l: RvLink) =>
    !hovered || l.source === hovered || l.target === hovered;
  const nodeDim = (id: string) => hovered != null && !neighbors.has(id);

  const selectedId =
    selected?.type === "source"
      ? `src:${selected.value}`
      : selected?.type === "landing"
        ? `lp:${selected.value}`
        : null;

  const handleClick = (n: RvNode) => {
    if (n.kind === "source") {
      const value = n.logo ?? n.id.replace("src:", "");
      onSelect(
        selected?.type === "source" && selected.value === value
          ? null
          : { type: "source", value },
      );
    } else if (n.kind === "landing") {
      if (n.id === "lp:__other__") return;
      const value = n.label;
      onSelect(
        selected?.type === "landing" && selected.value === value
          ? null
          : { type: "landing", value },
      );
    }
  };

  if (src.length === 0 && land.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No tracked web traffic in this window yet.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ minHeight: 260 }}
      role="img"
      aria-label="Reverse attribution flow"
    >
      {/* column headers */}
      <text x={COL.src.x} y={12} className="fill-muted-foreground" style={LABEL}>
        SOURCE
      </text>
      <text x={COL.land.x} y={12} className="fill-muted-foreground" style={LABEL}>
        LANDING PAGE
      </text>
      <text x={COL.out.x} y={12} className="fill-muted-foreground" style={LABEL}>
        OUTCOME
      </text>

      {/* links */}
      {shownLinks.map((l, i) => {
        const a = geo.get(l.source);
        const b = geo.get(l.target);
        if (!a || !b) return null;
        const x1 = a.rightX;
        const x2 = b.leftX;
        return (
          <path
            key={i}
            d={curve(x1, a.cyc, x2, b.cyc)}
            fill="none"
            stroke={colorOf(l.source, src, land)}
            strokeWidth={strokeW(l.value)}
            strokeLinecap="round"
            style={{
              opacity: linkActive(l) ? 0.4 : 0.06,
              transition: "opacity 150ms ease",
            }}
          />
        );
      })}

      {/* nodes */}
      {[...src, ...land, ...out].map((n) => {
        const g = geo.get(n.id);
        if (!g) return null;
        const isSel = selectedId === n.id;
        const clickable = n.kind !== "outcome" && n.id !== "lp:__other__";
        return (
          <foreignObject
            key={n.id}
            x={COL[g.col].x}
            y={g.cyc - BOX_H / 2}
            width={COL[g.col].w}
            height={BOX_H}
            style={{ overflow: "visible" }}
          >
            <div
              className={`flex h-full items-center gap-2 rounded-[2px] border px-2 ${
                clickable ? "cursor-pointer" : "cursor-default"
              } ${isSel ? "ring-2 ring-primary" : ""}`}
              style={{
                background: isSel ? "#edf5ff" : "#fff",
                borderColor: isSel
                  ? CHART_COLORS.brand
                  : `var(--color-border, ${CHART_COLORS.grid})`,
                opacity: nodeDim(n.id) ? 0.35 : 1,
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => clickable && handleClick(n)}
            >
              {n.kind === "source" && n.logo ? (
                <SourceLogo logo={n.logo} size={26} />
              ) : (
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: n.color }}
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                {n.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {n.value.toLocaleString()}
              </span>
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
}

const LABEL: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.12em",
};

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

// Color a link by its originating node when it's a source, else neutral blue.
function colorOf(sourceId: string, src: RvNode[], land: RvNode[]): string {
  const s = src.find((n) => n.id === sourceId);
  if (s) return s.color;
  const l = land.find((n) => n.id === sourceId);
  return l?.color ?? CHART_COLORS.silver;
}
