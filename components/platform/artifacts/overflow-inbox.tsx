"use client";

import React, { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// OverflowInbox — the hero artifact for /leads.
//
// Behaviour mirrors the VisitorStream reveal used on /features/pixel: every
// row shows a real headshot, and the rows that start as "Anonymous visitor"
// flip to a named lead after a short delay. The eye locks on the same
// surprise-reveal animation Norman validated on the visitor-id page.
//
// The OverflowInbox layer ON TOP of that mechanic is the multi-source
// context: every row carries a source tag (Zillow / Realtor / Instagram
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
  // Initial-state metadata. When `resolved` is false the row renders as
  // "Anonymous visitor · viewed <property>" and then flips into the
  // `identity` block after `revealDelayMs`. When resolved is true we
  // render the identity row immediately.
  resolved: boolean;
  ago: string;
  identity: Identity;
};

// Mix of resolved + anonymous-with-reveal rows so any 4-row window has
// at least one reveal in flight.
const POOL: Omit<Inquiry, "id" | "ago">[] = [
  {
    resolved: false,
    identity: {
      initials: "AM",
      name: "Aisha Mahmoud",
      market: "Miami",
      property: "The Vista · PH-B",
      source: "Instagram DM",
      hot: true,
      color: "#2563EB",
      photo: "https://randomuser.me/api/portraits/women/45.jpg",
    },
  },
  {
    resolved: false,
    identity: {
      initials: "JR",
      name: "Jordan Reyes",
      market: "Brooklyn",
      property: "412 Elm · 2BR",
      source: "Zillow",
      hot: true,
      color: "#5B8CE6",
      photo: "https://randomuser.me/api/portraits/men/41.jpg",
    },
  },
  {
    resolved: true,
    identity: {
      initials: "DC",
      name: "Derek Chen",
      market: "Manhattan",
      property: "88 Greene · 1BR",
      source: "Realtor",
      hot: false,
      color: "#5B8CE6",
      photo: "https://randomuser.me/api/portraits/men/52.jpg",
    },
  },
  {
    resolved: false,
    identity: {
      initials: "EP",
      name: "Elena Park",
      market: "Austin",
      property: "Riverbend · 2BR",
      source: "Apartments.com",
      hot: false,
      color: "#94A3B8",
      photo: "https://randomuser.me/api/portraits/women/68.jpg",
    },
  },
  {
    resolved: true,
    identity: {
      initials: "TG",
      name: "Tyler Grant",
      market: "Denver",
      property: "The Maxwell · 1BR",
      source: "Email",
      hot: true,
      color: "#2563EB",
      photo: "https://randomuser.me/api/portraits/men/29.jpg",
    },
  },
  {
    resolved: false,
    identity: {
      initials: "RN",
      name: "Rohan Nair",
      market: "Los Angeles",
      property: "8th & Hill · 3BR",
      source: "Voicemail",
      hot: true,
      color: "#5B8CE6",
      photo: "https://randomuser.me/api/portraits/men/85.jpg",
    },
  },
  {
    resolved: true,
    identity: {
      initials: "LC",
      name: "Lila Cohen",
      market: "Chicago",
      property: "Parkway 220 · 2BR",
      source: "Site form",
      hot: false,
      color: "#94A3B8",
      photo: "https://randomuser.me/api/portraits/women/22.jpg",
    },
  },
  {
    resolved: false,
    identity: {
      initials: "BO",
      name: "Ben Okafor",
      market: "San Diego",
      property: "Coastline · oceanfront",
      source: "Instagram DM",
      hot: true,
      color: "#2563EB",
      photo: "https://randomuser.me/api/portraits/men/36.jpg",
    },
  },
];

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const SLATE = "#64748B";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";
const HOT_BG = "rgba(239, 68, 68, 0.10)";
const HOT_INK = "#DC2626";

