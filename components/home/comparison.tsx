"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MARKETING } from "@/lib/copy/marketing";
import { PerWordCrossfade, MaskRevealUp } from "@/components/ui/animate-text";

// ---------------------------------------------------------------------------
// Comparison — editorial "the shift" section.
//
// Was: plain two-column table, no visual signal that one side was better.
// Now: each row is its own editorial moment. As the row scrolls into view,
//   - both texts fade in with a per-word reveal
//   - the LeaseStack ("new") line gets a cobalt underline that draws
//     left-to-right underneath it (scaleX 0 → 1, origin left, 720ms,
//     cubic-bezier 0.22, 1, 0.36, 1 — matches the pixel-point/animate-text
//     signature easing used elsewhere on the site)
//   - a numeric index pins each row visually
//   - an arrow glyph in the gutter signals direction of change (old → new)
//
// The "current stack" side stays muted and slightly smaller; the LeaseStack
// side is set bigger, in solid ink, with the animated cobalt underline. The
// rhythm makes clear which side is the resolution.
// ---------------------------------------------------------------------------

const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const ACCENT = "#2563EB";
const BORDER = "#E2E8F0";

// Drawing ease — matches `cubic-bezier(0.22, 1, 0.36, 1)` from the
// soft-blur-in / mask-reveal-up specs we already use across the site.
const EASE_DRAW = [0.22, 1, 0.36, 1] as const;

function useInViewOnce(threshold = 0.4) {
  const ref = useRef<HTMLLIElement | null>(null);
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

function ComparisonRow({
  index,
  old,
  next,
  isFirst,
}: {
  index: number;
  old: string;
  next: string;
  isFirst: boolean;
}) {
  const { ref, visible } = useInViewOnce(0.4);
  const reduce = useReducedMotion();
  const label = String(index + 1).padStart(2, "0");

  return (
    <li
      ref={ref}
      // Norman bug (2026-05-21 mobile screenshot IMG_9549): the previous
      // mobile grid `grid-cols-[auto_1fr]` with a `hidden md:flex` arrow
      // forced "With LeaseStack" copy into the narrow `auto` index
      // column on row 2, while "Today" copy stayed full-width on row 1
      // — the two halves rendered as visually unrelated narrow strips
      // with the right-hand TODAY column clipping off the viewport.
      // Mobile is now a single column where the label, Today, and With
      // LeaseStack each take their own row at full width. Desktop
      // 4-column layout (label · Today · arrow · WithLeaseStack)
      // unchanged via the md: breakpoint.
      className="grid grid-cols-1 md:grid-cols-[56px_1fr_28px_1fr] gap-x-4 md:gap-x-8 gap-y-2 py-6 md:py-10 items-start"
      style={{
        borderTop: isFirst ? "none" : `1px solid ${BORDER}`,
      }}
    >
      {/* Numeric index */}
      <div
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 700,
          color: visible ? ACCENT : MUTED,
          letterSpacing: "0.1em",
          paddingTop: 2,
          transition: "color 480ms ease",
        }}
      >
        {label}
      </div>

      {/* "Current stack" side, muted, slightly smaller. */}
      <div className="min-w-0">
        <p
          className="md:hidden mb-2"
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Today
        </p>
        <p
          style={{
            color: MUTED,
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            lineHeight: 1.55,
            letterSpacing: "-0.005em",
            fontWeight: 400,
          }}
        >
          <PerWordCrossfade trigger={visible} staggerMs={45}>
            {old}
          </PerWordCrossfade>
        </p>
      </div>

      {/* Gutter arrow, visual signal that the right side resolves the left. */}
      <div
        className="hidden md:flex items-start justify-center"
        aria-hidden="true"
        style={{ paddingTop: 6 }}
      >
        <motion.svg
          width="20"
          height="14"
          viewBox="0 0 20 14"
          fill="none"
          initial={false}
          animate={
            reduce
              ? { opacity: 1, x: 0 }
              : { opacity: visible ? 1 : 0, x: visible ? 0 : -6 }
          }
          transition={{ duration: 0.6, ease: EASE_DRAW, delay: 0.15 }}
          style={{ display: "block" }}
        >
          <path
            d="M1 7H18M18 7L12 1M18 7L12 13"
            stroke={ACCENT}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </div>

      {/* "With LeaseStack" side, solid ink, bigger, animated cobalt underline. */}
      <div className="min-w-0">
        <p
          className="md:hidden mb-2"
          style={{
            color: ACCENT,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          With LeaseStack
        </p>
        <p
          // Norman 2026-05-21: right column was at 16-18px / weight 600
          // and wrapped to 2 lines while the left "current stack" copy
          // sat on 1 line at 15px. Dropped to 15px / weight 600 +
          // slightly tighter tracking so each row fits on one line at
          // typical desktop widths. The underline still spans the line
          // since it's a block-positioned child below.
          style={{
            position: "relative",
            color: INK,
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            lineHeight: 1.5,
            letterSpacing: "-0.012em",
            fontWeight: 600,
            display: "inline-block",
          }}
        >
          <PerWordCrossfade trigger={visible} staggerMs={55}>
            {next}
          </PerWordCrossfade>
          {/* Animated cobalt underline — draws left-to-right when the row
              becomes visible. transform-origin: left + scaleX 0→1 keeps
              the draw motion crisp and GPU-accelerated. */}
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{
              scaleX: reduce ? 1 : visible ? 1 : 0,
            }}
            transition={{
              duration: reduce ? 0 : 0.72,
              // Delay until the per-word reveal has mostly resolved, so
              // the underline lands as the words settle into place.
              delay: reduce ? 0 : 0.35,
              ease: EASE_DRAW,
            }}
            style={{
              display: "block",
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -6,
              height: 2,
              backgroundColor: ACCENT,
              transformOrigin: "left center",
              willChange: "transform",
              borderRadius: 1,
            }}
          />
        </p>
      </div>
    </li>
  );
}

