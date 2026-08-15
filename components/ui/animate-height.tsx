"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// AnimateHeight — smooths container-height changes when its children swap
// (wizard steps, intake sections). Measures the child with a ResizeObserver
// and animates the wrapper's height to match, so a 3-field step growing into
// a 14-card step glides instead of snapping.
//
// Height is `auto` until the first measurement (SSR-safe: no layout shift,
// no hydration mismatch — the measured span only constrains height after
// mount). Reduced motion: duration 0.
// ---------------------------------------------------------------------------

export function AnimateHeight({
  children,
  duration = 0.3,
  className,
}: {
  children: React.ReactNode;
  duration?: number;
  className?: string;
}) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | "auto">("auto");
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const el = innerRef.current;
    if (el == null || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      className={className}
      animate={{ height }}
      transition={{
        duration: reduce ? 0 : duration,
        ease: [0.2, 0.8, 0.2, 1],
      }}
      style={{ overflow: height === "auto" ? undefined : "hidden" }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
