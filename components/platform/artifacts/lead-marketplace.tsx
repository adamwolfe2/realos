"use client";

import React, { useMemo, useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// LeadMarketplace — the third interactive demo for /leads.
//
// A live buyer-side marketplace browser. Lets the visitor click filters
// (market, property type, intent floor, price band) and watch a grid of
// available leads filter in real time. Each card shows masked PII, a
// composite intent score, the property/market context, and a price.
//
// A floating "Just purchased" ticker drifts in at the top to make the
// marketplace feel alive without requiring user input.
//
// This component is purely visual — no network calls, no PII. It's the
// page's "see how the buy-side works" interaction and is what we'd build
// out into the actual portal feature if the marketing page validates.
// ---------------------------------------------------------------------------

type PropertyType = "Rental" | "Sale" | "Investment" | "Commercial";

type LeadCard = {
  id: string;
  initials: string;
  name: string;
  age: number;
  market: string;
  propertyType: PropertyType;
  intent: number;
  budget: string;
  signal: string;
  timeline: string;
  priceCents: number;
};

const ALL_MARKETS = ["All markets", "New York", "Miami", "Los Angeles", "Chicago", "Austin", "Boston", "Denver"];
const ALL_TYPES: ("All" | PropertyType)[] = ["All", "Rental", "Sale", "Investment", "Commercial"];
const PRICE_BANDS = [
  { label: "Any", min: 0,    max: Infinity },
  { label: "Under $50",  min: 0,  max: 5000  },
  { label: "$50–$100",   min: 5000, max: 10000 },
  { label: "$100+",      min: 10000, max: Infinity },
];

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const SLATE = "#64748B";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";

const LEADS: LeadCard[] = [
  { id: "LD-91428", initials: "MR", name: "Marisol R.",   age: 34, market: "New York",    propertyType: "Sale",       intent: 92, budget: "$680K – $920K", signal: "Viewed 23 listings · 7d", timeline: "0–30 days",  priceCents: 9500 },
  { id: "LD-87311", initials: "DK", name: "Derek K.",     age: 41, market: "Miami",       propertyType: "Sale",       intent: 88, budget: "$1.4M – $2.1M", signal: "Mortgage pre-app · 3d",   timeline: "30–60 days", priceCents: 12000 },
  { id: "LD-77205", initials: "AS", name: "Aisha S.",     age: 28, market: "Los Angeles", propertyType: "Rental",     intent: 81, budget: "$3.8K – $5.2K/mo", signal: "5 tours scheduled",      timeline: "0–14 days",  priceCents: 4500 },
  { id: "LD-69118", initials: "TG", name: "Tyler G.",     age: 38, market: "Austin",      propertyType: "Investment", intent: 85, budget: "$420K – $620K", signal: "Cash buyer signal · 9d",  timeline: "0–45 days",  priceCents: 8500 },
  { id: "LD-64902", initials: "RN", name: "Rohan N.",     age: 45, market: "Boston",      propertyType: "Sale",       intent: 76, budget: "$1.1M – $1.6M", signal: "Relocation · job offer",  timeline: "30–90 days", priceCents: 7500 },
  { id: "LD-61744", initials: "LC", name: "Lila C.",      age: 31, market: "Chicago",     propertyType: "Rental",     intent: 79, budget: "$2.6K – $3.8K/mo", signal: "Lease ending in 21d",    timeline: "0–21 days",  priceCents: 3500 },
  { id: "LD-58221", initials: "BO", name: "Ben O.",       age: 52, market: "Denver",      propertyType: "Investment", intent: 84, budget: "$580K – $820K", signal: "Distressed-property search", timeline: "0–60 days", priceCents: 7500 },
  { id: "LD-55670", initials: "EP", name: "Elena P.",     age: 36, market: "New York",    propertyType: "Rental",     intent: 90, budget: "$5.8K – $7.4K/mo", signal: "Viewed 31 listings · 5d", timeline: "0–14 days",  priceCents: 5500 },
  { id: "LD-52109", initials: "JR", name: "Jordan R.",    age: 29, market: "Miami",       propertyType: "Rental",     intent: 73, budget: "$2.2K – $3.1K/mo", signal: "Out-of-state mover · 11d", timeline: "30–60 days", priceCents: 3500 },
  { id: "LD-49882", initials: "MK", name: "Mira K.",      age: 47, market: "Los Angeles", propertyType: "Sale",       intent: 87, budget: "$2.8M – $3.6M", signal: "Luxury · agent-matched",  timeline: "0–45 days",  priceCents: 12000 },
  { id: "LD-47332", initials: "AV", name: "Ava V.",       age: 33, market: "Austin",      propertyType: "Commercial", intent: 78, budget: "$8K – $14K/mo NNN", signal: "Office tenant rep brief", timeline: "30–90 days", priceCents: 9500 },
  { id: "LD-44021", initials: "SS", name: "Sofia S.",     age: 39, market: "Boston",      propertyType: "Investment", intent: 82, budget: "$320K – $480K", signal: "1031 exchange · pending",  timeline: "0–45 days",  priceCents: 8500 },
];

const PURCHASE_TICKER = [
  "Agent in Brooklyn just streamed 6 leads",
  "Brokerage in Miami purchased LD-87311",
  "Investor in Denver streamed 3 leads",
  "Agent in Austin purchased LD-69118",
  "Team in LA streamed 12 leads",
  "Agent in Boston purchased LD-64902",
];

export function LeadMarketplace() {
  const [market, setMarket] = useState(ALL_MARKETS[0]);
  const [propertyType, setPropertyType] = useState<"All" | PropertyType>("All");
  const [minIntent, setMinIntent] = useState(70);
  const [priceBand, setPriceBand] = useState(PRICE_BANDS[0].label);
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTickerIdx((i) => (i + 1) % PURCHASE_TICKER.length), 3600);
    return () => clearInterval(t);
  }, []);

  const band = PRICE_BANDS.find((b) => b.label === priceBand)!;
  const filtered = useMemo(() => {
    return LEADS.filter((l) => {
      if (market !== ALL_MARKETS[0] && l.market !== market) return false;
      if (propertyType !== "All" && l.propertyType !== propertyType) return false;
      if (l.intent < minIntent) return false;
      if (l.priceCents < band.min || l.priceCents > band.max) return false;
      return true;
    });
  }, [market, propertyType, minIntent, band.min, band.max]);

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 24px 70px rgba(30, 42, 58,0.10)`,
        overflow: "hidden",
      }}
    >
      {/* Header + live ticker */}
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-3.5"
        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block flex-shrink-0"
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
            className="truncate"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: SLATE,
              fontWeight: 600,
              transition: "opacity 360ms ease",
            }}
            key={tickerIdx}
          >
            {PURCHASE_TICKER[tickerIdx]}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 600,
          }}
        >
          {filtered.length} available
        </span>
      </div>

      {/* Filter rail + grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr]">
        <aside
          className="p-5 md:p-6"
          style={{
            borderRight: `1px solid ${BORDER}`,
            backgroundColor: "#FCFCFD",
          }}
        >
          <FilterGroup label="Market">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="filter-select"
            >
              {ALL_MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Property type">
            <div className="flex flex-wrap gap-1.5">
              {ALL_TYPES.map((t) => (
                <FilterPill
                  key={t}
                  active={propertyType === t}
                  onClick={() => setPropertyType(t)}
                  label={t}
                />
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label={`Intent ≥ ${minIntent}`}>
            <input
              type="range"
              min={50}
              max={95}
              step={1}
              value={minIntent}
              onChange={(e) => setMinIntent(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: ACCENT,
              }}
            />
            <div
              className="flex justify-between mt-1.5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: MUTED,
                letterSpacing: "0.08em",
              }}
            >
              <span>50</span>
              <span>95</span>
            </div>
          </FilterGroup>

          <FilterGroup label="Price per lead">
            <div className="flex flex-wrap gap-1.5">
              {PRICE_BANDS.map((b) => (
                <FilterPill
                  key={b.label}
                  active={priceBand === b.label}
                  onClick={() => setPriceBand(b.label)}
                  label={b.label}
                />
              ))}
            </div>
          </FilterGroup>

          <div
            className="mt-6 p-3 rounded-md"
            style={{
              backgroundColor: PARCHMENT,
              border: `1px dashed ${BORDER}`,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: ACCENT,
                fontWeight: 700,
              }}
            >
              Stream subscription
            </p>
            <p
              className="mt-1.5"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: SLATE,
                lineHeight: 1.45,
              }}
            >
              Auto-purchase every new lead matching these filters. Delivered
              to your CRM by webhook within seconds of scoring.
            </p>
          </div>
        </aside>

        <div className="p-5 md:p-6">
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.slice(0, 6).map((l) => (
                <LeadCardView key={l.id} lead={l} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes liveDot {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.3); opacity: 0.55;}
        }
        .filter-select {
          width: 100%;
          appearance: none;
          background-color: #fff;
          border: 1px solid ${BORDER};
          border-radius: 8px;
          padding: 8px 12px;
          font-family: var(--font-sans);
          font-size: 13px;
          color: ${INK};
          font-weight: 500;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394A3B8' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 28px;
        }
      `}</style>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <p
        className="mb-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: 500,
        padding: "5px 10px",
        borderRadius: "999px",
        border: `1px solid ${active ? ACCENT : BORDER}`,
        backgroundColor: active ? ACCENT : "#fff",
        color: active ? "#fff" : INK,
        cursor: "pointer",
        transition: "all 180ms ease",
      }}
    >
      {label}
    </button>
  );
}

