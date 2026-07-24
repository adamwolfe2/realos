"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/components/portal/ui/motion";

export type FunnelStage = {
  label: string;
  value: number;
  href?: string;
  /**
   * Norman 2026-06-04: when the data source for this stage isn't
   * connected (e.g. tours/applications when no PMS is wired up), we
   * show an em-dash inside the slice instead of "0". A literal zero
   * implies "we measured and got nothing" — that's misleading when we
   * never had the pipe to measure with in the first place.
   *
   * Set `notApplicable: true` for unconnected stages. The slice still
   * renders (preserves the funnel silhouette) but the number is "—"
   * and the conversion % below uses "—" too.
   */
  notApplicable?: boolean;
};

// ---------------------------------------------------------------------------
// ConversionFunnel — visual funnel, not a bar chart.
//
// Operator feedback: the prior horizontal-bar-stack rendering read as a
// progress chart, not a funnel. This is now a true tapered funnel:
//
//   ┌──────┐
//   │      └──────┐
//   │              └──────┐
//   │ Visitors  Engaged  Leads  ┐
//   │              ┌──────┘
//   │      ┌──────┘
//   └──────┘
//
// Each stage is a trapezoidal slice whose visual width tapers left→right
// regardless of the actual counts. The taper communicates "funnel" as a
// metaphor; the numbers communicate the data. Stage labels + conversion %
// sit below their slice. Single-blue gradient (light → deep) per the
// brand rule — no rainbow severity hues.
//
// Renders as a pure SVG with viewBox so it scales cleanly on any width.
// ---------------------------------------------------------------------------

const VIEW_W = 1000;
const FUNNEL_H = 200;
const TOP_MAX_H = FUNNEL_H * 0.92; // tallest slice — leftmost
const TOP_MIN_H = FUNNEL_H * 0.28; // shortest slice — rightmost

// Brand-blue gradient stops. Stage 0 is lightest, last stage darkest.
// Interpolated linearly so any stage count produces a consistent look.
const LIGHT = { r: 0x45, g: 0x89, b: 0xff }; // #4589ff — Carbon Blue 50
const DEEP = { r: 0x00, g: 0x2d, b: 0x9c }; // #002d9c — Carbon Blue 80

