"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { Inbox, Users, Sparkles, Moon, type LucideIcon } from "lucide-react";
import { MARKETING } from "@/lib/copy/marketing";
import { MaskRevealUp, PerWordCrossfade } from "@/components/ui/animate-text";

// ---------------------------------------------------------------------------
// Weekly — operating rhythm, redesigned as an editorial timeline.
//
// Was: plain two-column list. Now: a vertical timeline with an animated
// cobalt spine that fills as the user scrolls past the section. Each beat
// (Monday / Tuesday / Thursday / Ongoing) has:
//   - a day chip on the left
//   - a node on the spine that lights up cobalt when the row enters view
//   - a small contextual icon inside the node
//   - the headline, body, and outcome metric on the right
//   - an animated cobalt underline that draws under the outcome metric
//     when the row activates — same scaleX-from-left treatment used in
//     the Comparison section, for visual continuity
//
// The whole thing reads as "this is what your week shapes up to" — not a
// flat list of bullets.
// ---------------------------------------------------------------------------

const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const ACCENT = "#2563EB";
const BORDER = "#E2E8F0";

// Per pixel-point/animate-text soft-blur-in / mask-reveal-up specs.
const EASE_DRAW = [0.22, 1, 0.36, 1] as const;

// Contextual icons per item. Falls back to the last icon if marketing.items
// adds rows beyond the configured set.
const ITEM_ICONS: LucideIcon[] = [Inbox, Users, Sparkles, Moon];

