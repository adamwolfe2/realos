"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// CountUp — a number that counts up once when it first enters view (motion
// pass sec 3/5). Tabular figures so width never jumps. Reduced-motion shows
// the final value immediately.
// ---------------------------------------------------------------------------

export function CountUp({
  to,
  duration = 0.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  style,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);
  const started = useRef(false);

  useEffect(() => {
    if (reduce) {
      setValue(to);
      return;
    }
    if (!inView || started.current) return;
    started.current = true;

    let raf = 0;
    const start = performance.now();
    const ms = duration * 1000;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(to * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to, duration]);

  const display =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums", ...style }}
    >
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
