"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { ProductFrame } from "./product-frame";
import { SectionShell, LabelChip } from "./section-shell";
import { Atmosphere } from "./atmosphere";
import { WalkthroughShell, APP_BG, BORDER, BRAND, INK, MUTED, FAINT } from "./walkthrough/shell";
import { ScreenBriefing } from "./walkthrough/screen-briefing";
import { ScreenDashboard } from "./walkthrough/screen-dashboard";
import { ScreenLeads } from "./walkthrough/screen-leads";
import { ScreenVisitors } from "./walkthrough/screen-visitors";
import { ScreenChatbot } from "./walkthrough/screen-chatbot";
import { MobileScreen } from "./walkthrough/mobile-screens";

// ---------------------------------------------------------------------------
// ProductHeroShot — [02] The system behind it. A TAB-DRIVEN product tour
// (round-2 redirect): the pinned portal frame advances through five real
// portal screens as you scroll. The left sidebar highlight moves like a
// click, the content pane crossfades, and each beat HOLDS on a scroll
// plateau long enough to read a takeaway popup modal.
//
// Beats: Briefing -> Dashboard -> Leads -> Visitors -> Chatbot. Screens are
// static marketing replicas of the live portal (components/home/walkthrough),
// seeded with one internally-consistent week of demo data.
//
// Reduced-motion / mobile / short viewport: normal flow, five stacked screen
// cards each with its takeaway as a static caption (mk-tour-wrap -> auto).
// ---------------------------------------------------------------------------

type Beat = {
  id: string;
  url: string;
  screen: React.ComponentType;
  takeaway: string;
};

const BEATS: Beat[] = [
  {
    id: "briefing",
    url: "app.leasestack.co/briefing",
    screen: ScreenBriefing,
    takeaway: "The Monday report writes itself. Three actions, ranked by revenue impact.",
  },
  {
    id: "dashboard",
    url: "app.leasestack.co/portal",
    screen: ScreenDashboard,
    takeaway: "No more guessing the channel. Every lead, tour, and lease traced to its source.",
  },
  {
    id: "leads",
    url: "app.leasestack.co/leads",
    screen: ScreenLeads,
    takeaway: "Nothing slips through. 42 leads scored with source, budget, and next step.",
  },
  {
    id: "visitors",
    url: "app.leasestack.co/visitors",
    screen: ScreenVisitors,
    takeaway: "312 visitors who never filled out a form, named and scored by intent.",
  },
  {
    id: "chatbot",
    url: "app.leasestack.co/chatbot",
    screen: ScreenChatbot,
    takeaway: "12 leads captured overnight, while the office was closed.",
  },
];

function Intro() {
  return (
    <>
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
        style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 17, lineHeight: 1.6, maxWidth: 540 }}
      >
        Scroll through it screen by screen. This is the real product,
        seeded with one live-shaped week of data.
      </p>
    </>
  );
}

function TakeawayModal({ beat }: { beat: number }) {
  return (
    <div className="absolute z-20 pointer-events-none" style={{ right: -6, bottom: -18, maxWidth: 300 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={beat}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 210, damping: 22 }}
          className="relative"
          style={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            padding: "13px 15px",
            boxShadow: "0 1px 2px rgba(22,22,22,0.06), 0 22px 44px -16px rgba(22,22,22,0.30)",
          }}
        >
          {/* Arrow pointing up-left into the screen. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -5,
              left: 22,
              width: 10,
              height: 10,
              backgroundColor: "#FFFFFF",
              borderLeft: `1px solid ${BORDER}`,
              borderTop: `1px solid ${BORDER}`,
              transform: "rotate(45deg)",
            }}
          />
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND }}>
            Takeaway
          </p>
          <p className="mt-1.5" style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: INK, lineHeight: 1.4 }}>
            {BEATS[beat].takeaway}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Pinned() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });
  const [beat, setBeat] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const b = p < 0.19 ? 0 : p < 0.39 ? 1 : p < 0.59 ? 2 : p < 0.79 ? 3 : 4;
    setBeat((prev) => (prev === b ? prev : b));
  });

  const Screen = BEATS[beat].screen;

  return (
    <div ref={wrapRef} className="hidden md:block relative mk-tour-wrap">
      <div className="mk-pin">
        <div className="w-full py-10">
          <Intro />

          <div className="relative mt-6">
            <div
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                bottom: -26,
                width: "78%",
                height: 130,
                background: "radial-gradient(50% 50% at 50% 50%, rgba(15,98,254,0.12), transparent 70%)",
                filter: "blur(26px)",
              }}
            />
            <ProductFrame
              url={BEATS[beat].url}
              contentStyle={{ backgroundColor: APP_BG, overflow: "hidden" }}
            >
              <WalkthroughShell active={beat}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={beat}
                    className="h-full"
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                  >
                    <Screen />
                  </motion.div>
                </AnimatePresence>
              </WalkthroughShell>
            </ProductFrame>

            <TakeawayModal beat={beat} />
          </div>

          {/* Tour progress: five dots for the five screens. */}
          <div className="mt-8 flex items-center gap-2">
            {BEATS.map((b, i) => (
              <span
                key={b.id}
                aria-hidden
                style={{
                  width: i === beat ? 20 : 7,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i === beat ? BRAND : "#d9dff0",
                  transition: "all 300ms ease",
                }}
              />
            ))}
            <span className="ml-2" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {BEATS[beat].id}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NormalFlow({ className }: { className?: string }) {
  return (
    <div className={`py-16 ${className ?? ""}`}>
      <Intro />
      <div className="mt-8 flex flex-col gap-10">
        {BEATS.map((b, i) => {
          const Screen = b.screen;
          return (
            <div key={b.id}>
              <div
                className="mb-3 inline-flex items-start gap-2"
                style={{ maxWidth: 520 }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: BRAND }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 500, color: INK, lineHeight: 1.4 }}>
                  {b.takeaway}
                </span>
              </div>
              {/* Mobile: purpose-built compact card (no cropped desktop UI). */}
              <div className="md:hidden">
                <MobileScreen beat={i} />
              </div>
              {/* Desktop fallback (reduced-motion / short viewport): full shell. */}
              <div className="hidden md:block">
                <ProductFrame url={b.url} contentStyle={{ backgroundColor: APP_BG, overflow: "hidden" }}>
                  <WalkthroughShell active={i}>
                    <Screen />
                  </WalkthroughShell>
                </ProductFrame>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProductHeroShot() {
  const reduce = useReducedMotion();
  // Only pin on tall viewports. On short ones the tour would show just its
  // first screen (screens swap, they don't stack), so fall back to the
  // stacked NormalFlow which shows all five. Defaults to tall for SSR.
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
      <div className="relative">
        <Atmosphere />
        <div className="relative">
          {pinned ? <Pinned /> : null}
          <NormalFlow className={pinned ? "md:hidden" : "block"} />
        </div>
      </div>
    </SectionShell>
  );
}
