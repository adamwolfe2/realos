"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AnimatedNumber — counts up from 0 (or from the previous value) to the
// target on first paint. Tiny client component, no external dependency.
// react-countup adds 8kb for one feature; this is ~50 lines and only
// runs when a value actually changes.
//
// Usage:
//   <AnimatedNumber value={1875} />               // 1,875
//   <AnimatedNumber value={42} prefix="$" suffix="k" />
//   <AnimatedNumber value={0.847} format="percent" />
//   <AnimatedNumber value={4451673} format="currency" />
//
// Premium feel: numbers count up over ~600ms with a softer ease-out so
// the dashboard feels alive on first load. Skips animation when the
// browser reports prefers-reduced-motion.
// ---------------------------------------------------------------------------

type Format = "number" | "currency" | "percent" | "compact";

type Props = {
  value: number;
  /** ms over which to count from 0 → value. Default 600. */
  duration?: number;
  /** Decimal places. Default 0 for integers, 1 for percent. */
  decimals?: number;
  format?: Format;
  prefix?: string;
  suffix?: string;
  className?: string;
};

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

function formatValue(v: number, fmt: Format, decimals: number): string {
  if (!Number.isFinite(v)) return "—";
  if (fmt === "currency") {
    return v.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }
  if (fmt === "percent") {
    return `${(v * 100).toFixed(decimals)}%`;
  }
  if (fmt === "compact") {
    return v.toLocaleString(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AnimatedNumber({
  value,
  duration = 600,
  decimals,
  format = "number",
  prefix = "",
  suffix = "",
  className,
}: Props) {
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);
  const finalDecimals =
    decimals ?? (format === "percent" ? 1 : 0);

  useEffect(() => {
    // Honor reduced motion: snap to final value immediately.
    if (prefersReducedMotion() || duration <= 0) {
      setDisplay(value);
      previous.current = value;
      return;
    }
    const start = previous.current;
    const startTime = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = EASE_OUT(t);
      const next = start + (value - start) * eased;
      setDisplay(next);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        previous.current = value;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {formatValue(display, format, finalDecimals)}
      {suffix}
    </span>
  );
}
