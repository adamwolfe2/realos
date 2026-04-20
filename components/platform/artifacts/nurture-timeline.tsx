"use client";

import React, { useEffect, useState } from "react";

type Touch = {
  when: string;
  kind: "email" | "chat" | "call" | "ad" | "tour";
  title: string;
  detail: string;
};

const TOUCHES: Touch[] = [
  { when: "Day 0",       kind: "chat",  title: "Chatbot conversation",    detail: "Adult daughter asked about memory care at 10pm. Captured name + email." },
  { when: "Day 1",       kind: "email", title: "Welcome + resource guide", detail: "Personalized guide: levels of care, pricing transparency, tour options." },
  { when: "Day 7",       kind: "email", title: "Family decision packet",  detail: "Conversation starters for talking with parents about the move." },
  { when: "Day 30",      kind: "call",  title: "Liaison check-in",         detail: "Warm human call from community liaison, respects the 90-day window." },
  { when: "Day 60",      kind: "ad",    title: "Retargeting — virtual tour", detail: "Calm creative on Meta. No pressure language. Compliance-reviewed." },
  { when: "Day 90",      kind: "tour",  title: "Respite stay booked",      detail: "Family booked a weekend trial stay. Transcript + all touches attached." },
  { when: "Day 112",     kind: "call",  title: "Lease signed",             detail: "Resident moved in. Referral card sent to the family that helped." },
];

const ACCENT = "#2F6FE5";
const INK = "#141413";
const MUTED = "#87867f";
const BORDER = "#f0eee6";
const PARCHMENT = "#faf9f5";

export function NurtureTimeline() {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setRevealed((r) => (r >= TOUCHES.length ? 1 : r + 1));
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(20,20,19,0.06)`,
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 md:px-6 py-4 flex items-center justify-between gap-3"
        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 600,
          }}
        >
          Family nurture · 112-day journey
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: ACCENT,
            fontWeight: 600,
          }}
        >
          7 touches · 1 human call
        </span>
      </div>

      <ol className="p-5 relative">
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "34px",
            top: "28px",
            bottom: "28px",
            width: "2px",
            background: `linear-gradient(to bottom, ${ACCENT}, #f0eee6)`,
          }}
        />
        {TOUCHES.map((t, i) => {
          const show = i < revealed;
          return (
            <li
              key={t.when}
              className="relative flex gap-4 pb-4 last:pb-0"
              style={{
                opacity: show ? 1 : 0.25,
                transform: show ? "translateX(0)" : "translateX(-8px)",
                transition: "opacity 520ms ease, transform 520ms ease",
              }}
            >
              <div
                className="flex-shrink-0 inline-flex items-center justify-center relative z-10"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  backgroundColor: show ? ACCENT : PARCHMENT,
                  color: show ? "#ffffff" : MUTED,
                  boxShadow: show ? `0 0 0 4px #ffffff` : `0 0 0 4px #ffffff, 0 0 0 5px ${BORDER}`,
                  transition: "background-color 520ms ease, color 520ms ease",
                }}
              >
                <KindIcon kind={t.kind} />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13.5px",
                      color: INK,
                      fontWeight: 600,
                    }}
                  >
                    {t.title}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: MUTED,
                      fontWeight: 500,
                    }}
                  >
                    {t.when}
                  </span>
                </div>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    color: "#5e5d59",
                    lineHeight: 1.5,
                  }}
                >
                  {t.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function KindIcon({ kind }: { kind: Touch["kind"] }) {
  const props = { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none" as const };
  switch (kind) {
    case "email":
      return (
        <svg {...props}><path d="M2 4H12V10H2V4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M2 4L7 8L12 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
      );
    case "chat":
      return (
        <svg {...props}><path d="M2 3H12V9H5L2 11V3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
      );
    case "call":
      return (
        <svg {...props}><path d="M3 3C3 3 4 5 6 7C8 9 11 10 11 10L12 8L9 7L8 8C8 8 7 7 6 6C5 5 6 4 6 4L5 2L3 3Z" fill="currentColor"/></svg>
      );
    case "ad":
      return (
        <svg {...props}><path d="M2 5H5L9 2V12L5 9H2V5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
      );
    case "tour":
      return (
        <svg {...props}><path d="M7 2L2 5V12H5V8H9V12H12V5L7 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
      );
  }
}
