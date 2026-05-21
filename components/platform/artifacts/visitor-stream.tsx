"use client";

import React, { useEffect, useState } from "react";

type Identity = {
  initials: string;
  name: string;
  org: string;
  color: string;
  photo?: string;
};

type Visitor = {
  id: number;
  initials: string;
  name: string;
  org: string;
  page: string;
  color: string;
  resolved: boolean;
  ago: string;
  photo?: string;
  // If this visitor enters as Anonymous, this is who they'll resolve to after ~1.6s on-screen.
  // The reveal IS the point of the demo — every anonymous visitor flips to a named lead with a face.
  revealsTo?: Identity;
};

// Real-person portraits via randomuser.me (free, stable CDN, diverse, used in countless marketing demos).
// Demographic notes: student-aged (men/women in 20s) for student-housing context + a couple of older parent demographics.
const POOL: Omit<Visitor, "id" | "ago">[] = [
  { initials: "MR", name: "Marisol Reyes",    org: "rising sophomore",       page: "/floor-plans/2-bed",  color: "#2563EB", resolved: true,
    photo: "https://randomuser.me/api/portraits/women/68.jpg" },
  { initials: "DJ", name: "Derek Johansson",  org: "parent · Illinois",       page: "/parents",            color: "#5B8CE6", resolved: true,
    photo: "https://randomuser.me/api/portraits/men/52.jpg" },
  // Anonymous that resolves to Maya Patel
  { initials: "?",  name: "Anonymous visitor", org: "mobile · west coast",     page: "/floor-plans",        color: "#94A3B8", resolved: false,
    revealsTo: { initials: "MP", name: "Maya Patel",     org: "UC Berkeley · rising junior",  color: "#2563EB", photo: "https://randomuser.me/api/portraits/women/22.jpg" } },
  { initials: "AL", name: "Aisha Lin",        org: "campus transfer",         page: "/amenities",          color: "#2563EB", resolved: true,
    photo: "https://randomuser.me/api/portraits/women/79.jpg" },
  { initials: "TM", name: "Tomás Mendes",     org: "NYU · rising junior",     page: "/floor-plans/3-bed",  color: "#5B8CE6", resolved: true,
    photo: "https://randomuser.me/api/portraits/men/41.jpg" },
  // Anonymous → Ethan Kim
  { initials: "?",  name: "Anonymous visitor", org: "mobile · Oakland",        page: "/gallery",            color: "#94A3B8", resolved: false,
    revealsTo: { initials: "EK", name: "Ethan Kim",      org: "Cal Poly · sophomore",         color: "#5B8CE6", photo: "https://randomuser.me/api/portraits/men/85.jpg" } },
  { initials: "SP", name: "Sofia Petrova",    org: "parent · California",     page: "/parents-faq",        color: "#2563EB", resolved: true,
    photo: "https://randomuser.me/api/portraits/women/45.jpg" },
  { initials: "RK", name: "Ravi Krishnan",    org: "rising junior",           page: "/tour/schedule",      color: "#2563EB", resolved: true,
    photo: "https://randomuser.me/api/portraits/men/29.jpg" },
  // Anonymous → Olivia Bennett
  { initials: "?",  name: "Anonymous visitor", org: "Seattle, WA",             page: "/location",           color: "#94A3B8", resolved: false,
    revealsTo: { initials: "OB", name: "Olivia Bennett", org: "U Washington · parent",         color: "#5B8CE6", photo: "https://randomuser.me/api/portraits/women/12.jpg" } },
  { initials: "JW", name: "Jordan Wu",        org: "Stanford · transfer",     page: "/floor-plans/1-bed",  color: "#5B8CE6", resolved: true,
    photo: "https://randomuser.me/api/portraits/men/36.jpg" },
];

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";

