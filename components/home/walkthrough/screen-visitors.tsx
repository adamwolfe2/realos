"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Building2 } from "lucide-react";
import { Eyebrow, WCard, INK, MUTED, FAINT, BORDER, BRAND, UP } from "./shell";

// Replica of the Visitors screen. Landing v3 animation pass (Adam
// 2026-07-23): the reveal IS the demo — same mechanic as the product's
// visitor-pixel page (components/platform/artifacts/visitor-stream): every
// row lands as an anonymous dashed "?" and flips (3D) to a real face with
// a blue reveal pulse and a "Just identified" flash, in a staggered wave.
// Companies resolve to their org chip instead of a face. Reduced-motion
// renders everyone identified immediately.

type Row = {
  name: string;
  company?: boolean;
  photo?: string;
  intent: string;
  pages: number;
  source: string;
  when: string;
  revealAt: number; // ms after the screen enters view
};

// Portraits: randomuser.me — same stable CDN the product demo uses.
const VISITORS: Row[] = [
  { name: "Taylor B.", photo: "https://randomuser.me/api/portraits/women/22.jpg", intent: "Viewed 3-bed floor plans", pages: 4, source: "Google", when: "6m ago", revealAt: 500 },
  { name: "Northside Realty", company: true, intent: "Pricing + amenities", pages: 7, source: "Direct", when: "22m ago", revealAt: 950 },
  { name: "Chris D.", photo: "https://randomuser.me/api/portraits/men/85.jpg", intent: "Application page, twice", pages: 5, source: "Meta", when: "48m ago", revealAt: 1400 },
  { name: "Morgan L.", photo: "https://randomuser.me/api/portraits/women/45.jpg", intent: "Toured availability calendar", pages: 3, source: "Organic", when: "1h ago", revealAt: 1850 },
  { name: "Beacon Partners", company: true, intent: "Compared two properties", pages: 9, source: "Referral", when: "2h ago", revealAt: 2300 },
];

const EASE = [0.2, 0.7, 0.2, 1] as const;

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function VisitorRow({ v, i, start }: { v: Row; i: number; start: boolean }) {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(!!reduce);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (reduce) {
      setRevealed(true);
      return;
    }
    if (!start) return;
    const t1 = setTimeout(() => {
      setRevealed(true);
      setFlash(true);
    }, v.revealAt);
    const t2 = setTimeout(() => setFlash(false), v.revealAt + 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [start, reduce, v.revealAt]);

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={false}
      animate={{ opacity: start || reduce ? 1 : 0, y: start || reduce ? 0 : 10 }}
      transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : i * 0.09 }}
      style={{ padding: "12px 15px", borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}
    >
      {/* Avatar — flips from dashed "?" to the face (or org mark). */}
      <span className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, perspective: "400px" }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: v.company ? 2 : 999,
            overflow: "hidden",
            transformStyle: "preserve-3d",
            transition: "transform 550ms cubic-bezier(.4,0,.2,1)",
            transform: revealed ? "rotateY(0deg)" : "rotateY(180deg)",
          }}
        >
          {v.photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={v.photo}
              alt={v.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, backfaceVisibility: "hidden" }}
            />
          ) : (
            <span
              className="flex items-center justify-center"
              style={{ position: "absolute", inset: 0, backgroundColor: "rgba(15,98,254,0.08)", color: BRAND, backfaceVisibility: "hidden" }}
            >
              {v.company ? (
                <Building2 className="w-4 h-4" strokeWidth={1.7} aria-hidden />
              ) : (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>{initials(v.name)}</span>
              )}
            </span>
          )}
        </span>
        {/* Anonymous face (visible until reveal). */}
        <span
          className="flex items-center justify-center"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: v.company ? 2 : 999,
            backgroundColor: "#f4f4f4",
            border: `1px dashed ${FAINT}`,
            color: FAINT,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 600,
            opacity: revealed ? 0 : 1,
            transition: "opacity 250ms ease",
            pointerEvents: "none",
          }}
        >
          ?
        </span>
        {flash ? (
          <span
            aria-hidden
            style={{ position: "absolute", inset: -4, borderRadius: 999, border: `2px solid ${BRAND}`, animation: "wRevealPulse 1.3s ease-out", pointerEvents: "none" }}
          />
        ) : null}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: revealed ? INK : MUTED, transition: "color 350ms ease" }}>
            {revealed ? v.name : "Anonymous visitor"}
          </span>
          {revealed ? (
            v.company ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: UP, backgroundColor: "rgba(36,161,72,0.10)", borderRadius: 2, padding: "1px 6px" }}>
                Company
              </span>
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: flash ? "#FFFFFF" : BRAND,
                  backgroundColor: flash ? BRAND : "rgba(15,98,254,0.12)",
                  borderRadius: 2,
                  padding: "1px 6px",
                  transition: "all 500ms ease",
                  whiteSpace: "nowrap",
                }}
              >
                {flash ? "Just identified" : "Identified"}
              </span>
            )
          ) : (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: FAINT }}>
              Anonymous
            </span>
          )}
        </div>
        <p className="mt-0.5" style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: MUTED }}>{v.intent}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: INK, fontVariantNumeric: "tabular-nums" }}>{v.pages} pages</p>
        <p className="mt-0.5" style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: FAINT }}>
          {v.source} · {v.when}
        </p>
      </div>
    </motion.div>
  );
}

export function ScreenVisitors() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const start = reduce ? true : inView;

  return (
    <div ref={ref} className="h-full flex flex-col">
      <div className="flex items-end justify-between">
        <div>
          <Eyebrow>Visitor identification</Eyebrow>
          <h1 className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Visitors
          </h1>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
          312 identified this month
        </p>
      </div>

      <WCard className="mt-3 flex-1 min-h-0" style={{ padding: 0, overflow: "hidden" }}>
        {VISITORS.map((v, i) => (
          <VisitorRow key={v.name} v={v} i={i} start={start} />
        ))}
      </WCard>

      <style jsx>{`
        @keyframes wRevealPulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          70% { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
