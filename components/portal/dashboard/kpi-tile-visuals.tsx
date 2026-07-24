"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { EASE_OUT, CountUpValue } from "@/components/portal/ui/motion";

// ---------------------------------------------------------------------------
// KpiTile animated visuals — leaf client components split out of
// kpi-tile.tsx so the tile itself can stay a server component. Ports the
// marketing walkthrough's "dashboard waking up" motion (screen-dashboard.tsx
// GrowBar + count-up.tsx) onto the real KpiTile: the hero number counts up
// once on first view, and the sparkline/bars/gauge draw in instead of
// appearing static. Reduced-motion renders the final state immediately.
// ---------------------------------------------------------------------------

/** Parses a formatted metric string like "$18,240" or "1,284" or "94.2%"
 *  back into a numeric value + surrounding prefix/suffix so it can be
 *  animated with CountUpValue. Returns null when the value isn't a plain
 *  formatted number (e.g. "—", "N/A", multi-token strings) — callers fall
 *  back to rendering the static value in that case. */
export function parseNumericValue(
  value: React.ReactNode,
): { numeric: number; prefix: string; suffix: string; decimals: number } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([^\d.-]*)([\d,]*\.?\d*)([^\d]*)$/);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  if (!digits) return null;
  const cleaned = digits.replace(/,/g, "");
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;
  const decimalPart = cleaned.split(".")[1];
  return { numeric, prefix, suffix, decimals: decimalPart?.length ?? 0 };
}

export function AnimatedKpiValue({
  value,
  className,
}: {
  value: React.ReactNode;
  className?: string;
}) {
  const parsed = parseNumericValue(value);
  if (!parsed) return <>{value}</>;
  return (
    <CountUpValue
      value={parsed.numeric}
      prefix={parsed.prefix}
      suffix={parsed.suffix}
      decimals={parsed.decimals}
      locale
      duration={0.8}
      className={className}
    />
  );
}

function useDrawIn() {
  const ref = React.useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  return { ref, draw: reduce ? true : inView, reduce };
}

export function AnimatedSparkline({
  data,
  height = 36,
}: {
  data: number[];
  height?: number;
}) {
  const { ref, draw, reduce } = useDrawIn();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath = `M0,${h} L${points.split(" ").join(" L")} L${w},${h} Z`;
  const lastPoint = points.split(" ").pop()?.split(",");
  const lastX = lastPoint ? parseFloat(lastPoint[0]) : 0;
  const lastY = lastPoint ? parseFloat(lastPoint[1]) : 0;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full overflow-visible"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ls-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f62fe" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0f62fe" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill="url(#ls-spark-grad)"
        initial={false}
        animate={{ opacity: draw ? 1 : 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT, delay: reduce ? 0 : 0.15 }}
      />
      <motion.polyline
        points={points}
        fill="none"
        stroke="#0f62fe"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={false}
        style={{ pathLength: draw ? 1 : 0 }}
        animate={{ pathLength: draw ? 1 : 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r="1.6"
        fill="#0f62fe"
        vectorEffect="non-scaling-stroke"
        initial={false}
        animate={{ scale: draw ? 1 : 0, opacity: draw ? 1 : 0 }}
        style={{ transformOrigin: `${lastX}px ${lastY}px` }}
        transition={{ duration: 0.3, ease: EASE_OUT, delay: reduce ? 0 : 0.6 }}
      />
    </svg>
  );
}

export function AnimatedBarMini({
  data,
  height = 36,
}: {
  data: number[];
  height?: number;
}) {
  const { ref, draw, reduce } = useDrawIn();
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const slice = data.slice(-28);
  const gap = 1;
  const w = 100;
  const barW = (w - gap * (slice.length - 1)) / slice.length;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full overflow-visible"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      {slice.map((v, i) => {
        const barH = Math.max(1.5, (v / max) * (height - 2));
        const x = i * (barW + gap);
        const y = height - barH;
        const isLast = i === slice.length - 1;
        // Cap the stagger so a 28-bar strip finishes quickly (matches the
        // "cap after ~12" rule applied elsewhere on the page).
        const delay = reduce ? 0 : Math.min(i, 16) * 0.012;
        return (
          <motion.rect
            key={i}
            x={x}
            width={barW}
            rx="0.6"
            fill={isLast ? "#0f62fe" : "#a6c8ff"}
            opacity={isLast ? 1 : 0.55}
            initial={false}
            animate={{ y: draw ? y : height, height: draw ? barH : 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay }}
          />
        );
      })}
    </svg>
  );
}

export function AnimatedGauge({
  value,
  height = 36,
}: {
  value: number;
  height?: number;
}) {
  const { ref, draw, reduce } = useDrawIn();
  const clamped = Math.max(0, Math.min(1, value));
  const w = 100;
  const h = height;
  const cx = w / 2;
  const cy = h - 2;
  const r = h - 6;
  const start = Math.PI;
  const end = 0;
  const angle = start + clamped * (end - start);

  const arcPath = (from: number, to: number) => {
    const x1 = cx + r * Math.cos(from);
    const y1 = cy + r * Math.sin(from);
    const x2 = cx + r * Math.cos(to);
    const y2 = cy + r * Math.sin(to);
    const largeArc = Math.abs(to - from) > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const tickX = cx + r * Math.cos(draw ? angle : start);
  const tickY = cy + r * Math.sin(draw ? angle : start);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYEnd meet"
      className="w-full overflow-visible"
      style={{ height: `${h}px` }}
      aria-hidden="true"
    >
      <path d={arcPath(start, end)} fill="none" stroke="#e0e0e0" strokeWidth="3" strokeLinecap="round" />
      <motion.path
        d={arcPath(start, angle)}
        fill="none"
        stroke="#0f62fe"
        strokeWidth="3"
        strokeLinecap="round"
        initial={false}
        style={{ pathLength: draw ? 1 : 0 }}
        animate={{ pathLength: draw ? 1 : 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: reduce ? 0 : 0.1 }}
      />
      <motion.circle
        cx={tickX}
        cy={tickY}
        r="2.4"
        fill="#FFFFFF"
        stroke="#0f62fe"
        strokeWidth="1.4"
        initial={false}
        animate={{ cx: tickX, cy: tickY }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: reduce ? 0 : 0.1 }}
      />
    </svg>
  );
}