function LeadCardView({ lead }: { lead: LeadCard }) {
  return (
    <li
      className="p-4 h-full"
      style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        boxShadow: `0 0 0 1px ${BORDER}`,
        transition: "box-shadow 200ms ease, transform 200ms ease",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: ACCENT,
              color: "#fff",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {lead.initials}
          </span>
          <div className="min-w-0">
            <p
              className="truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: INK,
                fontWeight: 600,
              }}
            >
              {lead.name} · {lead.age}
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: MUTED,
                marginTop: "2px",
                fontWeight: 500,
              }}
            >
              {lead.id} · {lead.market}
            </p>
          </div>
        </div>
        <IntentDot value={lead.intent} />
      </div>

      <dl className="mt-3 space-y-1.5">
        <Row label="Type" value={lead.propertyType} />
        <Row label="Budget" value={lead.budget} />
        <Row label="Signal" value={lead.signal} />
        <Row label="Timeline" value={lead.timeline} strong />
      </dl>

      <div
        className="mt-3 pt-3 flex items-center justify-between gap-3"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            color: INK,
            fontWeight: 500,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ${(lead.priceCents / 100).toFixed(0)}
        </span>
        <button
          type="button"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: "8px",
            backgroundColor: ACCENT,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            transition: "background-color 180ms ease",
          }}
        >
          Buy lead →
        </button>
      </div>
    </li>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 600,
        }}
      >
        {label}
      </dt>
      <dd
        className="truncate"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: strong ? "12.5px" : "12px",
          color: strong ? ACCENT : INK,
          fontWeight: strong ? 600 : 500,
          maxWidth: "65%",
          textAlign: "right",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function IntentDot({ value }: { value: number }) {
  const tone =
    value >= 85
      ? { bg: "rgba(16,185,129,0.14)", fg: "#059669" }
      : value >= 75
        ? { bg: "rgba(37,99,235,0.14)", fg: ACCENT }
        : { bg: "rgba(245,158,11,0.14)", fg: "#D97706" };
  return (
    <span
      className="inline-flex items-center gap-1 flex-shrink-0"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        color: tone.fg,
        backgroundColor: tone.bg,
        padding: "3px 7px",
        borderRadius: "999px",
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}>{value}</span>
      <span style={{ opacity: 0.75 }}>INTENT</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
      style={{
        backgroundColor: PARCHMENT,
        borderRadius: "12px",
        border: `1px dashed ${BORDER}`,
        minHeight: "260px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          color: INK,
          fontWeight: 500,
        }}
      >
        No leads match these filters right now.
      </p>
      <p
        className="mt-2 max-w-[320px]"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: SLATE,
          lineHeight: 1.5,
        }}
      >
        Subscribe to this filter set as a stream — we'll route every matching
        lead to your inbox the moment one scores.
      </p>
      <button
        type="button"
        className="mt-4"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12.5px",
          fontWeight: 600,
          padding: "8px 14px",
          borderRadius: "8px",
          backgroundColor: ACCENT,
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
      >
        Start a stream
      </button>
    </div>
  );
}
