"use client";

import React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// PixelWordmark — the footer statement wordmark (attempt 3). Adam: no fill, no
// tiles, no mosaic. OUTLINE-ONLY giant "LeaseStack" in a very light blue-gray
// hairline on white, with a slow, low-contrast SHIMMER: a soft highlight glint
// travels along the stroke left-to-right (~7s loop, Adam explicitly wants the
// loop). It should whisper.
//
// Mechanism (2026-08-15 rewrite): the original SMIL `animateTransform` on an
// objectBoundingBox gradient stroke froze on iOS — WebKit caches the gradient
// tile for stroked <text> and fails to invalidate it when only
// gradientTransform changes, so the glint rendered once and parked. Now the
// highlight outline is masked by a gradient-filled <rect> whose GEOMETRY
// framer-motion slides across the word each frame. Moving geometry (not a
// paint-server transform) invalidates correctly everywhere, and framer's
// rAF loop pauses in background tabs for free.
//
// The loop only runs while the footer is actually in view (useInView, same
// gating as pixel-seam.tsx) and the shimmer layer mounts client-side only:
// SSR ships just the static outline, so there is no hydration mismatch and
// reduced-motion users (checked post-mount, where it's accurate) simply
// never get the moving layer.
// ---------------------------------------------------------------------------

const VW = 1000;
const VH = 165;
const BAND_W = 280;

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
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduce = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const shimmer = mounted && !reduce;

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        role="img"
        aria-label="LeaseStack"
        style={{ display: "block", overflow: "hidden" }}
      >
        {shimmer ? (
          <defs>
            {/* Soft-edged band. The gradient is STATIC relative to the rect
                (objectBoundingBox); only the rect's x moves. */}
            <linearGradient id="ls-glint-band" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <mask
              id="ls-glint-mask"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={VW}
              height={VH}
            >
              <motion.rect
                y={0}
                width={BAND_W}
                height={VH}
                fill="url(#ls-glint-band)"
                initial={{ x: -BAND_W }}
                animate={inView ? { x: [-BAND_W, VW + 20] } : { x: -BAND_W }}
                transition={
                  inView
                    ? { duration: 7, repeat: Infinity, ease: "linear" }
                    : { duration: 0 }
                }
              />
            </mask>
          </defs>
        ) : null}

        {/* Base whisper outline — always rendered, including on the server. */}
        <text
          {...TEXT_PROPS}
          stroke="#c9d4ea"
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
        >
          LeaseStack
        </text>

        {/* Glint outline — visible only where the traveling band unmasks it. */}
        {shimmer ? (
          <text
            {...TEXT_PROPS}
            stroke="rgba(120, 150, 205, 0.85)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            mask="url(#ls-glint-mask)"
            aria-hidden="true"
          >
            LeaseStack
          </text>
        ) : null}
      </svg>
    </div>
  );
}