function useInViewOnce<T extends HTMLElement>(threshold = 0.4) {
  const ref = useRef<T | null>(null);
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
      { threshold, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function WeeklyItem({
  index,
  day,
  time,
  title,
  body,
  outcome,
  isLast,
}: {
  index: number;
  day: string;
  time: string;
  title: string;
  body: string;
  outcome?: string;
  isLast: boolean;
}) {
  const { ref, visible } = useInViewOnce<HTMLLIElement>(0.4);
  const reduce = useReducedMotion();
  const Icon = ITEM_ICONS[index] ?? ITEM_ICONS[ITEM_ICONS.length - 1];

  return (
    <li
      ref={ref}
      className="grid grid-cols-[64px_1fr] md:grid-cols-[120px_56px_1fr] gap-x-4 md:gap-x-8 py-10 md:py-14 relative"
    >
      {/* Day chip — large mono with time underneath */}
      <div>
        <p
          style={{
            color: visible ? INK : MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
            transition: "color 480ms ease",
          }}
        >
          {day}
        </p>
        <p
          className="mt-1"
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {time}
        </p>
      </div>

      {/* Node on the spine (desktop only). The spine line itself is drawn
          by the parent so it can span the full timeline height seamlessly;
          this column just centers the node circle on top of that line. */}
      <div className="hidden md:flex justify-center items-start relative">
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{
            scale: reduce ? 1 : visible ? 1 : 0.7,
            opacity: visible ? 1 : 0.85,
          }}
          transition={{ duration: 0.5, ease: EASE_DRAW }}
          style={{
            position: "relative",
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: "#FFFFFF",
            border: `1.5px solid ${visible ? ACCENT : BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Sit on top of the spine line.
            zIndex: 1,
            transition: "border-color 480ms ease",
            // Soft cobalt halo when active.
            boxShadow: visible
              ? "0 0 0 6px rgba(37,99,235,0.06)"
              : "0 0 0 0px rgba(37,99,235,0)",
          }}
        >
          <Icon
            size={16}
            strokeWidth={2}
            color={visible ? ACCENT : MUTED}
            style={{ transition: "color 480ms ease" }}
          />
          {/* Subtle ping ring when the row first activates */}
          {visible && !reduce ? (
            <motion.span
              aria-hidden="true"
              initial={{ scale: 0.6, opacity: 0.6 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                border: `1.5px solid ${ACCENT}`,
              }}
            />
          ) : null}
        </motion.div>
      </div>

      {/* Content column */}
      <div className="min-w-0 md:pt-1">
        <h3
          style={{
            color: INK,
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(20px, 2vw, 24px)",
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.018em",
          }}
        >
          <MaskRevealUp lines={[title]} staggerMs={0} />
        </h3>
        <p
          className="mt-3 max-w-[640px]"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            lineHeight: 1.65,
          }}
        >
          <PerWordCrossfade trigger={visible} staggerMs={28}>
            {body}
          </PerWordCrossfade>
        </p>
        {outcome ? (
          <div
            className="mt-5 inline-flex items-center"
            style={{ position: "relative" }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 18,
                height: 1,
                backgroundColor: ACCENT,
                marginRight: 10,
              }}
            />
            <span
              style={{
                position: "relative",
                color: ACCENT,
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {outcome}
              {/* Animated cobalt underline — same draw treatment as the
                  Comparison section, keeps the language consistent. */}
              <motion.span
                aria-hidden="true"
                initial={false}
                animate={{ scaleX: reduce ? 1 : visible ? 1 : 0 }}
                transition={{
                  duration: reduce ? 0 : 0.72,
                  delay: reduce ? 0 : 0.3,
                  ease: EASE_DRAW,
                }}
                style={{
                  display: "block",
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -4,
                  height: 1.5,
                  backgroundColor: ACCENT,
                  transformOrigin: "left center",
                  willChange: "transform",
                  borderRadius: 1,
                }}
              />
            </span>
          </div>
        ) : null}
      </div>

      {/* Item divider — appears between rows. Hidden on the last item. */}
      {!isLast ? (
        <div
          aria-hidden="true"
          className="hidden md:block absolute"
          style={{
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: BORDER,
            opacity: 0.55,
          }}
        />
      ) : null}
    </li>
  );
}

export function Weekly() {
  const { weekly } = MARKETING.home;
  const timelineRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Animated spine fill — grows from 0 → 1 as the timeline section
  // scrolls through the viewport. The grey baseline is rendered behind
  // it; this layer just paints cobalt on top.
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 75%", "end 25%"],
  });
  const smooth = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 22,
    mass: 0.4,
  });
  const fillScaleY = useTransform(smooth, [0, 1], [0, 1]);

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="max-w-3xl mb-14 md:mb-20">
          <p className="eyebrow mb-3">{weekly.eyebrow}</p>
          <h2
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.6vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            <MaskRevealUp lines={splitHeadlineIntoLines(weekly.headline)} />
          </h2>
          <p
            className="mt-5 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              lineHeight: 1.6,
            }}
          >
            {weekly.body}
          </p>
        </div>

        {/* Timeline. Spine is drawn at the column that holds the nodes
            (120px day chip + 28px to center of 56px node column = 148px
            from the left edge of the grid). The two layers — grey
            baseline + cobalt scroll-fill — are absolutely positioned so
            they span the full timeline height without coupling to any
            individual row. */}
        <div ref={timelineRef} className="relative">
          {/* Grey baseline spine (desktop only). */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute"
            style={{
              left: 148, // 120px day column + 28px (half of 56px node col)
              top: 56, // skip the top padding so the line starts mid-first-node
              bottom: 56, // and ends mid-last-node
              width: 1.5,
              backgroundColor: BORDER,
              borderRadius: 1,
              zIndex: 0,
            }}
          />
          {/* Cobalt scroll-fill spine. */}
          <motion.div
            aria-hidden="true"
            className="hidden md:block absolute"
            style={{
              left: 148,
              top: 56,
              bottom: 56,
              width: 1.5,
              backgroundColor: ACCENT,
              borderRadius: 1,
              transformOrigin: "top center",
              scaleY: reduce ? 1 : fillScaleY,
              zIndex: 0,
            }}
          />

          <ol style={{ position: "relative", zIndex: 1 }}>
            {weekly.items.map((item, i) => (
              <WeeklyItem
                key={item.title}
                index={i}
                day={item.day}
                time={item.time}
                title={item.title}
                body={item.body}
                outcome={item.outcome}
                isLast={i === weekly.items.length - 1}
              />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// Same helper used by Comparison — break the headline on a natural pivot
// for the per-line MaskRevealUp. Falls back to a single line if no
// reasonable break point exists.
function splitHeadlineIntoLines(headline: string): string[] {
  const trimmed = headline.trim();
  const mid = Math.floor(trimmed.length / 2);
  const before = trimmed.lastIndexOf(" ", mid);
  const after = trimmed.indexOf(" ", mid);
  if (before <= 0 && after <= 0) return [trimmed];
  const cut =
    before > 0 && after > 0
      ? mid - before < after - mid
        ? before
        : after
      : before > 0
        ? before
        : after;
  return [trimmed.slice(0, cut).trim(), trimmed.slice(cut).trim()];
}
