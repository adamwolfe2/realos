"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// SEOTrendChart — Norman feedback 2026-05-21: the SEO surface needed
// a graph "that should move and have floating stats & modals popping
// up on different pages to make it feel 3D" (like the purple Cluely
// reference). Strictly brand-blue, no purple.
//
// Composition (back-to-front):
//   1. Soft brand-blue grid + radial wash background.
//   2. Animated SVG area chart — 90-day organic-sessions trend, ramp
//      shape (slow start, steeper in the middle, plateauing at the
//      top). The line draws in left-to-right; the area fill fades up
//      under it; the most-recent point pulses.
//   3. Three floating "modal" cards anchored to milestone points on
//      the line — they pop in on stagger with a subtle perspective
//      tilt that gives the surface depth without needing a 3D engine.
//
// Used as a hero artifact on the SEO feature page (and any other
// surface that wants the same kinetic SEO story).
// ---------------------------------------------------------------------------

const ACCENT = "#2563EB";
const ACCENT_DEEP = "#1E40AF";

// 90-day series — 13 weekly samples. Values are organic sessions /
// week, shaped to read as "slow start, steeper acquisition, plateau
// at the top" — the canonical SEO ramp story.
const SERIES = [
  120, 145, 180, 240, 310, 410, 540, 680, 820, 980, 1140, 1280, 1380,
];

