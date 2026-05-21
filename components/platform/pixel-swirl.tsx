"use client";

import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// PixelSwirl — animated brand-blue pixel field rendered behind the hero.
//
// Design call-out (Norman feedback, 2026-05-21): the platform already
// uses small, square brand-blue pixel marks as glyphs (DeliverableIcon /
// integration tiles). PixelSwirl turns that signal into an ambient
// background that ties the marketing surface to the in-app iconography
// without leaning on a stock library.
//
// Rendering model:
//   - Canvas2D, devicePixelRatio-aware, painted at 60fps.
//   - ~ 70 single-pixel "motes", each on a long elliptical drift orbit
//     around the centre of the viewport. Each mote has its own period,
//     phase offset, and ellipse axes so the field looks organic and
//     never repeats exactly.
//   - Motes fade in/out on a sinusoid so they breathe; size jitters by
//     ±1px to read as pixel-art rather than smooth motion.
//   - All paint stays inside the parent's bounding box; the canvas is
//     positioned absolute and pointer-events: none so it never blocks
//     CTA clicks.
//
// Accessibility:
//   - prefers-reduced-motion fully halts the RAF loop and renders the
//     final static frame. No flash, no flicker.
// ---------------------------------------------------------------------------

type Mote = {
  /** Centre of the elliptical orbit, in fractions of canvas width/height. */
  cx: number;
  cy: number;
  /** Orbit radii (rx, ry), in fractions of canvas width/height. */
  rx: number;
  ry: number;
  /** Angular speed, radians per ms. Negative = clockwise. */
  omega: number;
  /** Phase offset at t=0. */
  phase: number;
  /** Base size, in CSS pixels. Final size jitters ±1. */
  size: number;
  /** Base opacity. Final opacity sinusoidally breathes ±0.25. */
  opacity: number;
  /** Whether the mote tracks the inverse of the swirl (counter-spin). */
  inverse: boolean;
};

const BRAND_BLUE = "37, 99, 235"; // #2563EB in rgb()
// Norman feedback (2026-05-21 hero screenshot): "I do not see the pixel
// swirls in the hero background." The previous 72-mote / 0.18–0.73-opacity
// field was technically firing but read as plain white at the resolutions
// Norman reviews on. Doubled the count and lifted the opacity floor so the
// swirl is unambiguously visible without losing the calm centre.
const MOTE_COUNT = 160;

function makeMote(rng: () => number): Mote {
  const inverse = rng() < 0.35;
  return {
    cx: 0.5 + (rng() - 0.5) * 0.2,
    cy: 0.5 + (rng() - 0.5) * 0.2,
    // Wide radii — most motes orbit far enough out that the eye reads
    // the field as a single swirl with the hero copy at the calm centre.
    rx: 0.18 + rng() * 0.45,
    ry: 0.12 + rng() * 0.35,
    // Slow base rotation. Period 14–32s.
    omega: ((inverse ? -1 : 1) * (2 * Math.PI)) / (14000 + rng() * 18000),
    phase: rng() * Math.PI * 2,
    // Mix of 2 / 3 / 4-pixel motes so the field has visual depth and the
    // larger ones read first when the eye lands on the hero.
    size: rng() < 0.12 ? 4 : rng() < 0.42 ? 3 : 2,
    // Lifted floor (0.42 vs prior 0.18) so even the dimmest motes register
    // against #FFFFFF. Top end pushed to ~0.95 so the brightest pixels read
    // as crisp brand-blue dots, not faint suggestions.
    opacity: 0.42 + rng() * 0.55,
    inverse,
  };
}

// Tiny deterministic PRNG so SSR + client first paint match.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function PixelSwirl({
  className,
  intensity = 1,
  /**
   * When true (default), renders an additional faint grid overlay so the
   * pixel field feels "snapped to grid" rather than floating. Disable for
   * surfaces that already supply their own grid background.
   */
  grid = true,
}: {
  className?: string;
  intensity?: number;
  grid?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const motesRef = useRef<Mote[] | null>(null);
  const rafRef = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rng = mulberry32(20260520);
    motesRef.current = Array.from({ length: MOTE_COUNT }, () => makeMote(rng));

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let widthCss = 0;
    let heightCss = 0;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      widthCss = rect.width;
      heightCss = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(widthCss * dpr));
      canvas.height = Math.max(1, Math.floor(heightCss * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize);
      ro.observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    const start = performance.now();
    const paint = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, widthCss, heightCss);
      const motes = motesRef.current ?? [];
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        const a = m.phase + m.omega * t;
        const x = (m.cx + Math.cos(a) * m.rx) * widthCss;
        const y = (m.cy + Math.sin(a) * m.ry) * heightCss;
        // Breathe opacity on a slower sinusoid so the field gently
        // pulses without any hard transitions.
        const breathe =
          m.opacity *
          intensity *
          (0.75 + 0.25 * Math.sin(t / 2200 + m.phase));
        ctx.fillStyle = `rgba(${BRAND_BLUE}, ${Math.max(0, Math.min(1, breathe)).toFixed(3)})`;
        // Snap to integer coords so each mote reads as a crisp pixel
        // rather than an anti-aliased blob.
        ctx.fillRect(Math.round(x), Math.round(y), m.size, m.size);
      }
      rafRef.current = requestAnimationFrame(paint);
    };

    if (reduce) {
      // One static frame — the motes still land in their t=0 positions
      // so the visual stays on-brand without motion.
      paint(0);
    } else {
      rafRef.current = requestAnimationFrame(paint);
    }

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
    };
  }, [reduce, intensity]);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Gradient base — pale brand wash from top-right to bottom-left,
          fading to white at the bottom so the hero copy stays legible. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 70% at 75% 0%, rgba(37,99,235,0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 10% 100%, rgba(37,99,235,0.10), transparent 65%), linear-gradient(180deg, #F4F7FF 0%, #FFFFFF 75%)",
        }}
      />
      {/* Pixel-grid wash — square 28px grid with a faint brand-blue tint
          on the lines, masked to fade out at the bottom so it never
          competes with the trust-strip band. */}
      {grid ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(0deg, rgba(37,99,235,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.11) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            backgroundPosition: "center top",
            // Wider mask radius + softer falloff so the grid stays visible
            // edge-to-edge instead of dying inside a tight oval.
            WebkitMaskImage:
              "radial-gradient(ellipse 110% 95% at 50% 45%, #000 75%, transparent 100%)",
            maskImage:
              "radial-gradient(ellipse 110% 95% at 50% 45%, #000 75%, transparent 100%)",
          }}
        />
      ) : null}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}
