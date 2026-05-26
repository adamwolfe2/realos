"use client";

import React, { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// OverflowInbox — the hero artifact for /leads.
//
// The core thesis: every listing gets dozens of inquiries; only one closes.
// We show that visually with a live "unified inbox" stream — inquiries
// arriving from listing portals, social DMs, forms, voicemail — each tagged
// with the source, the property, and a HOT badge on a meaningful fraction.
//
// A counter in the header ticks up showing "captured this week" so the
// reader gets the scale intuitively without reading any copy.
// ---------------------------------------------------------------------------

type Source =
  | "Zillow"
  | "Realtor"
  | "Apartments.com"
  | "Instagram DM"
  | "Site form"
  | "Voicemail"
  | "Email";

type Inquiry = {
  id: number;
  initials: string;
  name: string;
  source: Source;
  property: string;
  market: string;
  ago: string;
  hot: boolean;
  color: string;
};

const POOL: Omit<Inquiry, "id" | "ago">[] = [
  { initials: "JR", name: "Jordan Reyes",     source: "Zillow",          property: "412 Elm · 2BR",           market: "Brooklyn",      hot: true,  color: "#2563EB" },
  { initials: "AM", name: "Aisha Mahmoud",    source: "Instagram DM",    property: "The Vista · PH-B",        market: "Miami",         hot: true,  color: "#5B8CE6" },
  { initials: "DC", name: "Derek Chen",       source: "Realtor",         property: "88 Greene · 1BR",         market: "Manhattan",     hot: false, color: "#94A3B8" },
  { initials: "MK", name: "Marcus Kim",       source: "Site form",       property: "Harbor Lofts · 305",      market: "Boston",        hot: true,  color: "#2563EB" },
  { initials: "EP", name: "Elena Park",       source: "Apartments.com",  property: "Riverbend · 2BR",         market: "Austin",        hot: false, color: "#5B8CE6" },
  { initials: "TG", name: "Tyler Grant",      source: "Email",           property: "The Maxwell · 1BR",       market: "Denver",        hot: true,  color: "#2563EB" },
  { initials: "SS", name: "Sofia Salinas",    source: "Zillow",          property: "Westline · studio",       market: "Seattle",       hot: false, color: "#94A3B8" },
  { initials: "RN", name: "Rohan Nair",       source: "Voicemail",       property: "8th & Hill · 3BR",        market: "Los Angeles",   hot: true,  color: "#5B8CE6" },
  { initials: "LC", name: "Lila Cohen",       source: "Site form",       property: "Parkway 220 · 2BR",       market: "Chicago",       hot: false, color: "#94A3B8" },
  { initials: "BO", name: "Ben Okafor",       source: "Instagram DM",    property: "Coastline · oceanfront",  market: "San Diego",     hot: true,  color: "#2563EB" },
  { initials: "AV", name: "Ava Vinci",        source: "Realtor",         property: "Loft 19 · live/work",     market: "Portland",      hot: false, color: "#5B8CE6" },
  { initials: "MK", name: "Mira Kapoor",      source: "Apartments.com",  property: "Birch House · 1BR",       market: "Nashville",     hot: true,  color: "#2563EB" },
];

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";
const HOT_BG = "rgba(239, 68, 68, 0.10)";
const HOT_INK = "#DC2626";

const ROTATION_MS = 2200;

export function OverflowInbox() {
  const [rows, setRows] = useState<Inquiry[]>(() =>
    POOL.slice(0, 6).map((p, i) => ({
      ...p,
      id: i,
      ago: `${(i + 1) * 2}m`,
    })),
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setRows((prev) => {
        const nextIdx = (prev[0].id + 1) % POOL.length;
        const source = POOL[nextIdx];
        const fresh: Inquiry = {
          ...source,
          id: prev[0].id + 1,
          ago: "just now",
        };
        const aged = prev.map((r, i) => ({
          ...r,
          ago:
            i === 0 ? "1m" : i === 1 ? "3m" : i === 2 ? "7m" : i === 3 ? "12m" : i === 4 ? "18m" : "26m",
        }));
        return [fresh, ...aged].slice(0, 6);
      });
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, []);

  // "Captured this week" counter that walks up smoothly so the eye locks on.
  const baseCount = 1247;
  const captured = baseCount + tick;

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(30, 42, 58,0.08)`,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-3 sm:py-4"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#10B981",
              boxShadow: "0 0 0 4px rgba(16,185,129,0.18)",
              animation: "liveDot 1.6s ease-in-out infinite",
            }}
          />
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
            Live · inquiries arriving
          </span>
        </div>
        <div className="text-right">
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "22px",
              color: INK,
              fontWeight: 500,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {captured.toLocaleString()}
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 500,
              marginTop: "3px",
            }}
          >
            Captured · this week
          </p>
        </div>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((r, i) => (
          <InquiryRow
            key={r.id}
            r={r}
            isTop={i === 0}
            isLast={i === rows.length - 1}
            hideOnMobile={i >= 4}
          />
        ))}
      </ul>

      <div
        className="px-5 md:px-6 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 500,
          }}
        >
          7 sources · 1 inbox · sorted by intent
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: ACCENT,
            fontWeight: 600,
          }}
        >
          ↗ Open inbox
        </span>
      </div>

      <style jsx>{`
        @keyframes liveDot {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.3); opacity: 0.55;}
        }
      `}</style>
    </div>
  );
}

function InquiryRow({
  r,
  isTop,
  isLast,
  hideOnMobile = false,
}: {
  r: Inquiry;
  isTop: boolean;
  isLast: boolean;
  hideOnMobile?: boolean;
}) {
  return (
    <li
      className={`${hideOnMobile ? "hidden sm:flex" : "flex"} items-center gap-3 px-5 md:px-6 py-3 sm:py-3.5`}
      style={{
        borderBottom: !isLast ? `1px solid ${BORDER}` : "none",
        animation: isTop ? "rowIn 520ms cubic-bezier(.2,.7,.2,1)" : undefined,
        backgroundColor: isTop ? "rgba(37,99,235,0.04)" : "transparent",
        transition: "background-color 1400ms ease",
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          backgroundColor: r.color,
          color: "#fff",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 600,
        }}
      >
        {r.initials}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: INK,
              fontWeight: 500,
              maxWidth: "100%",
            }}
          >
            {r.name}
          </span>
          <SourceTag source={r.source} />
          {r.hot && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: HOT_INK,
                backgroundColor: HOT_BG,
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 700,
              }}
            >
              Hot
            </span>
          )}
        </div>
        <p
          className="truncate"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "#64748B",
            marginTop: "2px",
          }}
        >
          {r.market} ·{" "}
          <span style={{ color: INK, fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>
            {r.property}
          </span>
        </p>
      </div>

      <span
        className="hidden sm:inline flex-shrink-0"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: MUTED,
          fontWeight: 500,
        }}
      >
        {r.ago}
      </span>

      <style jsx>{`
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </li>
  );
}

function SourceTag({ source }: { source: Source }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: ACCENT,
        backgroundColor: "rgba(37,99,235,0.10)",
        padding: "2px 6px",
        borderRadius: "4px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {source}
    </span>
  );
}
