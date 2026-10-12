"use client";

import React, { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// OverflowInbox — the hero artifact for /leads.
//
// Every row carries a source tag (Zillow / Realtor / Instagram
// DM / Apartments.com / Site form / Voicemail / Email) and the property
// the inquiry was about. That's the "every inquiry, every source, one
// inbox" story.
// ---------------------------------------------------------------------------

type Source =
  | "Zillow"
  | "Realtor"
  | "Apartments.com"
  | "Instagram DM"
  | "Site form"
  | "Voicemail"
  | "Email";

type Identity = {
  initials: string;
  name: string;
  market: string;
  property: string;
  source: Source;
  hot: boolean;
  color: string;
  photo: string;
};

type Inquiry = {
  id: number;
  ago: string;
  identity: Identity;
};

// Rotating pool of example inquiries across every source.
const POOL: Omit<Inquiry, "id" | "ago">[] = [
  {
    identity: {
      initials: "AM",
      name: "Aisha Mahmoud",
      market: "Miami",
      property: "The Vista · PH-B",
      source: "Instagram DM",
      hot: true,
      color: "#0f62fe",
      photo: "https://randomuser.me/api/portraits/women/45.jpg",
    },
  },
  {
    identity: {
      initials: "JR",
      name: "Jordan Reyes",
      market: "Brooklyn",
      property: "412 Elm · 2BR",
      source: "Zillow",
      hot: true,
      color: "#4589ff",
      photo: "https://randomuser.me/api/portraits/men/41.jpg",
    },
  },
  {
    identity: {
      initials: "DC",
      name: "Derek Chen",
      market: "Manhattan",
      property: "88 Greene · 1BR",
      source: "Realtor",
      hot: false,
      color: "#4589ff",
      photo: "https://randomuser.me/api/portraits/men/52.jpg",
    },
  },
  {
    identity: {
      initials: "EP",
      name: "Elena Park",
      market: "Austin",
      property: "Riverbend · 2BR",
      source: "Apartments.com",
      hot: false,
      color: "var(--color-muted-foreground)",
      photo: "https://randomuser.me/api/portraits/women/68.jpg",
    },
  },
  {
    identity: {
      initials: "TG",
      name: "Tyler Grant",
      market: "Denver",
      property: "The Maxwell · 1BR",
      source: "Email",
      hot: true,
      color: "#0f62fe",
      photo: "https://randomuser.me/api/portraits/men/29.jpg",
    },
  },
  {
    identity: {
      initials: "RN",
      name: "Rohan Nair",
      market: "Los Angeles",
      property: "8th & Hill · 3BR",
      source: "Voicemail",
      hot: true,
      color: "#4589ff",
      photo: "https://randomuser.me/api/portraits/men/85.jpg",
    },
  },
  {
    identity: {
      initials: "LC",
      name: "Lila Cohen",
      market: "Chicago",
      property: "Parkway 220 · 2BR",
      source: "Site form",
      hot: false,
      color: "var(--color-muted-foreground)",
      photo: "https://randomuser.me/api/portraits/women/22.jpg",
    },
  },
  {
    identity: {
      initials: "BO",
      name: "Ben Okafor",
      market: "San Diego",
      property: "Coastline · oceanfront",
      source: "Instagram DM",
      hot: true,
      color: "#0f62fe",
      photo: "https://randomuser.me/api/portraits/men/36.jpg",
    },
  },
];

const ACCENT = "#0f62fe";
const INK = "#161616";
const MUTED = "var(--color-muted-foreground)";
const SLATE = "#6f6f6f";
const BORDER = "#e0e0e0";
const PARCHMENT = "#f4f4f4";
const HOT_BG = "rgba(218, 30, 40, 0.10)";
const HOT_INK = "#da1e28";

const VISIBLE_ROWS = 4;
const ROTATION_MS = 2400;
export function OverflowInbox() {
  const [rows, setRows] = useState<Inquiry[]>(() =>
    POOL.slice(0, VISIBLE_ROWS).map((p, i) => ({
      ...p,
      id: i,
      ago: i === 0 ? "just now" : `${i}m`,
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
          ago: i === 0 ? "1m" : i === 1 ? "4m" : i === 2 ? "9m" : "16m",
        }));
        return [fresh, ...aged].slice(0, VISIBLE_ROWS);
      });
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, []);

  const baseCount = 1247;
  const captured = baseCount + tick;

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "2px",
        boxShadow: `0 0 0 1px ${BORDER}`,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-3"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "var(--color-muted-foreground)",
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
            Example data · overflow inbox
          </span>
        </div>
        <div className="text-right">
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "20px",
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
              marginTop: "2px",
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
          />
        ))}
      </ul>

      <div
        className="px-5 md:px-6 py-2.5 flex items-center justify-between gap-3"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
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
            fontSize: "9.5px",
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
}: {
  r: Inquiry;
  isTop: boolean;
  isLast: boolean;
}) {
  const id = r.identity;

  return (
    <li
      className="flex items-center gap-3 px-5 md:px-6 py-2.5"
      style={{
        borderBottom: !isLast ? `1px solid ${BORDER}` : "none",
        animation: isTop ? "rowIn 520ms cubic-bezier(.2,.7,.2,1)" : undefined,
        backgroundColor: isTop ? "rgba(15,98,254,0.04)" : "transparent",
        transition: "background-color 1400ms ease",
      }}
    >
      <img
        src={id.photo}
        alt={id.name}
        className="flex-shrink-0"
        style={{
          width: "30px",
          height: "30px",
          objectFit: "cover",
          borderRadius: "50%",
        }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              color: INK,
              fontWeight: 500,
              transition: "color 400ms ease",
            }}
          >
            {id.name}
          </span>
          <SourceTag source={id.source} />
          {id.hot && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8.5px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: HOT_INK,
                backgroundColor: HOT_BG,
                padding: "1.5px 5px",
                borderRadius: "2px",
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
            fontSize: "11.5px",
            color: SLATE,
            marginTop: "1px",
            transition: "all 400ms ease",
          }}
        >
          {id.market} ·{" "}
          <span style={{ color: INK, fontFamily: "var(--font-mono)", fontSize: "11px" }}>
            {id.property}
          </span>
        </p>
      </div>

      <span
        className="flex-shrink-0"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
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
        fontSize: "8.5px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: ACCENT,
        backgroundColor: "rgba(15,98,254,0.10)",
        padding: "1.5px 5px",
        borderRadius: "2px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {source}
    </span>
  );
}
