"use client";

import { useEffect, useRef, useState } from "react";

// Simple count-up. No animation library — a 600ms easeOutQuart curve via
// requestAnimationFrame. Respects prefers-reduced-motion (jumps straight
// to the final value).
export function CountUp({
  to,
  durationMs = 900,
  className,
  style,
}: {
  to: number;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = Math.max(0, Math.round(to));
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(target * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [to, durationMs]);

  return (
    <span className={className} style={style}>
      {value}
    </span>
  );
}
