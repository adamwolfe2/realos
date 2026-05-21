"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// GlyphSwirl — the 3×3 dot-grid glyphs from CapabilitiesRail ORBIT around
// the hero and PULSE in brand blue. This is the deliberate "swirl" Norman
// asked for (2026-05-21): the same glyph vocabulary users see later in the
// page (report, attribution, pixel, chat, alert, search) animated as a
// loose constellation around the hero copy + artifact.
//
// Rendering model:
//   - Each glyph rides a slow elliptical orbit around its anchor point
//     on an Archimedean spiral. Mix of clockwise + counter-clockwise so
//     the field reads as organic motion, not synchronized rotation.
//   - Per-glyph cell-alpha breathes on a sinusoid (the "pulse") so the
//     dots gently brighten and dim — 0.35–0.85 of the brand-blue alpha,
//     phased per-glyph so the field never flashes uniformly.
//   - Solid brand blue (#2563EB) with per-glyph opacity multiplier.
//     Far brighter than the previous 6% cap; this is now the primary
//     ambient signal on the hero, not a faint decoration.
//
// Accessibility:
//   - prefers-reduced-motion freezes the orbit + pulse at t=0 so the
//     final composition stays on-brand without any motion.
//   - aria-hidden, pointer-events none — never interactive.
// ---------------------------------------------------------------------------

const GLYPHS: number[][][] = [
  // The 6 patterns from CapabilityGlyph. Each is a 3×3 binary grid.
  [[1, 1, 1], [1, 0, 1], [1, 1, 1]], // report (frame)
  [[1, 0, 0], [1, 1, 0], [1, 1, 1]], // attribution (stairs)
  [[0, 1, 0], [1, 1, 1], [0, 1, 0]], // pixel (plus)
  [[1, 1, 1], [1, 1, 0], [0, 1, 0]], // chat (corner)
  [[0, 1, 0], [0, 1, 0], [0, 1, 0]], // alert (line)
  [[1, 1, 0], [1, 0, 1], [0, 1, 0]], // search (scatter)
];

// Tiny deterministic PRNG so SSR + client hydration match.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Placement = {
  /** Anchor position in %, relative to the container. */
  anchorLeft: number;
  anchorTop: number;
  /** Orbit radii (rx, ry), in %. Both small (3–9%) so the glyph
   *  drifts in a tight orbit instead of crossing the hero. */
  rx: number;
  ry: number;
  /** Angular speed, radians per ms. Negative = clockwise. */
  omega: number;
  /** Phase offset at t=0. */
  phase: number;
  /** Pulse phase offset so the field never breathes in unison. */
  pulsePhase: number;
  /** Rotation in degrees applied to the glyph itself. */
  rotate: number;
  /** Glyph index 0..5. */
  g: number;
  /** Cell size in CSS pixels. Final glyph footprint ≈ cell * 3 + gap * 2. */
  cell: number;
  /** Base opacity multiplier (per-glyph): 0.45–1.0. Edges fade further. */
  opacity: number;
};

const BRAND_BLUE = "37, 99, 235"; // #2563EB

