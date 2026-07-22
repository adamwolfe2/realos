"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
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

function Intro() {
  return (
    <div className="max-w-[720px]">
      <LabelChip>Operator portal</LabelChip>
      <h2
        className="mt-4"
        style={{
          color: INK,
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(28px, 3.4vw, 40px)",
          fontWeight: 500,
          lineHeight: 1.12,
          letterSpacing: "-0.025em",
        }}
      >
        The dashboard your team actually opens.
      </h2>
      <p
        className="mt-3"
        style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 17, lineHeight: 1.6, maxWidth: 560 }}
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

function Pinned() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const b = p < 0.19 ? 0 : p < 0.39 ? 1 : p < 0.59 ? 2 : p < 0.79 ? 3 : 4;
    setActive((prev) => {
      if (prev === b) return prev;
      setDir(b > prev ? 1 : -1);
      return b;
    });
  });

  const onSelect = useCallback((i: number) => {
    setDir(i > active ? 1 : -1);
    setActive(i);
    const el = wrapRef.current;
    if (!el) return;
    const rectTop = el.getBoundingClientRect().top + window.scrollY;
    const scrollable = el.offsetHeight - window.innerHeight;
    const y = rectTop + ((i + 0.5) / BEATS.length) * Math.max(0, scrollable);
    window.scrollTo({ top: y, behavior: "smooth" });
  }, [active]);

  const slide = reduce ? 0 : 24;

  return (
    <div ref={wrapRef} className="hidden md:block relative mk-tour-wrap">
      <div className="mk-pin">
        <div className="w-full py-8">
          {/* Hairline-framed section: tab strip + split panel. */}
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 2, overflow: "hidden" }}>
            <TabStrip active={active} onSelect={onSelect} />
            <div id="tour-panel" role="tabpanel" aria-labelledby={`tab-${BEATS[active].id}`}>
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={active}
                  custom={dir}
                  initial={reduce ? false : { opacity: 0, x: dir * slide }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: -dir * slide }}
                  transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                  className="grid grid-cols-1 lg:grid-cols-[55%_45%]"
                >
                  <BeatPanel beat={active} />
                  <BeatText beat={active} showCta={active === BEATS.length - 1} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Progress rail. */}
          <div className="mt-6 flex items-center gap-2">
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
  const [tall, setTall] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-height: 760px)");
    const on = () => setTall(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  const pinned = !reduce && tall;

  return (
    <SectionShell id="product-tour" index="02" indexLabel="The system catches it" bg="#FFFFFF">
      <div className="py-16 md:py-20">
        <Intro />
        <div className="mt-8">
          {pinned ? <Pinned /> : null}
          <NormalFlow className={pinned ? "md:hidden" : "block"} />
        </div>
      </div>
    </SectionShell>
  );
}
