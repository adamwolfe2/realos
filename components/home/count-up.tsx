"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { isAlreadyInViewport } from "./count-up-viewport";

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
  locale = false,
  className,
  style,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Format with thousands separators (12,480) while counting. */
  locale?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  // Always start at the final value: SSR and no-JS must show the real
  // number, never 0. The count-from-zero motion is a client-only reveal
  // that kicks in once this scrolls into view (below), not the initial paint.
  const [value, setValue] = useState(to);
  const started = useRef(false);

  // If this is already on screen at mount (e.g. the hero snapshot), skip the
  // from-zero animation entirely — it should just show the final value, not
  // flash real -> 0 -> real once framer's IntersectionObserver reports it.
  // Only elements that scroll into view *after* mount should animate.
  useEffect(() => {
    if (started.current) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (isAlreadyInViewport(rect.top, rect.bottom, vh)) started.current = true;
  }, []);

  useEffect(() => {
    if (reduce) return;
    if (!inView || started.current) return;
    started.current = true;

    setValue(0);
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
    decimals > 0
      ? value.toFixed(decimals)
      : locale
        ? Math.round(value).toLocaleString("en-US")
        : Math.round(value).toString();

  const finalDisplay =
    decimals > 0
      ? to.toFixed(decimals)
      : locale
        ? Math.round(to).toLocaleString("en-US")
        : Math.round(to).toString();
  // Reserve width for the final formatted string so the count-up never
  // reflows the layout around it (was causing CLS on home at 390px).
  const minWidthCh = `${prefix}${finalDisplay}${suffix}`.length;

  return (
    <span
      ref={ref}
      className={className}
      style={{
        fontVariantNumeric: "tabular-nums",
        display: "inline-block",
        minWidth: `${minWidthCh}ch`,
        ...style,
      }}
    >
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
