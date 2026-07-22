"use client";

import React, { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// PixelWordmark — the footer's pixel-assembly moment (mobile-pass footer item).
// A field of small brand-blue / light-blue square tiles, masked to the shape
// of the "LeaseStack" wordmark, assembles (staggered scale + fade) when the
// footer scrolls into view, then a single signal-pulse sweeps the letters once
// and everything holds static. On-brand with the Visitor Pixel motif.
//
// Deterministic tile delays (hashed from grid index, no Math.random at module
// scope). Reduced-motion: fully assembled, no pulse. The SVG scales to the
// container width (width:100%), so it never overflows on mobile.
// ---------------------------------------------------------------------------

const VW = 1000;
const VH = 205;
const STEP = 23; // tile 20 + gap 3
const TILE = 20;

function hash(c: number, r: number): number {
  const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

type Tile = { x: number; y: number; delay: number; brand: boolean };

const TILES: Tile[] = (() => {
  const out: Tile[] = [];
  const cols = Math.floor(VW / STEP);
  const rows = Math.floor(VH / STEP);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: c * STEP + 1,
        y: r * STEP + 1,
        delay: Math.round(hash(c, r) * 820),
        brand: (c + r) % 2 === 0,
      });
    }
  }
  return out;
})();

export function PixelWordmark() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%"
      role="img"
      aria-label="LeaseStack"
      style={{ display: "block", overflow: "hidden" }}
    >
      <defs>
        <mask id="ls-wordmask">
          <rect x="0" y="0" width={VW} height={VH} fill="black" />
          <text
            x={VW / 2}
            y={165}
            textAnchor="middle"
            fill="#ffffff"
            style={{ fontFamily: "var(--font-display)", fontSize: 190, fontWeight: 700, letterSpacing: "-0.04em" }}
          >
            LeaseStack
          </text>
        </mask>
        <linearGradient id="ls-wordsweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(15,98,254,0)" />
          <stop offset="50%" stopColor="rgba(15,98,254,0.55)" />
          <stop offset="100%" stopColor="rgba(15,98,254,0)" />
        </linearGradient>
      </defs>

      <g mask="url(#ls-wordmask)">
        {/* Assembling square tiles. */}
        {TILES.map((t, i) => (
          <rect
            key={i}
            x={t.x}
            y={t.y}
            width={TILE}
            height={TILE}
            rx={1}
            fill={t.brand ? "#0f62fe" : "#a6c8ff"}
            style={{
              opacity: on ? 1 : 0,
              transformBox: "fill-box",
              transformOrigin: "center",
              transform: on ? "scale(1)" : "scale(0.2)",
              transition: reduce
                ? "none"
                : `opacity 450ms ease ${t.delay}ms, transform 600ms cubic-bezier(0.2,0.8,0.3,1) ${t.delay}ms`,
            }}
          />
        ))}

        {/* One signal-pulse sweep after assembly (masked to the letters). */}
        {on && !reduce ? (
          <rect
            className="mk-wordsweep"
            x={-VW * 0.35}
            y="0"
            width={VW * 0.35}
            height={VH}
            fill="url(#ls-wordsweep)"
          />
        ) : null}
      </g>

      {/* Crisp outline over the tiles. */}
      <text
        x={VW / 2}
        y={165}
        textAnchor="middle"
        fill="none"
        stroke="#c9d4ea"
        strokeWidth={0.75}
        style={{ fontFamily: "var(--font-display)", fontSize: 190, fontWeight: 700, letterSpacing: "-0.04em" }}
      >
        LeaseStack
      </text>
    </svg>
  );
}
