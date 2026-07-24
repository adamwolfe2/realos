"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";

// ---------------------------------------------------------------------------
// Shared portal motion kit — leaf client components only. Ports the exact
// patterns/timings/easing proven out in the marketing walkthrough
// (components/home/count-up.tsx + components/home/walkthrough/screen-*.tsx)
// onto the real product surfaces so product and marketing feel like the
// same system.
//
//   - Easing: cubic-bezier(0.2,0.7,0.2,1) for tween entrances, springs at
//     stiffness ~380 / damping ~24 for pops.
//   - Durations: 0.3-0.7s. Stagger: 0.06-0.16s per item.
//   - Every animation honors `useReducedMotion` (final state immediately)
//     and plays ONCE (`useInView({ once: true })` or on mount).
//
// Keep this file leaf-only: no data fetching, no tenancy/scope logic. Pages
// stay server components; only these pieces get "use client".
// ---------------------------------------------------------------------------

export const EASE_OUT = [0.2, 0.7, 0.2, 1] as const;
export const SPRING_POP = { type: "spring" as const, stiffness: 380, damping: 24 };

// ---------------------------------------------------------------------------
// CountUpValue — a number that counts up once when it first enters view.
// Tabular figures so width never jumps. Reduced-motion shows the final
// value immediately. Direct port of components/home/count-up.tsx, kept
// generic (no marketing-only assumptions) for reuse on real KPI tiles.
// ---------------------------------------------------------------------------

export function CountUpValue({
  value,
  duration = 0.8,
  prefix = "",
  suffix = "",
  decimals = 0,
  locale = true,
  className,
  style,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Format with thousands separators (12,480) while counting. Default on —
   *  every portal metric is already formatted this way. */
  locale?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(reduce ? value : 0);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
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
      setDisplay(value * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value, duration]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : locale
        ? Math.round(display).toLocaleString("en-US")
        : Math.round(display).toString();

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums", ...style }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// GrowBar — a horizontal bar that grows to its target width/percentage once
// on first view. Direct port of the GrowBar in
// components/home/walkthrough/screen-dashboard.tsx.
// ---------------------------------------------------------------------------

export function GrowBar({
  percent,
  color = "var(--color-primary, #0f62fe)",
  trackColor = "#eef1f8",
  height = 6,
  radius = 999,
  delay = 0,
  className,
}: {
  /** 0..100 */
  percent: number;
  color?: string;
  trackColor?: string;
  height?: number;
  radius?: number;
  delay?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const grow = reduce ? true : inView;
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      ref={ref}
      className={className}
      style={{
        height,
        backgroundColor: trackColor,
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={false}
        animate={{ width: grow ? `${clamped}%` : "0%" }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: reduce ? 0 : delay }}
        style={{ height: "100%", backgroundColor: color, borderRadius: radius }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StaggerGroup / StaggerItem — roll a list of items in with a per-item
// stagger on first view. Wrap a list container in StaggerGroup and each
// child row in StaggerItem. Caps effective stagger delay so long lists
// (12+ rows) don't feel slow to finish.
// ---------------------------------------------------------------------------

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

export function StaggerGroup({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul" | "tbody";
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const state = inView || reduce ? "show" : "hidden";
  const initial = reduce ? "show" : "hidden";

  if (as === "ul") {
    return (
      <motion.ul
        ref={ref as unknown as React.RefObject<HTMLUListElement>}
        className={className}
        initial={initial}
        animate={state}
        variants={staggerContainer}
      >
        {children}
      </motion.ul>
    );
  }
  if (as === "tbody") {
    return (
      <motion.tbody
        ref={ref as unknown as React.RefObject<HTMLTableSectionElement>}
        className={className}
        initial={initial}
        animate={state}
        variants={staggerContainer}
      >
        {children}
      </motion.tbody>
    );
  }
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initial}
      animate={state}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

/** Max index used for stagger delay math — rows past this cap animate at
 *  the same (final) delay so a 40-row table doesn't take 6 seconds to
 *  finish rolling in. */
const STAGGER_CAP_INDEX = 12;

export function StaggerItem({
  children,
  index = 0,
  className,
  as: Component = "div",
  direction = "up",
  stepMs = 60,
}: {
  children: React.ReactNode;
  /** Row index — delay scales with this, capped at STAGGER_CAP_INDEX. */
  index?: number;
  className?: string;
  as?: "div" | "li" | "tr";
  /** Entrance direction for the slide component. */
  direction?: "up" | "left" | "right";
  /** Per-row delay step in ms (default 60ms, i.e. 0.06s per the spec range). */
  stepMs?: number;
}) {
  const reduce = useReducedMotion();
  const cappedIndex = Math.min(index, STAGGER_CAP_INDEX);
  const delay = reduce ? 0 : (cappedIndex * stepMs) / 1000;
  const offset =
    direction === "up" ? { y: 10 } : direction === "left" ? { x: -16 } : { x: 16 };

  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.4, ease: EASE_OUT, delay },
    },
  };

  if (Component === "li") {
    return (
      <motion.li className={className} variants={variants}>
        {children}
      </motion.li>
    );
  }
  if (Component === "tr") {
    return (
      <motion.tr className={className} variants={variants}>
        {children}
      </motion.tr>
    );
  }
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// RevealPulse — a brief blue ring pulse around its children, used to mark a
// row/element that just changed state (e.g. newly identified visitor).
// Fires once when `active` flips true; caller controls the trigger.
// ---------------------------------------------------------------------------

export function RevealPulse({
  active,
  radius = 999,
  className,
  children,
}: {
  /** Set true to fire the pulse. Component does not reset it itself. */
  active: boolean;
  radius?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <span className={className} style={{ position: "relative", display: "inline-flex" }}>
      {children}
      {active && !reduce ? (
        <motion.span
          aria-hidden
          initial={{ scale: 0.85, opacity: 0.9 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 1.3, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: radius,
            border: "2px solid var(--color-primary, #0f62fe)",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SpringIn — generic spring-pop wrapper for cards/banners/chips that should
// arrive with a soft bounce (mirrors the "captured" / "lead booked" banners
// and numbered chips in screen-briefing.tsx / screen-chatbot.tsx).
// ---------------------------------------------------------------------------

export function SpringIn({
  children,
  delay = 0,
  className,
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={{ opacity: on ? 1 : 0, y: on ? 0 : 10, scale: on ? 1 : 0.96 }}
      transition={{ ...SPRING_POP, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}