// SVG viewport. The chart is rendered at its native 800×360 size and
// scaled by the parent via CSS so it never blurs.
const W = 800;
const H = 360;
const PAD = { top: 40, right: 28, bottom: 36, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function xAt(i: number): number {
  return PAD.left + (i / (SERIES.length - 1)) * PLOT_W;
}
function yAt(v: number): number {
  const max = Math.max(...SERIES);
  return PAD.top + (1 - v / max) * PLOT_H;
}

// Build the line path (smooth catmull-rom-ish via quadratic
// midpoints). Anchor + control through each midpoint so the curve
// reads as continuous without a JS lib.
function buildPath(close: boolean): string {
  const pts = SERIES.map((v, i) => [xAt(i), yAt(v)] as const);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    d += ` Q ${x1} ${y1} ${mx} ${my}`;
  }
  d += ` T ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  if (close) {
    d += ` L ${xAt(SERIES.length - 1)} ${H - PAD.bottom} L ${xAt(0)} ${H - PAD.bottom} Z`;
  }
  return d;
}

// Floating stat cards anchored to specific weeks in the series. Each
// is positioned as a fraction of the chart's WIDTH so the layout
// scales cleanly when the SVG resizes.
type FloatingStat = {
  /** Index into SERIES — the week the stat "anchors" to. */
  week: number;
  /** Where the card sits relative to the anchor point. */
  side: "above" | "below";
  /** Mono label (top line). */
  eyebrow: string;
  /** Big headline (the actual stat). */
  value: string;
  /** Small body sub-line. */
  hint: string;
  /** Reveal delay, ms — staggers the three cards so they pop in one at a time. */
  delayMs: number;
};

const FLOATING_STATS: FloatingStat[] = [
  {
    week: 3,
    side: "above",
    eyebrow: "WEEK 3",
    value: "Ranked #4",
    hint: "for \"student housing near campus\"",
    delayMs: 900,
  },
  {
    week: 7,
    side: "below",
    eyebrow: "WEEK 7",
    value: "ChatGPT cited 12×",
    hint: "across 9 different prompts",
    delayMs: 1400,
  },
  {
    week: 11,
    side: "above",
    eyebrow: "WEEK 11",
    value: "+3,200 sessions/mo",
    hint: "organic, all attributed to your /n/ pages",
    delayMs: 1900,
  },
];

export function SEOTrendChart() {
  const reduce = useReducedMotion();
  const linePath = buildPath(false);
  const areaPath = buildPath(true);
  const lastX = xAt(SERIES.length - 1);
  const lastY = yAt(SERIES[SERIES.length - 1]);

  return (
    <div
      className="relative w-full"
      style={{
        // Subtle 3D-ish perspective tilt for the whole frame.
        // Norman flagged the purple reference for the depth feel;
        // a small rotateX + brand-blue glow ground-plane produces
        // the same lift without going full webGL.
        perspective: "1400px",
      }}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, rotateX: 6, y: 24 }}
        whileInView={reduce ? undefined : { opacity: 1, rotateX: 2, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#FFFFFF",
          // Soft brand-blue grid + radial wash to create the "lifted
          // panel" feel without a hard border.
          backgroundImage:
            "radial-gradient(circle at 30% 0%, rgba(37,99,235,0.06), transparent 60%), linear-gradient(0deg, rgba(37,99,235,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px)",
          backgroundSize: "auto, 40px 40px, 40px 40px",
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.04), 0 18px 48px rgba(37,99,235,0.12)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Header */}
        <header
          className="flex items-baseline justify-between gap-3 px-6 py-5"
          style={{ borderBottom: "1px solid rgba(37,99,235,0.08)" }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: "#94A3B8",
              }}
            >
              Organic + AI discovery · last 90 days
            </p>
            <h3
              className="mt-1.5"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.022em",
                color: "#1E2A3A",
              }}
            >
              SEO ramp
            </h3>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{
              backgroundColor: "rgba(37,99,235,0.08)",
              color: ACCENT,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              fontWeight: 600,
            }}
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ACCENT }}
            />
            +1,150% INDEXED
          </span>
        </header>

        {/* Chart */}
        <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            aria-label="SEO sessions over 90 days, ramp shape"
            role="img"
          >
            <defs>
              <linearGradient id="seoArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.32" />
                <stop offset="60%" stopColor={ACCENT} stopOpacity="0.12" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="seoLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={ACCENT} />
                <stop offset="100%" stopColor={ACCENT_DEEP} />
              </linearGradient>
            </defs>

            {/* Horizontal hairlines */}
            {[0.25, 0.5, 0.75].map((t) => {
              const y = PAD.top + t * PLOT_H;
              return (
                <line
                  key={t}
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  stroke="rgba(15,23,42,0.05)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Area fill — fades in after the line draws */}
            <motion.path
              d={areaPath}
              fill="url(#seoArea)"
              initial={reduce ? false : { opacity: 0 }}
              whileInView={reduce ? undefined : { opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.1, delay: 0.85, ease: "easeOut" }}
            />

            {/* Line draws in left → right */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="url(#seoLine)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              whileInView={reduce ? undefined : { pathLength: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Most-recent point pulse */}
            {!reduce ? (
              <>
                <motion.circle
                  cx={lastX}
                  cy={lastY}
                  r={6}
                  fill={ACCENT}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.4, delay: 1.5 }}
                />
                <motion.circle
                  cx={lastX}
                  cy={lastY}
                  r={6}
                  fill={ACCENT}
                  initial={{ scale: 1, opacity: 0.5 }}
                  whileInView={{ scale: 3, opacity: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{
                    duration: 1.6,
                    delay: 1.6,
                    repeat: Infinity,
                    repeatDelay: 0.6,
                    ease: "easeOut",
                  }}
                />
              </>
            ) : (
              <circle cx={lastX} cy={lastY} r={6} fill={ACCENT} />
            )}
          </svg>

          {/* Floating modal callouts — overlay positioned in % so they
              follow the chart on resize. Each card has a faint
              connector line from its corner to the anchor point on
              the curve, plus a subtle perspective transform to read
              as "lifted off the surface". */}
          {FLOATING_STATS.map((s) => (
            <FloatingCard key={s.eyebrow} stat={s} reduce={reduce} />
          ))}
        </div>

        {/* Footer */}
        <footer
          className="px-6 py-3 flex items-center justify-between gap-3"
          style={{
            borderTop: "1px solid rgba(37,99,235,0.08)",
            backgroundColor: "#FAFBFF",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
              color: "#94A3B8",
            }}
          >
            Sessions · attributed to /n/ pages
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.10em",
              fontWeight: 600,
              color: ACCENT,
            }}
          >
            ↗ See full report
          </span>
        </footer>
      </motion.div>
    </div>
  );
}

function FloatingCard({
  stat,
  reduce,
}: {
  stat: FloatingStat;
  reduce: boolean | null;
}) {
  const xPct = (stat.week / (SERIES.length - 1)) * 100;
  const yPct = (yAt(SERIES[stat.week]) / H) * 100;
  const offsetY = stat.side === "above" ? -28 : 10;
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: `translate(-50%, ${stat.side === "above" ? "-100%" : "0"})`,
        marginTop: offsetY,
        zIndex: 2,
        transformStyle: "preserve-3d",
      }}
      initial={reduce ? false : { opacity: 0, y: stat.side === "above" ? 8 : -8, scale: 0.92, rotateX: 6 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{
        duration: 0.7,
        delay: stat.delayMs / 1000,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div
        className="rounded-xl px-3.5 py-2.5 bg-white"
        style={{
          boxShadow:
            "0 4px 12px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.05), 0 0 0 1px rgba(37,99,235,0.12)",
          minWidth: 168,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: ACCENT,
          }}
        >
          {stat.eyebrow}
        </p>
        <p
          className="mt-0.5"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.012em",
            color: "#1E2A3A",
            lineHeight: 1.2,
          }}
        >
          {stat.value}
        </p>
        <p
          className="mt-0.5"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            color: "#64748B",
            lineHeight: 1.4,
          }}
        >
          {stat.hint}
        </p>
      </div>
      {/* Connector tick to the anchor point on the curve */}
      <span
        aria-hidden="true"
        className="absolute left-1/2"
        style={{
          width: 1,
          height: 14,
          backgroundColor: "rgba(37,99,235,0.4)",
          [stat.side === "above" ? "bottom" : "top"]: -14,
          transform: "translateX(-50%)",
        }}
      />
    </motion.div>
  );
}
