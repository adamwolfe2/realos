"use client";

import React, { useMemo } from "react";

// ---------------------------------------------------------------------------
// GlyphSwirl — VERY LIGHT background of 3x3 dot-grid glyphs scattered along
// a gentle swirl curve across the hero. Layered ON TOP of PixelSwirl's
// gradient + grid wash + animated motes, so the hero now reads as:
//
//   gradient base
//   + 28px brand grid
//   + ~72 single-pixel motes drifting on elliptical paths (PixelSwirl)
//   + ~36 dot-grid GLYPHS placed along an Archimedean spiral (GlyphSwirl) ← new
//
// The glyphs use the exact same 6 shapes that appear in the
// CapabilitiesRail scroll section (3x3 binary patterns rendered as
// 4x4px cells with 1.5px gaps), so the hero background quietly echoes
// the iconography users see again later in the page.
//
// Design rules per Adam's spec:
//   - VERY LIGHT (≤6% opacity at full brand blue, dropping to 2% at edges)
//   - NOT DISTRACTING — purely static, no animation, no flicker
//   - Snaps to the underlying 28px grid so the field reads as "designed"
//     rather than "random scatter"
//
// Accessibility:
//   - aria-hidden, pointer-events none, no animation → reduced-motion irrelevant.
// ---------------------------------------------------------------------------

const GLYPHS: number[][][] = [
  // The 6 patterns from CapabilityGlyph. Each is a 3x3 binary grid.
  [[1, 1, 1], [1, 0, 1], [1, 1, 1]], // report (frame)
  [[1, 0, 0], [1, 1, 0], [1, 1, 1]], // attribution (stairs)
  [[0, 1, 0], [1, 1, 1], [0, 1, 0]], // pixel (plus)
  [[1, 1, 1], [1, 1, 0], [0, 1, 0]], // chat (corner)
  [[0, 1, 0], [0, 1, 0], [0, 1, 0]], // alert (line)
  [[1, 1, 0], [1, 0, 1], [0, 1, 0]], // search (scatter)
];

// Tiny deterministic PRNG so SSR and client first paint match exactly.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Placement = {
  /** Position in %, relative to the container. */
  left: number;
  top: number;
  /** Rotation in degrees. */
  rotate: number;
  /** Glyph index 0..5. */
  g: number;
  /** Cell size in CSS pixels. Glyph total size ≈ cell * 3 + gap * 2. */
  cell: number;
  /** Per-glyph opacity multiplier (0..1). */
  opacity: number;
};

export function GlyphSwirl({
  /**
   * Multiplier on each glyph's final opacity. 1 = spec'd (≤6% RGB), 0 = invisible.
   * Useful if a section wants the swirl even fainter.
   */
  intensity = 1,
  /** Number of glyphs to scatter. Default 36 is plenty without crowding the hero. */
  count = 36,
  /** Override the seed if you want a different deterministic layout. */
  seed = 20260520,
}: {
  intensity?: number;
  count?: number;
  seed?: number;
} = {}) {
  // Compute placements once. useMemo keeps them stable across re-renders.
  const placements = useMemo<Placement[]>(() => {
    const rng = mulberry32(seed);
    const out: Placement[] = [];

    // Archimedean spiral: r = a + b * theta. We sweep theta over multiple
    // turns and sample at increasing intervals so the outer arms are denser.
    // The hero is wider than tall, so we scale x by 1.3 to match.
    const turns = 3.2;
    const totalTheta = turns * 2 * Math.PI;
    const a = 4;
    const b = 4.6;

    for (let i = 0; i < count; i++) {
      const tNorm = i / (count - 1); // 0..1
      const theta = totalTheta * tNorm;
      const r = a + b * theta;
      // Polar → cartesian, recentred to 50/50 with a slight x-stretch.
      const cx = 50 + r * Math.cos(theta) * 1.3;
      const cy = 50 + r * Math.sin(theta);
      // Jitter so the spiral doesn't read as a mathematical curve.
      const jx = (rng() - 0.5) * 4.5;
      const jy = (rng() - 0.5) * 4.5;
      // Snap to a 28px grid by rounding to multiples of 2% — this keeps the
      // glyphs reading as "snapped to the brand grid" rather than free-floating.
      const left = Math.round((cx + jx) / 2) * 2;
      const top = Math.round((cy + jy) / 2) * 2;
      // Bail if a placement drifted off-canvas; spiral arms can stretch past 100%.
      if (left < -8 || left > 108 || top < -8 || top > 108) continue;

      const g = Math.floor(rng() * GLYPHS.length);
      // Most glyphs read at the canonical 0/90/180/270; a few tilt slightly
      // off-axis to feel hand-placed.
      const rotateChoices = [0, 0, 0, 90, 90, 180, 270, 15, -15];
      const rotate = rotateChoices[Math.floor(rng() * rotateChoices.length)];
      // Cell size varies 3px–6px so the field has visual depth.
      const cell = 3 + Math.floor(rng() * 4);
      // Edge glyphs fade further so the centre reads as the focal point.
      const distFromCentre = Math.hypot(cx - 50, cy - 50) / 50;
      const baseOp = 0.6 + rng() * 0.4; // 0.6..1.0 of the base spec
      const fadeOut = Math.max(0.25, 1 - distFromCentre * 0.6);
      const opacity = baseOp * fadeOut;

      out.push({ left, top, rotate, g, cell, opacity });
    }
    return out;
  }, [count, seed]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {placements.map((p, i) => (
        <Glyph key={i} p={p} intensity={intensity} />
      ))}
    </div>
  );
}

function Glyph({ p, intensity }: { p: Placement; intensity: number }) {
  const grid = GLYPHS[p.g];
  // Norman feedback (2026-05-21): glyphs were invisible against white at
  // the previous 6% cap. Lifted to 14% so the spiral reads as a deliberate
  // pattern from a normal viewing distance, while still staying well below
  // the hero copy and CTAs in the visual hierarchy.
  const baseAlpha = 0.14 * p.opacity * intensity;
  const fill = `rgba(37, 99, 235, ${baseAlpha.toFixed(4)})`;

  const gap = Math.max(1, Math.round(p.cell / 2.5));
  const sidePx = p.cell * 3 + gap * 2;

  return (
    <div
      style={{
        position: "absolute",
        left: `${p.left}%`,
        top: `${p.top}%`,
        width: sidePx,
        height: sidePx,
        transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
        display: "grid",
        gridTemplateColumns: `repeat(3, ${p.cell}px)`,
        gridTemplateRows: `repeat(3, ${p.cell}px)`,
        gap: `${gap}px`,
      }}
    >
      {grid.flat().map((on, i) => (
        <span
          key={i}
          style={{
            width: p.cell,
            height: p.cell,
            backgroundColor: on ? fill : "transparent",
          }}
        />
      ))}
    </div>
  );
}
