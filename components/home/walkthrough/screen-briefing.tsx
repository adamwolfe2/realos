"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Sparkles, TrendingUp, TrendingDown, MessageSquare, ArrowRight } from "lucide-react";
import { Eyebrow, WCard, Delta, INK, MUTED, FAINT, BORDER, BRAND } from "./shell";

// Replica of the AI Briefing screen. Landing v3 animation pass (Adam
// 2026-07-23): the solid blue actions block is gone — every insight and
// every recommendation ROLLS IN on its own beat, like the briefing being
// written in front of you. Insights slide from the left with their delta
// popping in; the three actions land as individual cards from the right,
// each with a numbered chip that springs; the live AEO toast arrives last.
// Reduced-motion renders the final state immediately.

const INSIGHTS = [
  {
    icon: TrendingUp,
    dir: "up" as const,
    delta: "14%",
    title: "Oak Grove is ahead of pace",
    body: "Google Ads is driving 40% of signed leases this cycle.",
  },
  {
    icon: TrendingDown,
    dir: "down" as const,
    delta: "32%",
    title: "Riverside is soft this week",
    body: "Tour bookings dropped. The 2-bed creative needs a refresh.",
  },
  {
    icon: MessageSquare,
    dir: "up" as const,
    delta: "12",
    title: "Chatbot captured 12 leads overnight",
    body: "Three flagged high-intent, ready for a morning call.",
  },
];

const ACTIONS = [
  { tag: "Spend", text: "Shift $600 from Meta into Google Ads." },
  { tag: "Creative", text: "Refresh the Riverside 2-bed creative." },
  { tag: "Workflow", text: "Approve the after-hours chatbot follow-up." },
];

const EASE = [0.2, 0.7, 0.2, 1] as const;

export function ScreenBriefing() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;
  const d = (t: number) => (reduce ? 0 : t);

  return (
    <div ref={ref} className="h-full flex flex-col" style={{ position: "relative" }}>
      <motion.div
        initial={false}
        animate={{ opacity: on ? 1 : 0, y: on ? 0 : 8 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: BRAND }} aria-hidden />
          <Eyebrow>AI briefing · Monday, 7:02 AM</Eyebrow>
        </div>
        <h1
          className="mt-1.5"
          style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}
        >
          Good morning, Sample Portfolio
        </h1>
        <p className="mt-1 inline-flex items-center gap-2" style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: MUTED }}>
          Leasing up <Delta value="14%" dir="up" /> week over week. Here is what moved.
        </p>
      </motion.div>

      <div className="grid grid-cols-5 gap-3 mt-4 flex-1 min-h-0">
        {/* Insights — each rolls in from the left on its own beat. */}
        <div className="col-span-3">
          <WCard style={{ height: "100%", padding: 0, overflow: "hidden" }}>
            {INSIGHTS.map((it, i) => {
              const Icon = it.icon;
              const delay = d(0.25 + i * 0.3);
              return (
                <motion.div
                  key={it.title}
                  className="flex items-start gap-3"
                  initial={false}
                  animate={{ opacity: on ? 1 : 0, x: on ? 0 : -16 }}
                  transition={{ duration: 0.45, ease: EASE, delay }}
                  style={{ padding: "13px 15px", borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 2, backgroundColor: "rgba(15,98,254,0.08)", color: BRAND }}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <motion.span
                        initial={false}
                        animate={{ scale: on ? 1 : 0.6, opacity: on ? 1 : 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 22, delay: delay + 0.2 }}
                        style={{ display: "inline-flex" }}
                      >
                        <Delta value={it.delta} dir={it.dir} />
                      </motion.span>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: INK }}>
                        {it.title}
                      </span>
                    </div>
                    <p className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>
                      {it.body}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </WCard>
        </div>

        {/* This week's actions — individual cards, not a blue slab. Each one
            lands from the right with its number chip springing in. */}
        <div className="col-span-2 flex flex-col gap-2.5">
          <motion.p
            initial={false}
            animate={{ opacity: on ? 1 : 0 }}
            transition={{ duration: 0.3, delay: d(0.9) }}
            style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: BRAND }}
          >
            This week · 3 actions
          </motion.p>
          {ACTIONS.map((a, i) => {
            const delay = d(1.0 + i * 0.28);
            return (
              <motion.div
                key={a.text}
                initial={false}
                animate={{ opacity: on ? 1 : 0, x: on ? 0 : 20 }}
                transition={{ duration: 0.45, ease: EASE, delay }}
                className="flex items-start gap-2.5 flex-1"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: `1px solid ${BORDER}`,
                  borderLeft: `2px solid ${BRAND}`,
                  borderRadius: 2,
                  padding: "10px 12px",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                }}
              >
                <motion.span
                  initial={false}
                  animate={{ scale: on ? 1 : 0.4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: delay + 0.15 }}
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: "rgba(15,98,254,0.1)", color: BRAND, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700 }}
                >
                  {i + 1}
                </motion.span>
                <div className="min-w-0">
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>
                    {a.tag}
                  </p>
                  <p className="mt-0.5" style={{ fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: 1.4, color: INK, fontWeight: 500 }}>
                    {a.text}
                  </p>
                </div>
              </motion.div>
            );
          })}
          <motion.div
            initial={false}
            animate={{ opacity: on ? 1 : 0 }}
            transition={{ duration: 0.3, delay: d(1.9) }}
            className="flex items-center gap-1"
            style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: BRAND, fontWeight: 600 }}
          >
            Approve all <ArrowRight className="w-3 h-3" strokeWidth={2} aria-hidden />
          </motion.div>
        </div>
      </div>

      {/* Live AEO toast — arrives last, springs up from the corner. */}
      <motion.div
        className="inline-flex items-center gap-2"
        initial={false}
        animate={{ opacity: on ? 1 : 0, y: on ? 0 : 12, scale: on ? 1 : 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 24, delay: d(2.15) }}
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          borderRadius: 2,
          padding: "7px 11px",
          boxShadow: "0 8px 20px -10px rgba(22,22,22,0.2)",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: BRAND }}>LIVE</span>
        <span style={{ width: 1, height: 11, backgroundColor: BORDER }} />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: MUTED }}>
          Perplexity quoted your amenities page
        </span>
      </motion.div>
    </div>
  );
}
