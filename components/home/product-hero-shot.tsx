"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Gauge,
  LayoutDashboard,
  Users,
  Eye,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Fingerprint,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { SectionShell, LabelChip } from "./section-shell";
import { VignetteCard } from "./vignette-card";
import { MobileScreen } from "./walkthrough/mobile-screens";
import { INK, MUTED, FAINT, BORDER, BRAND } from "./walkthrough/shell";

// ---------------------------------------------------------------------------
// ProductHeroShot — [02] The dashboard your team actually opens. Juicebox
// "how it works" pattern (final structural change): a horizontal TAB STRIP
// over a split layout. LEFT = a saturated brand panel with a focused, readable
// CROP of that portal screen + one overlapping detail card; RIGHT = a label
// chip, the takeaway headline, a short body, and (last beat only) the CTA.
//
// Desktop: pinned runway, scroll advances the active tab (panel + text
// crossfade); tabs are clickable (jump the scroll). Mobile / reduced-motion /
// short viewport: unpinned stacked beats, the tab label static above each,
// reusing the compact mobile screen cards as the crops. Real tablist a11y.
// ---------------------------------------------------------------------------

const HATCH =
  "repeating-linear-gradient(45deg, #eef1f8 0, #eef1f8 1px, transparent 1px, transparent 7px)";
const PANEL_TEXTURE =
  "repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 9px)";

type Vignette = { icon: LucideIcon; title: string; meta: string };

type Beat = {
  id: string;
  tab: string;
  icon: LucideIcon;
  chip: string;
  headline: string;
  body: string;
  vignette: Vignette;
};

const BEATS: Beat[] = [
  {
    id: "briefing",
    tab: "Briefing",
    icon: Gauge,
    chip: "Monday, 7 AM",
    headline: "Your Monday brief writes itself.",
    body: "Every Monday the week that mattered lands in one place: what is ahead of pace, what has gone soft, and three actions ranked by revenue impact. Read it over coffee, act before your first call.",
    vignette: { icon: Sparkles, title: "3 actions ready", meta: "Ranked by revenue" },
  },
  {
    id: "dashboard",
    tab: "Dashboard",
    icon: LayoutDashboard,
    chip: "Attribution",
    headline: "Every lead, tour, and lease, attributed to source.",
    body: "One dashboard ties spend to signed leases, not impressions. Watch the funnel from visitor to lease and see exactly which channel earned the outcome, in real time.",
    vignette: { icon: CheckCircle2, title: "Attributed", meta: "Source to signed lease" },
  },
  {
    id: "leads",
    tab: "Leads",
    icon: Users,
    chip: "Pipeline",
    headline: "42 scored leads, with the next step already written.",
    body: "Source, budget, and the move that matters on every lead. The pipeline ranks who to call first, so nothing ages out and nothing slips.",
    vignette: { icon: CheckCircle2, title: "Lead signed", meta: "Google Ads · $68 CPL" },
  },
  {
    id: "visitors",
    tab: "Visitors",
    icon: Eye,
    chip: "No form needed",
    headline: "312 anonymous visitors, identified with intent.",
    body: "The pixel resolves a meaningful share of your traffic to a name and email, with the pages they viewed, then routes them to your CRM and ad audiences automatically.",
    vignette: { icon: Fingerprint, title: "Visitor identified", meta: "Anonymous, now named" },
  },
  {
    id: "chatbot",
    tab: "Chatbot",
    icon: MessageSquare,
    chip: "After hours",
    headline: "12 leads captured overnight, while the office was closed.",
    body: "The assistant answers from your real unit data, books tours, and sends floor plans at 2am. Hot leads are waiting for your team by morning.",
    vignette: { icon: CalendarCheck, title: "Tour booked", meta: "Sat 11:00 AM" },
  },
];

