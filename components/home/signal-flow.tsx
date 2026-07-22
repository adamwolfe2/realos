"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// SignalFlow — the hero's signature diagram (cool pass M2, executed LIGHT per
// Adam's "no dark ever" ruling; motion pass sec 1). Leads flow from capture
// sources, converge through the LeaseStack hub, and fan out into leasing
// outcomes. Bright pulses travel the lines on a slow loop (the ONE infinite
// animation on the page). Hovering a source highlights its onward path;
// hovering an outcome highlights everything feeding it. Pills tick + count as
// pulses arrive (illustrative, not a real stat).
//
// Reduced-motion: fully static diagram, no pulses, no ticking.
// Mobile: a simplified layout (3 sources, outcomes stacked below the hub).
// ---------------------------------------------------------------------------

type Src = { id: string; label: string; x: number; y: number };
type Pill = { id: string; label: string; cx: number; cy: number; w: number };
type Dot = { x: number; y: number };

type Cfg = {
  viewBox: string;
  hub: { x: number; y: number };
  sources: Src[];
  pills: Pill[];
  dots: Dot[];
  srcPath: (s: Src) => string;
  pillPath: (p: Pill) => string;
  srcLabel: (s: Src) => { x: number; y: number; anchor: "end" | "middle" };
  pillH: number;
};

const LINE = "#dbe3f2";
const LINE_ON = "#0f62fe";
const DOT = "#c9d4ea";
const LABEL = "#6f7a94";

const DESKTOP: Cfg = {
  viewBox: "0 0 1200 380",
  hub: { x: 600, y: 190 },
  sources: [
    { id: "chatbot", label: "Chatbot", x: 250, y: 52 },
    { id: "pixel", label: "Pixel", x: 250, y: 121 },
    { id: "ads", label: "Google Ads", x: 250, y: 190 },
    { id: "meta", label: "Meta", x: 250, y: 259 },
    { id: "reviews", label: "Reviews", x: 250, y: 328 },
  ],
  pills: [
    { id: "tours", label: "Tours", cx: 1010, cy: 100, w: 190 },
    { id: "apps", label: "Applications", cx: 1010, cy: 190, w: 190 },
    { id: "leases", label: "Signed leases", cx: 1010, cy: 280, w: 190 },
  ],
  dots: [
    { x: 60, y: 40 }, { x: 110, y: 70 }, { x: 48, y: 110 }, { x: 150, y: 44 },
    { x: 90, y: 150 }, { x: 40, y: 200 }, { x: 130, y: 210 }, { x: 70, y: 250 },
    { x: 160, y: 270 }, { x: 46, y: 300 }, { x: 120, y: 320 }, { x: 90, y: 348 },
    { x: 180, y: 150 }, { x: 190, y: 300 },
  ],
  srcPath: (s) => `M ${s.x} ${s.y} C ${s.x + 130} ${s.y}, 454 190, 554 190`,
  pillPath: (p) => {
    const left = p.cx - p.w / 2;
    return `M 646 190 C 746 190, ${left - 70} ${p.cy}, ${left} ${p.cy}`;
  },
  srcLabel: (s) => ({ x: s.x - 16, y: s.y + 4, anchor: "end" }),
  pillH: 38,
};

const MOBILE: Cfg = {
  viewBox: "0 0 360 470",
  hub: { x: 180, y: 160 },
  sources: [
    { id: "chatbot", label: "Chatbot", x: 70, y: 52 },
    { id: "pixel", label: "Pixel", x: 180, y: 52 },
    { id: "ads", label: "Ads", x: 290, y: 52 },
  ],
  pills: [
    { id: "tours", label: "Tours", cx: 180, cy: 280, w: 190 },
    { id: "apps", label: "Applications", cx: 180, cy: 350, w: 190 },
    { id: "leases", label: "Signed leases", cx: 180, cy: 420, w: 190 },
  ],
  dots: [
    { x: 30, y: 100 }, { x: 330, y: 100 }, { x: 40, y: 40 }, { x: 320, y: 44 },
    { x: 120, y: 110 }, { x: 240, y: 110 },
  ],
  srcPath: (s) =>
    `M ${s.x} ${s.y} C ${s.x} ${s.y + 55}, 180 82, 180 122`,
  pillPath: (p) => `M 180 198 C 180 ${p.cy - 70}, ${p.cx} ${p.cy - 45}, ${p.cx} ${p.cy - 19}`,
  srcLabel: (s) => ({ x: s.x, y: s.y - 14, anchor: "middle" }),
  pillH: 38,
};

