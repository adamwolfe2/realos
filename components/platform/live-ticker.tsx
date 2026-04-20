"use client";

import React, { useEffect, useState } from "react";

type Event = {
  kind: "lease" | "tour" | "lead" | "identify" | "ad" | "ai" | "report";
  text: string;
  where?: string;
};

const EVENTS: Event[] = [
  { kind: "lease",    text: "Priya V. signed a lease",              where: "Oak Grove · 2BR" },
  { kind: "tour",     text: "Maya R. booked a tour",                where: "Telegraph Commons · Sat 10:30" },
  { kind: "lead",     text: "Daniel L. came from a Meta ad",        where: "intent score 88" },
  { kind: "identify", text: "12 new identified visitors",           where: "last hour" },
  { kind: "ai",       text: "ChatGPT cited your Berkeley page",     where: "student housing query" },
  { kind: "ad",       text: "New Meta creative 'Fall Move-in' shipped", where: "48h turnaround" },
  { kind: "lease",    text: "Alejandra S. signed a lease",          where: "Park & Pearl · 1BR" },
  { kind: "tour",     text: "Jordan K. booked a virtual tour",      where: "Sage at Greenpoint" },
  { kind: "identify", text: "Sofia P. identified from LinkedIn",    where: "viewed 3 floor plans" },
  { kind: "ai",       text: "Perplexity quoted your amenities page", where: "furnished housing query" },
  { kind: "report",   text: "Monday owner report delivered",        where: "168 leads · 31 tours · 4 leases" },
  { kind: "lead",     text: "Ravi K. captured by AI chatbot",       where: "asking about move-in dates" },
];

const ACCENT = "#2F6FE5";
const INK = "#141413";
const MUTED = "#87867f";
const BORDER = "#f0eee6";

export function LiveTicker() {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (dismissed) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % EVENTS.length);
    }, 4200);
    return () => clearInterval(id);
  }, [dismissed]);

  if (dismissed) return null;
  const event = EVENTS[idx];

  return (
    <div
      aria-live="polite"
      className="fixed z-40 pointer-events-none"
      style={{
        bottom: "20px",
        left: "20px",
        maxWidth: "calc(100vw - 40px)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 520ms ease, transform 520ms ease",
      }}
    >
      <div
        className="pointer-events-auto flex items-start gap-3"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          boxShadow: `0 0 0 1px ${BORDER}, 0 20px 40px rgba(20,20,19,0.08)`,
          padding: "12px 14px 12px 12px",
          minWidth: "280px",
          maxWidth: "360px",
        }}
      >
        <span
          className="flex-shrink-0 inline-flex items-center justify-center"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            backgroundColor: "rgba(47,111,229,0.10)",
            color: ACCENT,
          }}
        >
          <KindIcon kind={event.kind} />
        </span>

        <div className="flex-1 min-w-0" key={idx}>
          <div className="flex items-center gap-2">
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: ACCENT,
                display: "inline-block",
                animation: "tickerPulse 1.4s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: MUTED,
                fontWeight: 600,
              }}
            >
              Live · right now
            </span>
          </div>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: INK,
              fontWeight: 500,
              lineHeight: 1.3,
              animation: "tickerIn 420ms ease",
            }}
          >
            {event.text}
          </p>
          {event.where ? (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11.5px",
                color: MUTED,
                marginTop: "2px",
                lineHeight: 1.3,
                animation: "tickerIn 420ms ease",
              }}
            >
              {event.where}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Dismiss live ticker"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0"
          style={{
            background: "transparent",
            border: "none",
            color: MUTED,
            cursor: "pointer",
            padding: "2px",
            lineHeight: 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <style jsx>{`
        @keyframes tickerPulse {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.4); opacity: 0.5; }
        }
        @keyframes tickerIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function KindIcon({ kind }: { kind: Event["kind"] }) {
  const p = { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (kind) {
    case "lease":    return <svg {...p}><path d="M2 7L7 3L12 7V12H8V9H6V12H2V7Z" /></svg>;
    case "tour":     return <svg {...p}><rect x="2" y="3" width="10" height="9" rx="1.5"/><path d="M2 6h10M5 2v2M9 2v2"/></svg>;
    case "lead":     return <svg {...p}><circle cx="7" cy="5" r="2.4"/><path d="M2.5 12c.5-2.2 2.4-3.8 4.5-3.8s4 1.6 4.5 3.8"/></svg>;
    case "identify": return <svg {...p}><circle cx="7" cy="7" r="4"/><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>;
    case "ad":       return <svg {...p}><path d="M2 5H5L9 2V12L5 9H2V5Z" /></svg>;
    case "ai":       return <svg {...p}><path d="M7 1.5L8.4 5L12 6L8.4 7L7 10.5L5.6 7L2 6L5.6 5L7 1.5Z" fill="currentColor" stroke="none"/></svg>;
    case "report":   return <svg {...p}><path d="M3 11V3h8v8H3Zm2-4h4M5 9h4M5 5h3"/></svg>;
  }
}
