"use client";

import React, { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// PixelSeam — textured section transition (cool pass M4 + motion pass sec 6).
// A belt of small squares in the NEXT section's background colour, scattered
// with a deterministic density gradient (dense at the bottom edge, dissolving
// upward). On-brand: LeaseStack's product is the Visitor Pixel. Squares
// twinkle in with a left-to-right staggered opacity cascade once in view,
// then hold. Reduced-motion renders them static.
//
// Placed at exactly three seams (hero -> system, tabs -> report, faq -> cta).
// ---------------------------------------------------------------------------

const COLS = 44;
const ROWS = 6;
const SQUARE = 8;

// Deterministic hash so server and client render identical scatter (no
// hydration mismatch, no Math.random).
function hash(c: number, r: number): number {
  const s = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

type Cell = { col: number; row: number };

const CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    // Density rises toward the bottom row (dense base, sparse top). Kept
    // deliberately low (~40% lighter than before) so seams read as a subtle
    // texture, not glitch/noise (punch-list item 10).
    const density = 0.07 + (r / (ROWS - 1)) * 0.47;
    for (let c = 0; c < COLS; c++) {
      if (hash(c, r) < density) out.push({ col: c, row: r });
    }
  }
  return out;
})();

export function PixelSeam({
  color,
  height = 60,
}: {
  /** The next section's background colour (the squares dissolve into it). */
  color: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  return (
    <div
      ref={ref}
      aria-hidden
      className="relative w-full overflow-hidden"
      style={{ height }}
    >
      {CELLS.map(({ col, row }) => {
        const delayMs = (col / COLS) * 240 + hash(row, col) * 60;
        return (
          <span
            key={`${col}-${row}`}
            className="absolute"
            style={{
              left: `${(col / COLS) * 100}%`,
              top: `${(row / (ROWS - 1)) * (height - SQUARE)}px`,
              width: SQUARE,
              height: SQUARE,
              backgroundColor: color,
              opacity: on ? 0.55 : 0,
              transition: reduce
                ? "none"
                : `opacity 300ms ease ${delayMs}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
