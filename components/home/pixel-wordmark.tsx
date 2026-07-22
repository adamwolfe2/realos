"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// PixelWordmark — the footer's pixel wordmark (mobile-pass footer redo).
// Adam: the old two-tone checkerboard read like a quilt. This is a FINE
// mosaic grain (~10px tiles, 1px gaps) so the letters read as type first,
// pixels second: a mostly-solid brand-blue fill with subtle, deterministic
// tonal variation. Rendered as an SVG <pattern> (not thousands of DOM rects),
// revealed once with a left-to-right mask wipe on scroll, then a single
// signal-pulse sweep. Light theme; SVG scales to width, zero overflow.
// ---------------------------------------------------------------------------

const VW = 1000;
const VH = 165;
const TILE = 10; // 9px fill + 1px gap = fine grain

function frac(n: number): number {
  return n - Math.floor(n);
}

// Deterministic per-cell tone: ~20% of tiles get a subtly different blue so
// the fill reads as premium texture, never a repeating pattern.
function tileColor(tx: number, ty: number): string {
  const h = frac(Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453);
  if (h < 0.05) return "#dbe7ff";
  if (h < 0.13) return "#2d79ff";
  if (h < 0.2) return "#0043ce";
  return "#0f62fe";
}

// 5x5 pattern cell (50x50 user units) of 10px tiles.
const CELL: Array<{ x: number; y: number; fill: string }> = (() => {
  const out: Array<{ x: number; y: number; fill: string }> = [];
  for (let ty = 0; ty < 5; ty++) {
    for (let tx = 0; tx < 5; tx++) {
      out.push({ x: tx * TILE, y: ty * TILE, fill: tileColor(tx, ty) });
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
            y={132}
            textAnchor="middle"
            fill="#ffffff"
            style={{ fontFamily: "var(--font-display)", fontSize: 150, fontWeight: 700, letterSpacing: "-0.04em" }}
          >
            LeaseStack
          </text>
        </mask>

        <pattern id="ls-mosaic" width="50" height="50" patternUnits="userSpaceOnUse">
          {/* Gap/grid colour: a hair darker than brand so the 1px seams read. */}
          <rect width="50" height="50" fill="#0a4fc8" />
          {CELL.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width="9" height="9" fill={c.fill} />
          ))}
        </pattern>

        <linearGradient id="ls-wordsweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Mosaic fill, masked to the wordmark, revealed left-to-right once. */}
      <motion.g
        initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: on ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
        transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.2, 0.8, 0.3, 1] }}
      >
        <rect x="0" y="0" width={VW} height={VH} fill="url(#ls-mosaic)" mask="url(#ls-wordmask)" />
      </motion.g>

      {/* One signal-pulse sweep after the reveal (masked to the letters). */}
      {on && !reduce ? (
        <g mask="url(#ls-wordmask)">
          <rect className="mk-wordsweep" x={-VW * 0.35} y="0" width={VW * 0.35} height={VH} fill="url(#ls-wordsweep)" />
        </g>
      ) : null}
    </svg>
  );
}