export function GlyphSwirl({
  /** Multiplier on each glyph's final alpha. 1 = spec'd, 0 = invisible. */
  intensity = 1,
  /** Number of glyphs to scatter. 28 is plenty to read as a swirl
   *  without crowding the hero copy + artifact. */
  count = 28,
  /** Override the seed if you want a different deterministic layout. */
  seed = 20260520,
}: {
  intensity?: number;
  count?: number;
  seed?: number;
} = {}) {
  const reduce = useReducedMotion();

  // Layout the glyphs along an Archimedean spiral (same shape as the
  // previous static version) so the field anchors visually around the
  // hero. Each glyph then orbits a small ellipse around that anchor.
  const placements = useMemo<Placement[]>(() => {
    const rng = mulberry32(seed);
    const out: Placement[] = [];

    const turns = 3.2;
    const totalTheta = turns * 2 * Math.PI;
    const a = 4;
    const b = 4.6;

    for (let i = 0; i < count; i++) {
      const tNorm = i / (count - 1);
      const theta = totalTheta * tNorm;
      const r = a + b * theta;
      const cx = 50 + r * Math.cos(theta) * 1.3;
      const cy = 50 + r * Math.sin(theta);
      const jx = (rng() - 0.5) * 4.5;
      const jy = (rng() - 0.5) * 4.5;
      const anchorLeft = cx + jx;
      const anchorTop = cy + jy;
      if (
        anchorLeft < -10 ||
        anchorLeft > 110 ||
        anchorTop < -10 ||
        anchorTop > 110
      ) {
        continue;
      }

      const g = Math.floor(rng() * GLYPHS.length);
      const rotateChoices = [0, 0, 0, 90, 90, 180, 270, 15, -15];
      const rotate = rotateChoices[Math.floor(rng() * rotateChoices.length)];
      // Slightly bigger glyphs (4–7px cells) than the static version so
      // each one reads as an intentional mark when it pulses.
      const cell = 4 + Math.floor(rng() * 4);

      // Edge glyphs fade further so the centre reads as the focal point.
      const distFromCentre = Math.hypot(cx - 50, cy - 50) / 50;
      const baseOp = 0.55 + rng() * 0.45;
      const fadeOut = Math.max(0.35, 1 - distFromCentre * 0.55);
      const opacity = baseOp * fadeOut;

      // Norman 2026-05-21 second pass: "make them pulse more and move
      // less." Orbit radii dropped to a tiny wobble (0.6–2% of container)
      // so each glyph stays anchored to its spot with only a subtle drift
      // — the eye reads the field as a pulsing constellation, not
      // satellites in orbit. Periods also slowed so what little movement
      // remains feels meditative rather than busy.
      const inverse = rng() < 0.5;
      const rx = 0.6 + rng() * 1.4;
      const ry = 0.5 + rng() * 1.2;
      // Period 18–34s — very slow drift.
      const periodMs = 18000 + rng() * 16000;
      const omega = ((inverse ? -1 : 1) * (2 * Math.PI)) / periodMs;
      const phase = rng() * Math.PI * 2;
      const pulsePhase = rng() * Math.PI * 2;

      out.push({
        anchorLeft,
        anchorTop,
        rx,
        ry,
        omega,
        phase,
        pulsePhase,
        rotate,
        g,
        cell,
        opacity,
      });
    }
    return out;
  }, [count, seed]);

  // Single rAF clock that drives every glyph. We push the elapsed time
  // into CSS via a custom property + transform/opacity computed on each
  // glyph. To avoid React re-rendering 28 components 60×/sec we mutate
  // refs directly — same pattern the PixelSwirl canvas uses.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const glyphRefs = useRef<Array<HTMLDivElement | null>>([]);
  const innerRefs = useRef<Array<HTMLSpanElement[][]>>([]);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        const el = glyphRefs.current[i];
        if (!el) continue;
        const a = p.phase + p.omega * t;
        // Orbit offset in CSS pixels — convert from % via the parent
        // container width/height. We approximate by reading the parent
        // bounding box once per tick (cheap; one DOM read).
        const dx = Math.cos(a) * p.rx;
        const dy = Math.sin(a) * p.ry;
        el.style.transform = `translate(calc(-50% + ${dx}cqw), calc(-50% + ${dy}cqh)) rotate(${p.rotate}deg)`;

        // Pulse — single sinusoid drives the cell alpha for all 9 cells.
        // Norman second pass: more pulse, less motion. Range 0.05 → 1.05
        // (clamped 0–1) so glyphs fade nearly to invisible at the trough
        // and snap to full brand-blue at the peak. Period ~1.9s for a
        // brisker heartbeat now that there's almost no orbit competing
        // for attention.
        const pulse = 0.55 + 0.5 * Math.sin(t / 1900 + p.pulsePhase);
        const alpha = Math.max(0, Math.min(1, p.opacity * intensity * pulse));
        const fill = `rgba(${BRAND_BLUE}, ${alpha.toFixed(3)})`;
        const cells = innerRefs.current[i];
        if (cells) {
          for (const cell of cells.flat()) {
            cell.style.backgroundColor = cell.dataset.on === "1" ? fill : "transparent";
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [placements, intensity, reduce]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        // Container queries — `cqw` / `cqh` units below resolve against
        // this element so orbit radii expressed as % of container width
        // translate cleanly to pixel offsets via translate().
        containerType: "size",
      }}
    >
      {placements.map((p, i) => (
        <Glyph
          key={i}
          p={p}
          intensity={intensity}
          reduce={reduce ?? false}
          glyphRef={(el) => {
            glyphRefs.current[i] = el;
          }}
          cellsRef={(cells) => {
            innerRefs.current[i] = cells;
          }}
        />
      ))}
    </div>
  );
}

function Glyph({
  p,
  intensity,
  reduce,
  glyphRef,
  cellsRef,
}: {
  p: Placement;
  intensity: number;
  reduce: boolean;
  glyphRef: (el: HTMLDivElement | null) => void;
  cellsRef: (cells: HTMLSpanElement[][]) => void;
}) {
  const grid = GLYPHS[p.g];
  const gap = Math.max(1, Math.round(p.cell / 2.5));
  const sidePx = p.cell * 3 + gap * 2;

  // Static fallback alpha when reduced-motion is set — render the
  // composition at peak brightness so the field still reads as
  // intentional without any animation.
  const staticAlpha = (p.opacity * intensity * 0.85).toFixed(3);
  const staticFill = `rgba(${BRAND_BLUE}, ${staticAlpha})`;

  const rowsRef = useRef<HTMLSpanElement[][]>([]);

  return (
    <div
      ref={glyphRef}
      style={{
        position: "absolute",
        left: `${p.anchorLeft}%`,
        top: `${p.anchorTop}%`,
        width: sidePx,
        height: sidePx,
        transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
        display: "grid",
        gridTemplateColumns: `repeat(3, ${p.cell}px)`,
        gridTemplateRows: `repeat(3, ${p.cell}px)`,
        gap: `${gap}px`,
        // Subtle drop-shadow on the brand-blue cells makes them feel
        // crisper against the white hero without needing a glow effect.
        filter: "drop-shadow(0 1px 2px rgba(37, 99, 235, 0.12))",
        willChange: "transform",
      }}
    >
      {grid.map((row, r) =>
        row.map((on, c) => (
          <span
            key={`${r}-${c}`}
            ref={(el) => {
              if (!rowsRef.current[r]) rowsRef.current[r] = [];
              if (el) {
                rowsRef.current[r][c] = el;
                // Once all 9 cells have rendered, hand the matrix to the
                // parent so the rAF loop can mutate alpha directly.
                if (rowsRef.current.flat().filter(Boolean).length === 9) {
                  cellsRef(rowsRef.current);
                }
              }
            }}
            data-on={on ? "1" : "0"}
            style={{
              width: p.cell,
              height: p.cell,
              backgroundColor: reduce
                ? on
                  ? staticFill
                  : "transparent"
                : on
                  ? `rgba(${BRAND_BLUE}, 0.45)` // initial, overwritten by RAF
                  : "transparent",
              // Tiny radius so the cells read as crisp pixel marks
              // rather than soft circles.
              borderRadius: 1,
            }}
          />
        )),
      )}
    </div>
  );
}