function Intro({ compact = false }: { compact?: boolean }) {
  // `compact` renders inside the pinned viewport so the section keeps its
  // heading through all five beats (before this, the heading scrolled away
  // the moment the runway pinned and the tabs floated context-free).
  return (
    <div className="max-w-[720px]">
      <LabelChip>Operator portal</LabelChip>
      <h2
        className={compact ? "mt-3" : "mt-4"}
        style={{
          color: INK,
          fontFamily: "var(--font-sans)",
          fontSize: compact ? "clamp(24px, 2.4vw, 30px)" : "clamp(28px, 3.4vw, 40px)",
          fontWeight: 500,
          lineHeight: 1.12,
          letterSpacing: "-0.025em",
        }}
      >
        The dashboard your team actually opens.
      </h2>
      <p
        className={compact ? "mt-2" : "mt-3"}
        style={{
          color: MUTED,
          fontFamily: "var(--font-sans)",
          fontSize: compact ? 15.5 : 17,
          lineHeight: 1.6,
          maxWidth: 560,
        }}
      >
        Five surfaces, one login. Scroll through the week: the brief, the
        numbers, the pipeline, the named visitors, and the overnight bookings.
      </p>
    </div>
  );
}

function BeatPanel({ beat }: { beat: number }) {
  const v = BEATS[beat].vignette;
  return (
    <div
      className="relative overflow-hidden flex items-center justify-center"
      style={{
        backgroundColor: BRAND,
        backgroundImage: PANEL_TEXTURE,
        minHeight: 400,
        padding: 26,
      }}
    >
      <div className="relative w-full" style={{ maxWidth: 540 }}>
        <div
          className="md:max-h-[380px]"
          style={{
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(22,22,22,0.08), 0 26px 52px -22px rgba(8,26,74,0.5)",
          }}
        >
          <MobileScreen beat={beat} />
        </div>
        <VignetteCard
          icon={v.icon}
          title={v.title}
          meta={v.meta}
          play={beat}
          className="absolute right-3 bottom-3 w-[236px] max-w-[70%]"
        />
      </div>
    </div>
  );
}