export function VisitorStream() {
  const [rows, setRows] = useState<Visitor[]>(() =>
    POOL.slice(0, 5).map((p, i) => ({
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
        const fresh: Visitor = {
          ...source,
          id: prev[0].id + 1,
          ago: "just now",
        };
        const aged = prev.map((r, i) => ({
          ...r,
          ago: i === 0 ? "1m" : i === 1 ? "3m" : i === 2 ? "6m" : i === 3 ? "12m" : "22m",
        }));
        return [fresh, ...aged].slice(0, 5);
      });
    }, 3400);
    return () => clearInterval(id);
  }, []);

  const identifiedCount = 12 + Math.floor(tick / 2);

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(30, 42, 58,0.06)`,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-4"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: ACCENT,
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
            Live · on your site right now
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
            }}
          >
            {identifiedCount}
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
            Identified · last hour
          </p>
        </div>
      </div>

      <ul>
        {rows.map((v, i) => (
          <VisitorRow key={v.id} v={v} isTop={i === 0} isLast={i === rows.length - 1} />
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
          Every named visitor goes to your team and your ad audiences
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: ACCENT,
            fontWeight: 600,
          }}
        >
          ↗ See all visitors
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

/**
 * One row in the stream. Owns its own reveal lifecycle:
 * - If the visitor enters as Anonymous AND has a `revealsTo` identity, schedule a flip after ~1500ms.
 * - The avatar flips (3D rotateY) from gray "?" → real headshot.
 * - Badge swaps from "Anonymous" → "Just identified" (pulses for 2.5s) → "Identified".
 * - Org line updates with the resolved identity.
 */
function VisitorRow({ v, isTop, isLast }: { v: Visitor; isTop: boolean; isLast: boolean }) {
  const [revealed, setRevealed] = useState(v.resolved);
  const [justRevealed, setJustRevealed] = useState(false);

  useEffect(() => {
    // Reset state on visitor identity change (when a row gets a new visitor from the pool rotation)
    setRevealed(v.resolved);
    setJustRevealed(false);
    if (v.resolved || !v.revealsTo) return;
    const t1 = setTimeout(() => {
      setRevealed(true);
      setJustRevealed(true);
    }, 1500);
    const t2 = setTimeout(() => {
      setJustRevealed(false);
    }, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [v.id, v.resolved, v.revealsTo]);

  // Pick which identity to render — anonymous source vs revealed target
  const showResolved = revealed && (v.resolved || !!v.revealsTo);
  const identity = showResolved && !v.resolved && v.revealsTo ? v.revealsTo : v;
  const photo = showResolved ? identity.photo : undefined;
  const initials = showResolved ? identity.initials : v.initials;
  const displayName = showResolved ? identity.name : v.name;
  const displayOrg = showResolved ? identity.org : v.org;
  const avatarColor = showResolved ? identity.color : "#E2E8F0";

  return (
    <li
      className="flex items-center gap-3 px-5 md:px-6 py-3.5"
      style={{
        borderBottom: !isLast ? `1px solid ${BORDER}` : "none",
        animation: isTop ? "rowIn 520ms cubic-bezier(.2,.7,.2,1)" : undefined,
        backgroundColor: isTop ? "rgba(37,99,235,0.04)" : "transparent",
        transition: "background-color 1400ms ease",
      }}
    >
      {/* Avatar — flips when reveal fires */}
      <span
        className="inline-flex items-center justify-center flex-shrink-0 relative"
        style={{
          width: "34px",
          height: "34px",
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
            transform: showResolved ? "rotateY(0deg)" : "rotateY(180deg)",
          }}
        >
          {/* Resolved face (front when showResolved=true) */}
          {photo ? (
            <img
              src={photo}
              alt={displayName}
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
          ) : (
            <span
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: avatarColor,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 600,
                backfaceVisibility: "hidden",
              }}
            >
              {initials}
            </span>
          )}
        </span>

        {/* Anonymous face (back, visible when not yet revealed) */}
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
            fontSize: "14px",
            fontWeight: 600,
            opacity: showResolved ? 0 : 1,
            transition: "opacity 250ms ease",
            pointerEvents: "none",
          }}
        >
          ?
        </span>

        {/* Sparkle pulse on reveal */}
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
        <div className="flex items-center gap-2">
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: INK,
              fontWeight: 500,
              transition: "color 400ms ease",
            }}
          >
            {displayName}
          </span>
          {showResolved ? (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: justRevealed ? "#ffffff" : ACCENT,
                backgroundColor: justRevealed ? ACCENT : "rgba(37,99,235,0.12)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600,
                transition: "all 600ms ease",
                animation: justRevealed ? "badgeFlash 2.4s ease" : undefined,
                whiteSpace: "nowrap",
              }}
            >
              {justRevealed ? "Just identified" : "Identified"}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: MUTED,
                fontWeight: 500,
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
            fontSize: "12px",
            color: "#64748B",
            marginTop: "2px",
            transition: "all 400ms ease",
          }}
        >
          {displayOrg} · viewed{" "}
          <span style={{ color: INK, fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>{v.page}</span>
        </p>
      </div>

      <span
        className="flex-shrink-0"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: MUTED,
          fontWeight: 500,
        }}
      >
        {v.ago}
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
        @keyframes badgeFlash {
          0%   { transform: scale(0.95); }
          15%  { transform: scale(1.12); }
          30%  { transform: scale(1);    }
          100% { transform: scale(1);    }
        }
      `}</style>
    </li>
  );
}
