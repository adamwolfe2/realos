"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Eyebrow, WCard, ScoreChip, INK, MUTED, FAINT, BORDER, BRAND } from "./shell";

// Replica of the Leads pipeline. Landing v3 animation pass (Adam
// 2026-07-23): leads COME IN — the table fills top-to-bottom in a staggered
// wave, every row carries its channel's color (left edge + source chip),
// and once the wave settles a fresh Google Ads lead slides in at the top
// with a "just now" pulse while the rest of the pipeline shifts down.
// Reduced-motion renders the final table immediately.

type Lead = {
  name: string;
  source: string;
  score: number;
  budget: string;
  next: string;
  age: string;
  fresh?: boolean;
};

// Channel palette — each acquisition channel keeps one color everywhere on
// this screen (edge, dot, chip).
const CHANNEL: Record<string, string> = {
  "Google Ads": "#0043ce",
  Meta: "#0f62fe",
  Organic: "#24a148",
  Referral: "#8a3ffc",
  Direct: "#6f6f6f",
};

const INITIAL: Lead[] = [
  { name: "Marcus T.", source: "Google Ads", score: 92, budget: "$1,850", next: "Call today", age: "2h" },
  { name: "Dana R.", source: "Meta", score: 84, budget: "$2,100", next: "Tour Sat 11am", age: "5h" },
  { name: "Jordan K.", source: "Organic", score: 78, budget: "$1,600", next: "Send floor plan", age: "1d" },
  { name: "Alex M.", source: "Referral", score: 71, budget: "$1,950", next: "Follow up", age: "1d" },
  { name: "Sam W.", source: "Google Ads", score: 66, budget: "$1,700", next: "Awaiting reply", age: "2d" },
  { name: "Lena P.", source: "Direct", score: 61, budget: "$2,200", next: "New", age: "3d" },
];

const INCOMING: Lead = {
  name: "Priya S.",
  source: "Google Ads",
  score: 88,
  budget: "$1,900",
  next: "Call today",
  age: "now",
  fresh: true,
};

const COLS = ["Lead", "Source", "Score", "Budget", "Next step", "Age"];
const GRID = "1.35fr 1.05fr 0.55fr 0.75fr 1.15fr 0.45fr";
const EASE = [0.2, 0.7, 0.2, 1] as const;

function SourceChip({ source }: { source: string }) {
  const c = CHANNEL[source] ?? MUTED;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: c, flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: c }}>{source}</span>
    </span>
  );
}

export function ScreenLeads() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  const [rows, setRows] = useState<Lead[]>(reduce ? [INCOMING, ...INITIAL] : INITIAL);

  // After the initial wave settles, one fresh lead arrives at the top —
  // the pipeline is alive, not a screenshot.
  useEffect(() => {
    if (reduce || !inView) return;
    const t = setTimeout(() => setRows((prev) => (prev[0]?.fresh ? prev : [INCOMING, ...prev])), 2600);
    return () => clearTimeout(t);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="h-full flex flex-col">
      <div className="flex items-end justify-between">
        <div>
          <Eyebrow>Pipeline</Eyebrow>
          <h1 className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Leads
          </h1>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
          {rows.length > INITIAL.length ? "43 active" : "42 active"} · 168 this month
        </p>
      </div>

      <WCard className="mt-3 flex-1 min-h-0" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: GRID,
            padding: "9px 14px",
            borderBottom: `1px solid ${BORDER}`,
            backgroundColor: "#fbfcfe",
          }}
        >
          {COLS.map((c) => (
            <span key={c} style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>
              {c}
            </span>
          ))}
        </div>
        <div className="flex-1" style={{ overflow: "hidden" }}>
          <AnimatePresence initial={false}>
            {rows.map((l, i) => {
              const c = CHANNEL[l.source] ?? MUTED;
              // Initial wave staggers top-to-bottom; the inserted row
              // animates via its own entry.
              const waveDelay = l.fresh ? 0 : reduce ? 0 : 0.15 + i * 0.16;
              return (
                <motion.div
                  key={l.name}
                  layout={!reduce}
                  initial={reduce ? false : l.fresh ? { opacity: 0, y: -22 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: on ? 1 : 0, y: on ? 0 : 10 }}
                  transition={{ duration: 0.45, ease: EASE, delay: waveDelay }}
                  className="relative grid items-center"
                  style={{
                    gridTemplateColumns: GRID,
                    padding: "10px 14px 10px 12px",
                    borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
                    backgroundColor: l.fresh ? "rgba(15,98,254,0.05)" : "transparent",
                    transition: "background-color 1600ms ease",
                  }}
                >
                  {/* Channel edge — the lead arrives wearing its source color. */}
                  <span aria-hidden style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, borderRadius: 2, backgroundColor: c }} />
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: `${c}14`, color: c, fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600 }}
                    >
                      {l.name.charAt(0)}
                    </span>
                    <span className="truncate" style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: INK }}>
                      {l.name}
                    </span>
                    {l.fresh ? (
                      <motion.span
                        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.25 }}
                        style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FFFFFF", backgroundColor: BRAND, borderRadius: 2, padding: "1px 5px", whiteSpace: "nowrap" }}
                      >
                        New
                      </motion.span>
                    ) : null}
                  </span>
                  <SourceChip source={l.source} />
                  <span><ScoreChip score={l.score} /></span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: INK, fontVariantNumeric: "tabular-nums" }}>{l.budget}</span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: INK }}>{l.next}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: l.fresh ? BRAND : FAINT, fontWeight: l.fresh ? 700 : 400 }}>{l.age}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </WCard>
    </div>
  );
}