function fillFor(i: number, total: number): string {
  if (total <= 1) return `rgb(${DEEP.r}, ${DEEP.g}, ${DEEP.b})`;
  const t = i / (total - 1);
  const r = Math.round(LIGHT.r + (DEEP.r - LIGHT.r) * t);
  const g = Math.round(LIGHT.g + (DEEP.g - LIGHT.g) * t);
  const b = Math.round(LIGHT.b + (DEEP.b - LIGHT.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const ref = React.useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  if (stages.length === 0) return null;

  const n = stages.length;
  const stageW = VIEW_W / n;

  // Slice top/bottom edge Y coordinates at the boundary between stage i-1
  // and stage i. We compute the slice height at each vertical line (0..n)
  // then derive the polygon corners.
  const sliceHeightAt = (idx: number): number => {
    if (n === 1) return TOP_MAX_H;
    const t = idx / n;
    return TOP_MAX_H + (TOP_MIN_H - TOP_MAX_H) * t;
  };
  const yTopAt = (idx: number): number => (FUNNEL_H - sliceHeightAt(idx)) / 2;
  const yBotAt = (idx: number): number => FUNNEL_H - yTopAt(idx);

  // Labels live BELOW the funnel. The label band needs height for the
  // stage name + count + conversion %. Reserve 64px.
  const LABEL_BAND_H = 70;
  const TOTAL_H = FUNNEL_H + LABEL_BAND_H;

  return (
    <div className="w-full">
      <svg
        ref={ref}
        viewBox={`0 0 ${VIEW_W} ${TOTAL_H}`}
        preserveAspectRatio="none"
        className="w-full h-auto"
        style={{ maxHeight: 260 }}
        aria-label="Conversion funnel"
        role="img"
      >
        {/* Subtle background guides for the funnel edges — gives the
            taper a clean container even when all values are 0. */}
        <line
          x1={0}
          y1={yTopAt(0)}
          x2={VIEW_W}
          y2={yTopAt(n)}
          stroke="rgba(22, 22, 22, 0.04)"
          strokeWidth={1}
        />
        <line
          x1={0}
          y1={yBotAt(0)}
          x2={VIEW_W}
          y2={yBotAt(n)}
          stroke="rgba(22, 22, 22, 0.04)"
          strokeWidth={1}
        />

        {/* The funnel slices — grow up from the baseline with a stagger on
            first view (motion pass 2026-07-24), mirroring the marketing
            walkthrough's GrowBar. transform-box: fill-box scales each
            slice from its own bottom edge instead of the SVG origin. */}
        {stages.map((s, i) => {
          const x1 = i * stageW;
          const x2 = (i + 1) * stageW;
          const pts = `${x1},${yTopAt(i)} ${x2},${yTopAt(i + 1)} ${x2},${yBotAt(i + 1)} ${x1},${yBotAt(i)}`;
          const delay = reduce ? 0 : 0.1 + i * 0.09;
          // Hairline gap between slices reads as polished, like Sankey
          // segments. 2px stroke in the slice fill color tightens edges.
          return (
            <motion.polygon
              key={s.label}
              points={pts}
              fill={fillFor(i, n)}
              stroke="white"
              strokeWidth={2}
              strokeLinejoin="round"
              initial={false}
              animate={{ scaleY: on ? 1 : 0, opacity: on ? 1 : 0 }}
              transition={{ duration: 0.55, ease: EASE_OUT, delay }}
              style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
            />
          );
        })}

        {/* Number inside each slice — vertically centered. Fades in just
            after its slice finishes growing. */}
        {stages.map((s, i) => {
          const cx = i * stageW + stageW / 2;
          const cy = FUNNEL_H / 2 + 8;
          // Hide the count when slice is too narrow for legible text
          // (last slice in a 7+ stage funnel). For ≤6 stages every
          // slice has room.
          const sliceMidH =
            (sliceHeightAt(i) + sliceHeightAt(i + 1)) / 2;
          if (sliceMidH < 36) return null;
          const delay = reduce ? 0 : 0.35 + i * 0.09;
          return (
            <motion.text
              key={`v-${s.label}`}
              x={cx}
              y={cy}
              textAnchor="middle"
              fontSize={Math.min(32, sliceMidH * 0.5)}
              fontWeight={600}
              fill="white"
              style={{ fontVariantNumeric: "tabular-nums" }}
              initial={false}
              animate={{ opacity: on ? 1 : 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay }}
            >
              {s.notApplicable ? "—" : s.value.toLocaleString()}
            </motion.text>
          );
        })}

        {/* Stage labels + conversion % below each slice. */}
        {stages.map((s, i) => {
          const cx = i * stageW + stageW / 2;
          const prevStage = i === 0 ? null : stages[i - 1];
          const prev = prevStage?.value ?? null;
          // Norman 2026-06-04: any stage flagged notApplicable (or with
          // an unconnected predecessor) shows "—" for its conversion %.
          // Computing 0% against an em-dash predecessor would be wrong.
          const naConversion =
            s.notApplicable === true || prevStage?.notApplicable === true;
          const conversion =
            !naConversion && prev && prev > 0
              ? Math.round((s.value / prev) * 100)
              : null;
          const delay = reduce ? 0 : 0.42 + i * 0.09;
          return (
            <motion.g
              key={`l-${s.label}`}
              initial={false}
              animate={{ opacity: on ? 1 : 0, y: on ? 0 : 6 }}
              transition={{ duration: 0.35, ease: EASE_OUT, delay }}
            >
              <text
                x={cx}
                y={FUNNEL_H + 26}
                textAnchor="middle"
                fontSize={20}
                fontWeight={600}
                fill="#161616"
                style={{ letterSpacing: "-0.005em" }}
              >
                {s.label}
              </text>
              {conversion != null ? (
                <text
                  x={cx}
                  y={FUNNEL_H + 52}
                  textAnchor="middle"
                  fontSize={16}
                  fill="#525252"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {conversion}% conv.
                </text>
              ) : naConversion ? (
                <text
                  x={cx}
                  y={FUNNEL_H + 52}
                  textAnchor="middle"
                  fontSize={16}
                  fill="#8d8d8d"
                >
                  not connected
                </text>
              ) : i === 0 ? (
                <text
                  x={cx}
                  y={FUNNEL_H + 52}
                  textAnchor="middle"
                  fontSize={16}
                  fill="#525252"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  top of funnel
                </text>
              ) : null}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
