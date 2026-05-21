"use client";

import React, { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import {
  Phone,
  Eye,
  Rocket,
  LineChart,
  TrendingDown,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { MaskRevealUp } from "@/components/ui/animate-text";

// ---------------------------------------------------------------------------
// LaunchJourney — scroll-pinned 90-day unlock animation.
//
// Replaces the old static LaunchTrack (six dots on a flat horizontal line)
// with a scrollytelling animation: the section pins to the viewport, a
// horizontal progress bar fills from left to right as the user scrolls,
// and each of the six milestones "unlocks" (dot fills, icon scales in,
// body text fades in) when the progress bar crosses its position. Once
// all six are unlocked, a final completion ribbon appears.
//
// Implementation:
//   - Outer wrapper: ~280vh of scroll runway (gives each milestone room
//     to land + a final beat for the completion state).
//   - Inner content: position: sticky; top: 12vh; — pinned while the
//     outer scrolls past.
//   - framer-motion useScroll({ target: outerRef, offset: ["start start",
//     "end end"] }) yields 0→1 progress across the outer wrapper.
//   - useTransform maps progress to the fill bar's width.
//   - useMotionValueEvent derives which milestones have unlocked,
//     re-rendering only when the active index changes (not on every
//     scroll frame).
//
// Mobile: pinning eats too much viewport on phones. Below md, fallback
// is a simple per-step IntersectionObserver reveal — each milestone
// fades up when it enters view. No pinning, no horizontal bar.
//
// Reduced motion: respects prefers-reduced-motion via framer-motion's
// useReducedMotion hook. All steps render unlocked, no fill animation,
// no pinning behavior (effectively the same content laid out statically).
// ---------------------------------------------------------------------------

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";
// Norman feedback (2026-05-21): collapse all chart + accent colors onto
// the brand blue ramp — no semantic green/amber/red on the marketing
// surface. SUCCESS now reads as a calmer brand-blue accent for "this
// milestone landed" markers.
const SUCCESS = "#2563EB";

type Milestone = {
  when: string;
  title: string;
  body: string;
  marker: "before" | "launch" | "after";
  icon: LucideIcon;
};

const MILESTONES: Milestone[] = [
  {
    when: "Day 1",
    title: "Intake call",
    body: "Thirty minutes. We audit your stack live and lock the build plan.",
    marker: "before",
    icon: Phone,
  },
  {
    when: "Day 7",
    title: "Site preview",
    body: "Your custom site on a staging URL. You comment, we iterate.",
    marker: "before",
    icon: Eye,
  },
  {
    when: "Day 14",
    title: "Live on your domain",
    body: "DNS flipped. Pixel firing. Chatbot answering. Ads running.",
    marker: "launch",
    icon: Rocket,
  },
  {
    when: "Day 30",
    title: "First leases attributed",
    body: "Visitor pixel naming traffic. Tours booking. AI insights flowing.",
    marker: "after",
    icon: LineChart,
  },
  {
    when: "Day 60",
    title: "Cost curves drop",
    body: "Ads optimized. Creative refreshing weekly. AI search citing your pages.",
    marker: "after",
    icon: TrendingDown,
  },
  {
    when: "Day 90",
    title: "Compounding",
    body: "Portfolio-wide visibility. Identified visitors in CRM. Real growth.",
    marker: "after",
    icon: Layers,
  },
];

// Each milestone's activation threshold along the 0→1 scroll progress.
// We start the first unlock at 0.05 (so the section has a beat before
// anything happens) and finish at 0.85 (so the completion ribbon has
// room to settle in before the runway ends).
const THRESHOLDS = [0.05, 0.2, 0.36, 0.52, 0.68, 0.84];

export function LaunchJourney() {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Scroll progress 0→1 across the outer wrapper's height.
  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ["start start", "end end"],
  });

  // Fill bar width, mapped from progress. Clamp so the bar never
  // overshoots when the user is past the section.
  const fillWidth = useTransform(scrollYProgress, [0, 0.95], ["0%", "100%"], {
    clamp: true,
  });

  // Which milestones have unlocked. Derived from progress but only
  // re-renders when the index actually changes — useMotionValueEvent
  // fires every frame but we filter to changes only via setState.
  const [unlockedCount, setUnlockedCount] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const count = THRESHOLDS.filter((t) => v >= t).length;
    setUnlockedCount((prev) => (prev !== count ? count : prev));
  });

  // Reduced motion: show everything unlocked, no scroll dependency.
  const effectiveUnlockedCount = prefersReducedMotion
    ? MILESTONES.length
    : unlockedCount;
  const allUnlocked = effectiveUnlockedCount >= MILESTONES.length;

  return (
    <section
      style={{
        backgroundColor: PARCHMENT,
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      {/* Mobile fallback — per-milestone reveal, no pinning. Renders ABOVE
          md breakpoint only. */}
      <div className="md:hidden max-w-[1280px] mx-auto px-4 py-16">
        <JourneyHeader />
        <ol className="mt-10 grid grid-cols-1 gap-8">
          {MILESTONES.map((m, i) => (
            <MobileMilestone key={m.when} milestone={m} index={i} />
          ))}
        </ol>
      </div>

      {/* Desktop: scroll-pinned animation. */}
      <div ref={outerRef} className="hidden md:block relative" style={{ height: "280vh" }}>
        <div
          className="sticky flex items-center justify-center"
          style={{
            top: "8vh",
            height: "84vh",
          }}
        >
          <div className="w-full max-w-[1240px] mx-auto px-4 md:px-8">
            <JourneyHeader />

            <div className="mt-10 lg:mt-14">
              {/* Progress strip, sits across the row of dots */}
              <div className="relative" style={{ height: 14, marginBottom: 8 }}>
                {/* Track */}
                <div
                  className="absolute"
                  style={{
                    top: 6,
                    left: `calc(${100 / (MILESTONES.length * 2)}%)`,
                    right: `calc(${100 / (MILESTONES.length * 2)}%)`,
                    height: 2,
                    backgroundColor: BORDER,
                    borderRadius: 1,
                  }}
                />
                {/* Fill */}
                <motion.div
                  className="absolute"
                  style={{
                    top: 6,
                    left: `calc(${100 / (MILESTONES.length * 2)}%)`,
                    width: prefersReducedMotion
                      ? `calc(100% - ${(100 / (MILESTONES.length * 2)) * 2}%)`
                      : fillWidth,
                    maxWidth: `calc(100% - ${(100 / (MILESTONES.length * 2)) * 2}%)`,
                    height: 2,
                    backgroundColor: ACCENT,
                    borderRadius: 1,
                    transformOrigin: "left center",
                  }}
                  aria-hidden
                />

                {/* Dots, one per milestone, positioned at flex-1 centers */}
                <ol className="absolute inset-0 flex items-start">
                  {MILESTONES.map((m, i) => {
                    const isUnlocked = i < effectiveUnlockedCount;
                    const isLaunch = m.marker === "launch";
                    return (
                      <li
                        key={m.when}
                        className="flex-1 flex justify-center"
                        style={{ position: "relative" }}
                      >
                        <motion.span
                          aria-hidden
                          animate={{
                            scale: isUnlocked ? 1 : 0.7,
                            backgroundColor: isUnlocked ? ACCENT : "#CBD5E1",
                            boxShadow:
                              isUnlocked && isLaunch
                                ? "0 0 0 5px rgba(37,99,235,0.18)"
                                : isUnlocked
                                  ? "0 0 0 3px rgba(37,99,235,0.10)"
                                  : "0 0 0 0px rgba(37,99,235,0)",
                          }}
                          transition={{
                            duration: 0.4,
                            ease: [0.2, 0.7, 0.2, 1],
                          }}
                          style={{
                            width: isLaunch ? 14 : 12,
                            height: isLaunch ? 14 : 12,
                            borderRadius: "50%",
                            display: "inline-block",
                            position: "relative",
                            zIndex: 2,
                          }}
                        />
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Milestone columns */}
              <ol className="flex items-start">
                {MILESTONES.map((m, i) => {
                  const isUnlocked = i < effectiveUnlockedCount;
                  return (
                    <DesktopMilestone
                      key={m.when}
                      milestone={m}
                      unlocked={isUnlocked}
                      prefersReducedMotion={!!prefersReducedMotion}
                    />
                  );
                })}
              </ol>

              {/* Completion ribbon */}
              <CompletionRibbon visible={allUnlocked} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// JourneyHeader — eyebrow + headline + body. Shared by mobile + desktop.
// ---------------------------------------------------------------------------

function JourneyHeader() {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-3">Your first 90 days</p>
      <h2
        style={{
          color: INK,
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(28px, 4vw, 48px)",
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: "-0.028em",
        }}
      >
        {/* Mask Reveal Up — per-line. Two-line split keeps the editorial
            rhythm even when the headline wraps on narrow viewports. */}
        <MaskRevealUp
          lines={["Live in fourteen days.", "Compounding from day one."]}
        />
      </h2>
      <p
        className="mt-4 max-w-2xl"
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          lineHeight: 1.6,
        }}
      >
        Scroll to watch the platform unlock, step by step. Every capability
        ships on day fourteen, the next seventy-six days are compounding,
        not deployment.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DesktopMilestone — column under each dot, unlocks via scroll progress.
// ---------------------------------------------------------------------------

function DesktopMilestone({
  milestone: m,
  unlocked,
  prefersReducedMotion,
}: {
  milestone: Milestone;
  unlocked: boolean;
  prefersReducedMotion: boolean;
}) {
  const isLaunch = m.marker === "launch";
  const Icon = m.icon;

  return (
    <li className="flex-1 min-w-0 px-2 lg:px-3 mt-5">
      <motion.div
        initial={false}
        animate={{
          opacity: unlocked ? 1 : 0.32,
          y: unlocked ? 0 : 8,
        }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }
        }
        className="flex flex-col items-center text-center"
      >
        <span
          style={{
            color: unlocked ? (isLaunch ? ACCENT : "#64748B") : MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.16em",
            fontWeight: 700,
            textTransform: "uppercase",
            transition: "color 320ms ease",
          }}
        >
          {m.when}
          {isLaunch ? ". Launch" : ""}
        </span>

        <motion.div
          className="inline-flex items-center justify-center mt-3 mb-4"
          animate={{
            scale: unlocked ? 1 : 0.88,
            backgroundColor: unlocked ? "rgba(37,99,235,0.10)" : PARCHMENT,
            color: unlocked ? ACCENT : MUTED,
          }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }
          }
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
          }}
        >
          <Icon className="w-5 h-5" strokeWidth={1.6} />
        </motion.div>

        <p
          style={{
            color: unlocked ? INK : MUTED,
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
            transition: "color 320ms ease",
          }}
        >
          {m.title}
        </p>
        <p
          className="mt-1.5"
          style={{
            color: unlocked ? "#64748B" : "#CBD5E1",
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            lineHeight: 1.5,
            maxWidth: 180,
            transition: "color 320ms ease",
          }}
        >
          {m.body}
        </p>
      </motion.div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// MobileMilestone — vertical card-row, reveals on view (no pinning).
// ---------------------------------------------------------------------------

function MobileMilestone({
  milestone: m,
  index,
}: {
  milestone: Milestone;
  index: number;
}) {
  const isLaunch = m.marker === "launch";
  const Icon = m.icon;

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15% 0px" }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1], delay: index * 0.04 }}
      className="flex items-start gap-4"
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          backgroundColor: "rgba(37,99,235,0.10)",
          color: ACCENT,
        }}
      >
        <Icon className="w-5 h-5" strokeWidth={1.6} />
      </span>
      <div className="flex-1 min-w-0">
        <p
          style={{
            color: isLaunch ? ACCENT : "#64748B",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.16em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {m.when}
          {isLaunch ? ". Launch" : ""}
        </p>
        <p
          className="mt-1"
          style={{
            color: INK,
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
          }}
        >
          {m.title}
        </p>
        <p
          className="mt-1.5"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            lineHeight: 1.55,
          }}
        >
          {m.body}
        </p>
      </div>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// CompletionRibbon — appears once all six milestones are unlocked. A
// final cobalt-tinted strip that confirms the journey is complete.
// ---------------------------------------------------------------------------

function CompletionRibbon({ visible }: { visible: boolean }) {
  return (
    <motion.div
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 12,
      }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="mt-10 flex items-center justify-between gap-4 flex-wrap"
      style={{
        backgroundColor: "rgba(37,99,235,0.06)",
        border: `1px solid rgba(37,99,235,0.15)`,
        borderRadius: 4,
        padding: "14px 18px",
      }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: SUCCESS,
            color: "#FFFFFF",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2.5 7L5.5 10L11.5 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p
          style={{
            color: INK,
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Every capability unlocked. The platform compounds from here.
        </p>
      </div>
      <span
        style={{
          color: ACCENT,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        ↗ Start a pilot
      </span>
    </motion.div>
  );
}