function Diagram({ cfg }: { cfg: Cfg }) {
  const reduce = useReducedMotion();
  const [hoverSource, setHoverSource] = useState<number | null>(null);
  const [hoverPill, setHoverPill] = useState<number | null>(null);
  const [counts, setCounts] = useState<number[]>(cfg.pills.map(() => 0));
  const [pop, setPop] = useState<number | null>(null);

  // The single continuous loop: pulses arriving advance the outcome tallies.
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const id = setInterval(() => {
      const idx = i % cfg.pills.length;
      i += 1;
      setCounts((c) => c.map((n, j) => (j === idx ? n + 1 : n)));
      setPop(idx);
      setTimeout(() => setPop((p) => (p === idx ? null : p)), 320);
    }, 2200);
    return () => clearInterval(id);
  }, [reduce, cfg.pills.length]);

  const srcActive = (i: number) => hoverSource === i || hoverPill !== null;
  const pillActive = (j: number) => hoverPill === j || hoverSource !== null;

  const srcPathId = (i: number) => `sp-${cfg.viewBox.length}-${i}`;
  const pillPathId = (j: number) => `pp-${cfg.viewBox.length}-${j}`;

  return (
    <svg
      viewBox={cfg.viewBox}
      width="100%"
      role="img"
      aria-label="Illustrative diagram: leads flow from capture sources through LeaseStack into tours, applications, and signed leases."
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <radialGradient id="ls-pulse" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#4589ff" />
          <stop offset="100%" stopColor="#0f62fe" />
        </radialGradient>
        <radialGradient id="ls-hubglow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(15,98,254,0.22)" />
          <stop offset="100%" stopColor="rgba(15,98,254,0)" />
        </radialGradient>
        <filter id="ls-pillshadow" x="-20%" y="-40%" width="140%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(22,22,22,0.12)" />
        </filter>
      </defs>

      {/* Faint source constellation */}
      {cfg.dots.map((d, i) => (
        <circle key={`d-${i}`} cx={d.x} cy={d.y} r={2} fill={DOT} opacity={0.7} />
      ))}

      {/* Lines: source -> hub */}
      {cfg.sources.map((s, i) => (
        <path
          key={`sl-${i}`}
          id={srcPathId(i)}
          d={cfg.srcPath(s)}
          fill="none"
          stroke={srcActive(i) ? LINE_ON : LINE}
          strokeWidth={srcActive(i) ? 1.6 : 1}
          strokeOpacity={srcActive(i) ? 1 : 0.9}
          style={{ transition: "stroke 200ms ease, stroke-width 200ms ease" }}
        />
      ))}

      {/* Lines: hub -> pill */}
      {cfg.pills.map((p, j) => (
        <path
          key={`pl-${j}`}
          id={pillPathId(j)}
          d={cfg.pillPath(p)}
          fill="none"
          stroke={pillActive(j) ? LINE_ON : LINE}
          strokeWidth={pillActive(j) ? 1.6 : 1}
          strokeOpacity={pillActive(j) ? 1 : 0.9}
          style={{ transition: "stroke 200ms ease, stroke-width 200ms ease" }}
        />
      ))}

      {/* Pulses (the one continuous loop) */}
      {!reduce &&
        cfg.sources.map((s, i) => (
          <circle key={`sp-${i}`} r={2.6} fill="url(#ls-pulse)">
            <animateMotion
              dur={`${srcActive(i) ? 4 : 9}s`}
              begin={`${i * 0.7}s`}
              repeatCount="indefinite"
            >
              <mpath href={`#${srcPathId(i)}`} />
            </animateMotion>
          </circle>
        ))}
      {!reduce &&
        cfg.pills.map((p, j) => (
          <circle key={`pp-${j}`} r={2.6} fill="url(#ls-pulse)">
            <animateMotion
              dur={`${pillActive(j) ? 4 : 9}s`}
              begin={`${1.2 + j * 0.9}s`}
              repeatCount="indefinite"
            >
              <mpath href={`#${pillPathId(j)}`} />
            </animateMotion>
          </circle>
        ))}

      {/* Hub */}
      <circle cx={cfg.hub.x} cy={cfg.hub.y} r={64} fill="url(#ls-hubglow)" />
      <circle
        cx={cfg.hub.x}
        cy={cfg.hub.y}
        r={44}
        fill="#ffffff"
        stroke="rgba(15,98,254,0.18)"
        strokeWidth={1.5}
      />
      <circle
        cx={cfg.hub.x}
        cy={cfg.hub.y}
        r={31}
        fill="#ffffff"
        stroke="rgba(15,98,254,0.18)"
        strokeWidth={1}
      />
      {/* Pixel glyph (brand motif) */}
      {[
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [1, 0],
        [0, 1],
      ].map(([dx, dy], i) => (
        <rect
          key={`g-${i}`}
          x={cfg.hub.x + dx * 9 - 3.5}
          y={cfg.hub.y + dy * 9 - 3.5}
          width={7}
          height={7}
          rx={1}
          fill="#0f62fe"
        />
      ))}

      {/* Sources: labels, dots, hit areas */}
      {cfg.sources.map((s, i) => {
        const lbl = cfg.srcLabel(s);
        return (
          <g
            key={`s-${i}`}
            onMouseEnter={() => setHoverSource(i)}
            onMouseLeave={() => setHoverSource(null)}
            style={{ cursor: "default" }}
          >
            <text
              x={lbl.x}
              y={lbl.y}
              textAnchor={lbl.anchor}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fill: srcActive(i) ? "#35405c" : LABEL,
                letterSpacing: "0.02em",
              }}
            >
              {s.label}
            </text>
            <circle cx={s.x} cy={s.y} r={4} fill={srcActive(i) ? LINE_ON : DOT} />
            <circle cx={s.x} cy={s.y} r={16} fill="transparent" pointerEvents="all" />
          </g>
        );
      })}

      {/* Pills (outcomes) */}
      {cfg.pills.map((p, j) => {
        const x = p.cx - p.w / 2;
        const y = p.cy - cfg.pillH / 2;
        const active = pillActive(j);
        return (
          <motion.g
            key={`p-${j}`}
            onMouseEnter={() => setHoverPill(j)}
            onMouseLeave={() => setHoverPill(null)}
            animate={{ scale: pop === j ? 1.04 : 1 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            style={{ transformBox: "fill-box", transformOrigin: "center", cursor: "default" }}
          >
            <rect
              x={x}
              y={y}
              width={p.w}
              height={cfg.pillH}
              rx={6}
              fill="#ffffff"
              stroke={active ? LINE_ON : LINE}
              strokeWidth={active ? 1.4 : 1}
              filter="url(#ls-pillshadow)"
              style={{ transition: "stroke 200ms ease" }}
            />
            <text
              x={x + 14}
              y={p.cy + 4}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fill: "#35405c",
                letterSpacing: "0.01em",
              }}
            >
              {p.label}
            </text>
            <text
              x={x + p.w - 14}
              y={p.cy + 4}
              textAnchor="end"
              aria-hidden
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                fill: "#0f62fe",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {counts[j]}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

export function SignalFlow() {
  return (
    <div className="w-full">
      <div className="hidden md:block">
        <Diagram cfg={DESKTOP} />
      </div>
      <div className="md:hidden">
        <Diagram cfg={MOBILE} />
      </div>
    </div>
  );
}
