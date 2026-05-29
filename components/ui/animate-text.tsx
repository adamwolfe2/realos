"use client";

// ---------------------------------------------------------------------------
// AnimateText — premium text reveal primitives.
//
// Faithful implementations of the pixel-point/animate-text skill JSON specs
// (https://pixelpoint.io/skills/animate-text/). Each primitive maps 1:1 to
// the bundled JSON contract — same durations, stagger_ms, signature easings,
// and transform fields — translated into Framer Motion variants.
//
// Specs implemented:
//   - SoftBlurIn         → assets/specs/soft-blur-in.json
//     Per-character fade + blur(12→0) + y(16→0), 900ms, stagger 25ms,
//     ease cubic-bezier(0.22, 1, 0.36, 1).
//     Use for hero titles 48px+ against solid backgrounds.
//
//   - MaskRevealUp       → assets/specs/mask-reveal-up.json
//     Per-line fade + blur(6→0) + y(30→0), 760ms, stagger 90ms,
//     ease cubic-bezier(0.22, 1, 0.36, 1).
//     Use for two/three-line section headings.
//
//   - PerWordCrossfade   → assets/specs/per-word-crossfade.json
//     Per-word fade + y(8→0), 700ms, stagger 70ms,
//     ease cubic-bezier(0.16, 1, 0.3, 1).
//     Use for calm in-product reveals (dashboard greetings, etc).
//
// All primitives:
//   - One-shot reveal on first viewport entry (IntersectionObserver).
//   - Respect prefers-reduced-motion (renders static text, no animation).
//   - Preserve underlying typography — no font/color injection; spans
//     inherit from the parent <h1>/<h2>/<p>.
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

// Framer Motion accepts cubic-bezier easings as a 4-tuple of numbers.
const EASE_SOFT = [0.22, 1, 0.36, 1] as const;
const EASE_KEYNOTE = [0.16, 1, 0.3, 1] as const;

// Shared hook: fires `visible` once when the wrapper enters the viewport.
// Mirrors the existing components/platform/reveal.tsx behavior so motion
// feels consistent across the site.
function useInViewOnce(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return visible;
}

// =============================================================================
// SoftBlurIn — per-character, Apple-keynote signature reveal.
// Spec: assets/specs/soft-blur-in.json
// =============================================================================

export type SoftBlurInSegment = {
  /** A logical line of the headline. Rendered on its own row (display: block). */
  text: string;
  /** Optional inline color override for accent lines. */
  color?: string;
};

