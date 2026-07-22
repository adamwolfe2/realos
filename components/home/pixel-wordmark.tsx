"use client";

import React from "react";
import { useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// PixelWordmark — the footer statement wordmark (attempt 3). Adam: no fill, no
// tiles, no mosaic. OUTLINE-ONLY giant "LeaseStack" in a very light blue-gray
// hairline on white, with a slow, low-contrast SHIMMER: a soft highlight glint
// travels along the stroke left-to-right (~7s loop, Adam explicitly wants the
// loop). It should whisper.
//
// The glint is an animated gradient stroke: a base hairline outline plus an
// overlaid outline whose stroke is a moving linear gradient (transparent ->
// brighter -> transparent), translated across via SMIL. Non-scaling stroke
// keeps the hairline crisp at any width; SVG scales to width (zero overflow).
// Reduced-motion: static outline only, no shimmer.
// ---------------------------------------------------------------------------

const VW = 1000;
const VH = 165;

const TEXT_PROPS = {
  x: VW / 2,
  y: 132,
  textAnchor: "middle" as const,
  fill: "none",
  style: {
    fontFamily: "var(--font-display)",
    fontSize: 150,
    fontWeight: 700,
    letterSpacing: "-0.04em",
  },
};

export function PixelWordmark() {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%"
      role="img"
      aria-label="LeaseStack"
      style={{ display: "block", overflow: "hidden" }}
    >
      <defs>
        {/* A narrow bright band that slides across, transparent elsewhere. */}
        <linearGradient
          id="ls-shimmer"
          gradientUnits="objectBoundingBox"
          x1="0"
          y1="0"
          x2="0.28"
          y2="0"
        >
          <stop offset="0" stopColor="rgba(148,173,214,0)" />
          <stop offset="0.5" stopColor="rgba(120,150,205,0.85)" />
          <stop offset="1" stopColor="rgba(148,173,214,0)" />
          {!reduce ? (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-0.35 0"
              to="1.05 0"
              dur="7s"
              repeatCount="indefinite"
            />
          ) : null}
        </linearGradient>
      </defs>

      {/* Base whisper outline. */}
      <text
        {...TEXT_PROPS}
        stroke="#c9d4ea"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      >
        LeaseStack
      </text>

      {/* Shimmer outline — only the moving band is visible. */}
      {!reduce ? (
        <text
          {...TEXT_PROPS}
          stroke="url(#ls-shimmer)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        >
          LeaseStack
        </text>
      ) : null}
    </svg>
  );
}