const VISIBLE_ROWS = 4;
const ROTATION_MS = 2400;
// Staggered reveal wave on the initial mount so the visitor sees multiple
// anonymous → identified flips within the first ~2 seconds of landing.
const INITIAL_REVEAL_DELAYS_MS = [500, 950, 1450, 1950];

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
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(30, 42, 58,0.08)`,
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
        {rows.map((r, i) => {
          const isInitial = r.id < INITIAL_REVEAL_DELAYS_MS.length;
          const revealDelayMs = isInitial
            ? INITIAL_REVEAL_DELAYS_MS[r.id]
            : 1500;
          return (
            <InquiryRow
              key={r.id}
              r={r}
              isTop={i === 0}
              isLast={i === rows.length - 1}
              revealDelayMs={revealDelayMs}
            />
          );
        })}
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
  revealDelayMs = 1500,
}: {
  r: Inquiry;
  isTop: boolean;
  isLast: boolean;
  revealDelayMs?: number;
}) {
  const [revealed, setRevealed] = useState(r.resolved);
  const [justRevealed, setJustRevealed] = useState(false);

  useEffect(() => {
    setRevealed(r.resolved);
    setJustRevealed(false);
    if (r.resolved) return;
    const t1 = setTimeout(() => {
      setRevealed(true);
      setJustRevealed(true);
    }, revealDelayMs);
    const t2 = setTimeout(() => {
      setJustRevealed(false);
    }, revealDelayMs + 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [r.id, r.resolved, revealDelayMs]);

  const id = r.identity;

  return (
    <li
      className="flex items-center gap-3 px-5 md:px-6 py-2.5"
      style={{
        borderBottom: !isLast ? `1px solid ${BORDER}` : "none",
        animation: isTop ? "rowIn 520ms cubic-bezier(.2,.7,.2,1)" : undefined,
        backgroundColor: isTop ? "rgba(37,99,235,0.04)" : "transparent",
        transition: "background-color 1400ms ease",
      }}
    >
      {/* Avatar — flips on reveal */}
      <span
        className="inline-flex items-center justify-center flex-shrink-0 relative"
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          perspective: "400px",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            overflow: "hidden",
            transformStyle: "preserve-3d",
            transition: "transform 600ms cubic-bezier(.4,0,.2,1)",
            transform: revealed ? "rotateY(0deg)" : "rotateY(180deg)",
          }}
        >
          <img
            src={id.photo}
            alt={id.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
            }}
          />
        </span>

        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            backgroundColor: PARCHMENT,
            border: `1px dashed ${MUTED}`,
            color: MUTED,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            fontWeight: 600,
            opacity: revealed ? 0 : 1,
            transition: "opacity 250ms ease",
            pointerEvents: "none",
          }}
        >
          ?
        </span>

        {justRevealed && (
          <span
            style={{
              position: "absolute",
              inset: "-4px",
              borderRadius: "50%",
              border: `2px solid ${ACCENT}`,
              animation: "revealPulse 1.4s ease-out",
              pointerEvents: "none",
            }}
          />
        )}
      </span>

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
            {revealed ? id.name : "Anonymous visitor"}
          </span>
          {revealed ? (
            <>
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
                    borderRadius: "4px",
                    fontWeight: 700,
                  }}
                >
                  Hot
                </span>
              )}
            </>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8.5px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: justRevealed ? "#ffffff" : MUTED,
                backgroundColor: justRevealed ? ACCENT : "transparent",
                padding: "1.5px 5px",
                borderRadius: "4px",
                fontWeight: 600,
                transition: "all 400ms ease",
              }}
            >
              Anonymous
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
          {revealed ? id.market : "mobile · " + id.market.toLowerCase()} ·{" "}
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
        @keyframes revealPulse {
          0%   { transform: scale(0.85); opacity: 0.9; }
          70%  { transform: scale(1.6);  opacity: 0;   }
          100% { transform: scale(1.7);  opacity: 0;   }
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
        backgroundColor: "rgba(37,99,235,0.10)",
        padding: "1.5px 5px",
        borderRadius: "4px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {source}
    </span>
  );
}