export function SoftBlurIn({
  segments,
  delay = 0,
  /**
   * Override per-character blur intensity. Defaults to 12px (spec value).
   * Drop to ~6px for body copy (<24px) per spec usage notes.
   */
  blurPx = 12,
  /** Override per-character stagger. Defaults to 25ms (spec value). */
  staggerMs = 25,
  /** Optional className applied to the outer wrapper. */
  className,
}: {
  segments: SoftBlurInSegment[];
  delay?: number;
  blurPx?: number;
  staggerMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const visible = useInViewOnce(ref);
  const reduce = useReducedMotion();

  // Pre-compute a flat character list with a cumulative index for stagger,
  // while preserving the segment boundaries (block rows + optional color).
  let charIndex = 0;

  const charVariants: Variants = {
    hidden: { opacity: 0, y: 16, filter: `blur(${blurPx}px)` },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.9,
        delay: delay / 1000 + i * (staggerMs / 1000),
        ease: EASE_SOFT as unknown as number[],
      },
    }),
  };

  return (
    <span ref={ref} className={className} style={{ display: "inline-block" }}>
      {segments.map((seg, segIdx) => {
        // For accessibility, render a screen-reader-only copy of the full
        // segment text and visually hide the per-character spans from AT.
        return (
          <span
            key={segIdx}
            style={{ display: "block", color: seg.color }}
          >
            <span className="sr-only">{seg.text}</span>
            {/* Layout fix (2026-05-28): wrap each WORD in inline-block +
                white-space: nowrap so chars within a word can't break
                across lines. Without it, narrow containers wrap
                "marketing" as "m / arketing". */}
            <span aria-hidden="true">
              {seg.text.split(" ").map((word, wIdx, words) => (
                <React.Fragment key={`${segIdx}-w${wIdx}`}>
                  <span
                    style={{
                      display: "inline-block",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {Array.from(word).map((ch, charI) => {
                      const cIdx = charIndex++;
                      return (
                        <motion.span
                          key={`${segIdx}-${wIdx}-${charI}`}
                          custom={cIdx}
                          variants={reduce ? undefined : charVariants}
                          initial={reduce ? false : "hidden"}
                          animate={
                            reduce ? undefined : visible ? "visible" : "hidden"
                          }
                          style={{
                            display: "inline-block",
                            willChange: "transform, opacity, filter",
                          }}
                        >
                          {ch}
                        </motion.span>
                      );
                    })}
                  </span>
                  {/* Word separator — non-breaking space OUTSIDE the word
                      wrapper so it actually renders between two adjacent
                      inline-block siblings. Using   (nbsp) is the
                      most reliable way to force a visible space between
                      inline-blocks; the line still breaks at this point
                      because the outer container doesn't have nowrap. */}
                  {wIdx < words.length - 1 ? " " : null}
                </React.Fragment>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// =============================================================================
// MaskRevealUp — per-line editorial reveal.
// Spec: assets/specs/mask-reveal-up.json
// =============================================================================

export function MaskRevealUp({
  lines,
  delay = 0,
  /** Override per-line stagger. Defaults to 90ms (spec value). */
  staggerMs = 90,
  /** Override y-offset. Defaults to 30px (spec value). */
  yPx = 30,
  /** Override blur. Defaults to 6px (spec value). */
  blurPx = 6,
  className,
}: {
  lines: string[];
  delay?: number;
  staggerMs?: number;
  yPx?: number;
  blurPx?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const visible = useInViewOnce(ref);
  const reduce = useReducedMotion();

  const lineVariants: Variants = {
    hidden: { opacity: 0, y: yPx, filter: `blur(${blurPx}px)` },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.76,
        delay: delay / 1000 + i * (staggerMs / 1000),
        ease: EASE_SOFT as unknown as number[],
      },
    }),
  };

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-block", width: "100%" }}
    >
      {lines.map((line, i) => (
        // Each line gets its own overflow-hidden row so the masked-from-below
        // feel stays clean even when the headline wraps at unusual breakpoints.
        <span
          key={i}
          style={{ display: "block", overflow: "hidden", paddingBottom: "0.05em" }}
        >
          <motion.span
            custom={i}
            variants={reduce ? undefined : lineVariants}
            initial={reduce ? false : "hidden"}
            animate={reduce ? undefined : visible ? "visible" : "hidden"}
            style={{
              display: "block",
              willChange: "transform, opacity, filter",
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

// =============================================================================
// PerWordCrossfade — calm per-word reveal.
// Spec: assets/specs/per-word-crossfade.json
// =============================================================================

export function PerWordCrossfade({
  children,
  delay = 0,
  /** Override per-word stagger. Defaults to 70ms (spec value). */
  staggerMs = 70,
  /** Override y-offset. Defaults to 8px (spec value). */
  yPx = 8,
  /**
   * Optional external visibility trigger. When provided, the internal
   * IntersectionObserver is bypassed and the reveal is driven entirely
   * by the parent's state. Useful when the parent already gates its own
   * scroll-triggered choreography and wants the per-word reveal to land
   * on the same beat.
   */
  trigger,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  staggerMs?: number;
  yPx?: number;
  trigger?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const internalVisible = useInViewOnce(ref);
  const visible = trigger !== undefined ? trigger : internalVisible;
  const reduce = useReducedMotion();

  // Walk children; for string nodes, split on whitespace and animate
  // each word independently. For non-string nodes (e.g. an accent
  // <span>), animate the node as a single unit. This keeps consumers
  // free to color a word without breaking the stagger.
  let wordIndex = 0;

  const wordVariants: Variants = {
    hidden: { opacity: 0, y: yPx },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        delay: delay / 1000 + i * (staggerMs / 1000),
        ease: EASE_KEYNOTE as unknown as number[],
      },
    }),
  };

  const renderNode = (node: React.ReactNode, key: string): React.ReactNode => {
    if (node === null || node === undefined || typeof node === "boolean") {
      return null;
    }

    if (typeof node === "string" || typeof node === "number") {
      const text = String(node);
      // Preserve leading/trailing whitespace by tokenising on word
      // boundaries while keeping the spaces as their own tokens.
      const tokens = text.split(/(\s+)/);
      return tokens.map((tok, i) => {
        if (tok.length === 0) return null;
        if (/^\s+$/.test(tok)) {
          return (
            <span key={`${key}-${i}`} style={{ whiteSpace: "pre" }}>
              {tok}
            </span>
          );
        }
        const wIdx = wordIndex++;
        return (
          <motion.span
            key={`${key}-${i}`}
            custom={wIdx}
            variants={reduce ? undefined : wordVariants}
            initial={reduce ? false : "hidden"}
            animate={reduce ? undefined : visible ? "visible" : "hidden"}
            style={{
              display: "inline-block",
              willChange: "transform, opacity",
            }}
          >
            {tok}
          </motion.span>
        );
      });
    }

    if (React.isValidElement(node)) {
      const wIdx = wordIndex++;
      // Wrap the element (e.g. an accent span) as a single animated unit
      // so its styling — color, weight, etc. — passes through untouched.
      return (
        <motion.span
          key={key}
          custom={wIdx}
          variants={reduce ? undefined : wordVariants}
          initial={reduce ? false : "hidden"}
          animate={reduce ? undefined : visible ? "visible" : "hidden"}
          style={{
            display: "inline-block",
            willChange: "transform, opacity",
          }}
        >
          {node}
        </motion.span>
      );
    }

    if (Array.isArray(node)) {
      return node.map((child, i) => renderNode(child, `${key}-${i}`));
    }

    return node;
  };

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-block" }}
    >
      <span className="sr-only">
        {React.Children.toArray(children).join(" ")}
      </span>
      <span aria-hidden="true">{renderNode(children, "pwc")}</span>
    </span>
  );
}