function BeatText({ beat, showCta }: { beat: number; showCta: boolean }) {
  const b = BEATS[beat];
  return (
    <div className="px-6 md:px-8 py-8 md:py-0 flex flex-col justify-center">
      <LabelChip>{b.chip}</LabelChip>
      <h3
        className="mt-4"
        style={{
          color: INK,
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(24px, 2.6vw, 32px)",
          fontWeight: 500,
          lineHeight: 1.18,
          letterSpacing: "-0.02em",
        }}
      >
        {b.headline}
      </h3>
      <p
        className="mt-4"
        style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 16.5, lineHeight: 1.6, maxWidth: 440 }}
      >
        {b.body}
      </p>
      {showCta ? (
        <div className="mt-6">
          <Link href="/sign-up" className="btn-primary" style={{ display: "inline-flex" }}>
            Request pilot
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function TabStrip({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (i: number, focus?: boolean) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = active;
    if (e.key === "ArrowRight") next = (active + 1) % BEATS.length;
    else if (e.key === "ArrowLeft") next = (active - 1 + BEATS.length) % BEATS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = BEATS.length - 1;
    else return;
    e.preventDefault();
    onSelect(next, true);
  };
  return (
    <div
      role="tablist"
      aria-label="Portal walkthrough"
      onKeyDown={onKeyDown}
      className="flex overflow-x-auto"
      style={{ backgroundImage: HATCH, borderBottom: `1px solid ${BORDER}` }}
    >
      {BEATS.map((b, i) => {
        const on = i === active;
        const Icon = b.icon;
        return (
          <button
            key={b.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${b.id}`}
            aria-selected={on}
            aria-controls="tour-panel"
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(i)}
            className="relative flex items-center gap-2 flex-shrink-0"
            style={{
              padding: "13px 18px",
              backgroundColor: on ? "#FFFFFF" : "transparent",
              cursor: "pointer",
              borderRight: i < BEATS.length - 1 ? `1px solid ${BORDER}` : "none",
            }}
          >
            {on ? (
              <span aria-hidden className="absolute left-0 right-0 top-0" style={{ height: 2, backgroundColor: BRAND }} />
            ) : null}
            <Icon className="w-4 h-4" strokeWidth={1.8} aria-hidden style={{ color: on ? BRAND : "#8d8d8d" }} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: on ? INK : "#5a647d",
                fontWeight: on ? 600 : 500,
              }}
            >
              {b.tab}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ScrollFlow() {
  // Juicebox pattern (Adam, 2026-07-22): the page NEVER pins. The right rail
  // of beat texts scrolls in normal document flow; the left visual (tabs +
  // crop) is position: sticky within the section and swaps as each text
  // block crosses the viewport center. Scrolling always moves something.
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);

  const onActive = useCallback((i: number) => {
    setActive((prev) => {
      if (prev === i) return prev;
      setDir(i > prev ? 1 : -1);
      return i;
    });
  }, []);

  // Active beat = the text block whose center is nearest the viewport center.
  // Plain rAF-throttled scroll math: no IntersectionObserver dead zones, the
  // visual always tracks whatever the reader is actually looking at.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestD = Infinity;
      blockRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      onActive(best);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [onActive]);

  const onSelect = useCallback((i: number) => {
    blockRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const slide = reduce ? 0 : 24;

  return (
    <div className="hidden lg:grid grid-cols-[55%_45%] gap-x-8 items-start">
      {/* LEFT — sticky visual: tab strip + the active screen crop. The sticky
          box spans the viewport (minus nav) and the panel centers inside it,
          so the visual harbors mid-screen instead of gluing to the top. */}
      <div
        className="sticky flex flex-col justify-center"
        style={{ top: 84, height: "calc(100vh - 84px)" }}
      >
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 2, overflow: "hidden" }}>
          <TabStrip active={active} onSelect={onSelect} />
          <div id="tour-panel" role="tabpanel" aria-labelledby={`tab-${BEATS[active].id}`}>
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={active}
                custom={dir}
                initial={reduce ? false : { opacity: 0, y: dir * slide }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -dir * slide }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <BeatPanel beat={active} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Progress rail. */}
        <div className="mt-5 flex items-center gap-2">
          {BEATS.map((b, i) => (
            <span
              key={b.id}
              aria-hidden
              style={{
                width: i === active ? 20 : 7,
                height: 4,
                borderRadius: 2,
                backgroundColor: i === active ? BRAND : "#d9dff0",
                transition: "all 300ms ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* RIGHT — the story, scrolling freely. */}
      <div>
        {BEATS.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => {
              blockRefs.current[i] = el;
            }}
            className="flex items-center"
            style={{ minHeight: "68vh" }}
          >
            <BeatText beat={i} showCta={i === BEATS.length - 1} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NormalFlow({ className }: { className?: string }) {
  return (
    <div className={`py-4 ${className ?? ""}`}>
      <div className="flex flex-col gap-8">
        {BEATS.map((b, i) => (
          <div key={b.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 2, overflow: "hidden" }}>
            {/* Static tab label (the strip becomes a per-beat heading). */}
            <div className="flex items-center gap-2" style={{ padding: "11px 16px", backgroundImage: HATCH, borderBottom: `1px solid ${BORDER}` }}>
              <span aria-hidden style={{ width: 2, height: 14, backgroundColor: BRAND }} />
              <b.icon className="w-4 h-4" strokeWidth={1.8} aria-hidden style={{ color: BRAND }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: INK, fontWeight: 600 }}>
                {b.tab}
              </span>
            </div>
            <BeatPanel beat={i} />
            <BeatText beat={i} showCta={i === BEATS.length - 1} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductHeroShot() {
  const reduce = useReducedMotion();

  return (
    <SectionShell id="product-tour" index="02" indexLabel="The system catches it" bg="#FFFFFF">
      <div className="py-16 md:py-20">
        <Intro />
        <div className="mt-8 md:mt-10">
          {/* Desktop: sticky-visual scroll flow. Below lg / reduced-motion:
              plain stacked beats. */}
          {reduce ? null : <ScrollFlow />}
          <NormalFlow className={reduce ? "block" : "lg:hidden"} />
        </div>
      </div>
    </SectionShell>
  );
}