export function Comparison() {
  const { comparison } = MARKETING.home;

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-12 md:py-20">
        <div className="max-w-3xl mb-8 md:mb-14">
          <p className="eyebrow mb-3">{comparison.eyebrow}</p>
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
            {/* Per-line mask reveal — matches the rhythm used on the rest
                of the homepage's section headlines. */}
            <MaskRevealUp lines={splitHeadlineIntoLines(comparison.headline)} />
          </h2>
          <p
            className="mt-5 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.6,
            }}
          >
            {comparison.body}
          </p>
        </div>

        {/* Desktop column headers, typographic anchor only, not pill chips. */}
        <div
          className="hidden md:grid md:grid-cols-[56px_1fr_28px_1fr] gap-x-8 pb-4 mb-2"
          style={{ borderBottom: `1px solid ${BORDER}` }}
        >
          <span />
          <p
            style={{
              color: MUTED,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {comparison.leftLabel}
          </p>
          <span />
          <p
            style={{
              color: ACCENT,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            {comparison.rightLabel}
          </p>
        </div>

        <ol>
          {comparison.rows.map((row, i) => (
            <ComparisonRow
              key={row.new}
              index={i}
              old={row.old}
              next={row.new}
              isFirst={i === 0}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

// Split a single-sentence headline into ~two balanced lines on a sensible
// word boundary so MaskRevealUp has clean per-line targets. Falls back to
// the whole sentence as a single line if no good break point exists.
function splitHeadlineIntoLines(headline: string): string[] {
  const trimmed = headline.trim();
  // Prefer breaking on " vs. " — the natural pivot point in the current copy.
  const vsIdx = trimmed.toLowerCase().indexOf(" vs. ");
  if (vsIdx > 0) {
    return [
      trimmed.slice(0, vsIdx + 4).trim(),
      trimmed.slice(vsIdx + 4).trim(),
    ];
  }
  // Otherwise split near the midpoint on the nearest space.
  const mid = Math.floor(trimmed.length / 2);
  const before = trimmed.lastIndexOf(" ", mid);
  const after = trimmed.indexOf(" ", mid);
  const cut =
    before > 0 && after > 0
      ? mid - before < after - mid
        ? before
        : after
      : before > 0
        ? before
        : after;
  if (cut <= 0) return [trimmed];
  return [trimmed.slice(0, cut).trim(), trimmed.slice(cut).trim()];
}
