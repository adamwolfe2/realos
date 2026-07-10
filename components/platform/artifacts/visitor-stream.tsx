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
//
// Norman feedback (2026-05-21): "people scroll EXTREMELY quick — we need
// 3-5 reveals at a time, not 1 at a time." The POOL is now heavy on
// anonymous-with-reveal rows so any 5-row window has multiple reveals
// in flight at once. The initial mount also fires a staggered wave so
// the visitor sees 4 reveals within ~2.5s of landing on the page.
const POOL: Omit<Visitor, "id" | "ago">[] = [
  // Anonymous → Maya Patel  (initial-wave reveal #1)
  { initials: "?",  name: "Anonymous visitor", org: "mobile · west coast",     page: "/floor-plans",        color: "#8d8d8d", resolved: false,
    revealsTo: { initials: "MP", name: "Maya Patel",     org: "UC Berkeley · rising junior",  color: "#0f62fe", photo: "https://randomuser.me/api/portraits/women/22.jpg" } },
  // Anonymous → Ethan Kim   (initial-wave reveal #2)
  { initials: "?",  name: "Anonymous visitor", org: "mobile · Oakland",        page: "/gallery",            color: "#8d8d8d", resolved: false,
    revealsTo: { initials: "EK", name: "Ethan Kim",      org: "Cal Poly · sophomore",         color: "#4589ff", photo: "https://randomuser.me/api/portraits/men/85.jpg" } },
  // Anonymous → Olivia Bennett (initial-wave reveal #3)
  { initials: "?",  name: "Anonymous visitor", org: "Seattle, WA",             page: "/location",           color: "#8d8d8d", resolved: false,
    revealsTo: { initials: "OB", name: "Olivia Bennett", org: "U Washington · parent",         color: "#4589ff", photo: "https://randomuser.me/api/portraits/women/12.jpg" } },
  // Anonymous → Jordan Wu   (initial-wave reveal #4)
  { initials: "?",  name: "Anonymous visitor", org: "Bay Area · mobile",       page: "/floor-plans/1-bed",  color: "#8d8d8d", resolved: false,
    revealsTo: { initials: "JW", name: "Jordan Wu",      org: "Stanford · transfer",          color: "#4589ff", photo: "https://randomuser.me/api/portraits/men/36.jpg" } },
  // Anonymous → Aisha Lin   (initial-wave reveal #5)
  { initials: "?",  name: "Anonymous visitor", org: "campus IP",               page: "/amenities",          color: "#8d8d8d", resolved: false,
    revealsTo: { initials: "AL", name: "Aisha Lin",      org: "campus transfer",              color: "#0f62fe", photo: "https://randomuser.me/api/portraits/women/79.jpg" } },
  // Identified row mixed in (rotation cycles bring more anonymous in via the loop)
  { initials: "DJ", name: "Derek Johansson",  org: "parent · Illinois",       page: "/parents",            color: "#4589ff", resolved: true,
    photo: "https://randomuser.me/api/portraits/men/52.jpg" },
  // Anonymous → Marisol Reyes  (rotation reveal)
  { initials: "?",  name: "Anonymous visitor", org: "mobile · Bay Area",       page: "/floor-plans/2-bed",  color: "#8d8d8d", resolved: false,
    revealsTo: { initials: "MR", name: "Marisol Reyes",  org: "rising sophomore",             color: "#0f62fe", photo: "https://randomuser.me/api/portraits/women/68.jpg" } },
  { initials: "TM", name: "Tomás Mendes",     org: "NYU · rising junior",     page: "/floor-plans/3-bed",  color: "#4589ff", resolved: true,
    photo: "https://randomuser.me/api/portraits/men/41.jpg" },
  // Anonymous → Sofia Petrova  (rotation reveal)
  { initials: "?",  name: "Anonymous visitor", org: "Sacramento, CA",          page: "/parents-faq",        color: "#8d8d8d", resolved: false,
    revealsTo: { initials: "SP", name: "Sofia Petrova",  org: "parent · California",          color: "#0f62fe", photo: "https://randomuser.me/api/portraits/women/45.jpg" } },
  { initials: "RK", name: "Ravi Krishnan",    org: "rising junior",           page: "/tour/schedule",      color: "#0f62fe", resolved: true,
    photo: "https://randomuser.me/api/portraits/men/29.jpg" },
];

const ACCENT = "#0f62fe";
const INK = "#161616";
const MUTED = "#8d8d8d";
const BORDER = "#e0e0e0";
const PARCHMENT = "#f4f4f4";

// Per-row reveal-delay schedule. Norman feedback (2026-05-21): "people
// scroll EXTREMELY quick — we need 3-5 reveals at a time, not 1 at a
// time." The schedule lines up the first 5 anonymous → identified
// flips inside a ~2.5s window. Sub-pages with the full 5-row stream
// use this whole schedule; compact callers (the /features index card)
// just use the first entry.
const INITIAL_REVEAL_DELAYS_MS = [500, 950, 1400, 1850, 2300];

// Default visible-row count. Sub-pages (`/features/pixel`, `/leads`,
// etc.) use the default 5-row stream — that's where the artifact
// owns the whole right-column slot. The /features index card calls
// this component with `visibleRows={1}` because the card was reading
// as the tallest row in the index scroll (Adam, 2026-05-29).
const DEFAULT_VISIBLE_ROWS = 5;

// Rotation interval. Tightened from 3.4s → 2.6s so the steady-state
// feed feels alive at a glance.
const ROTATION_MS = 2600;

interface VisitorStreamProps {
  /** How many visitor rows to render at once. Default 5 (full stream).
   *  Set to 1 on compact surfaces like the /features index card. */
  visibleRows?: number;
}

export function VisitorStream({
  visibleRows = DEFAULT_VISIBLE_ROWS,
}: VisitorStreamProps = {}) {
  const cap = Math.max(1, Math.min(visibleRows, POOL.length));
  const [rows, setRows] = useState<Visitor[]>(() =>
    POOL.slice(0, cap).map((p, i) => ({
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
        return [fresh, ...aged].slice(0, cap);
      });
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, [cap]);

  const identifiedCount = 12 + Math.floor(tick / 2);

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
            Example data · identified visitors
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
        {rows.map((v, i) => {
          // Initial mount only: every row in the initial slice (id 0-4)
          // uses the staggered wave delay. Anything that comes in via
          // rotation (id >= 5) uses the snappy default 1500ms.
          const isInitial = v.id < INITIAL_REVEAL_DELAYS_MS.length;
          const revealDelayMs = isInitial
            ? INITIAL_REVEAL_DELAYS_MS[v.id]
            : 1500;
          // Mobile: show only top 3 rows. The reveal wave still feels alive,
          // but the artifact stays ~half the height. Desktop unchanged.
          return (
            <VisitorRow
              key={v.id}
              v={v}
              isTop={i === 0}
              isLast={i === rows.length - 1}
              revealDelayMs={revealDelayMs}
              hideOnMobile={i >= 3}
            />
          );
        })}
      </ul>

      <div
        className="hidden sm:flex px-5 md:px-6 py-3 items-center justify-between gap-3"
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
function VisitorRow({
  v,
  isTop,
  isLast,
  revealDelayMs = 1500,
  hideOnMobile = false,
}: {
  v: Visitor;
  isTop: boolean;
  isLast: boolean;
  revealDelayMs?: number;
  hideOnMobile?: boolean;
}) {
  const [revealed, setRevealed] = useState(v.resolved);
  const [justRevealed, setJustRevealed] = useState(false);

  useEffect(() => {
    // Reset state on visitor identity change (when a row gets a new visitor from the pool rotation)
    setRevealed(v.resolved);
    setJustRevealed(false);
    if (v.resolved || !v.revealsTo) return;
    // Norman feedback (2026-05-21): the initial 5 rows now stagger
    // reveals using INITIAL_REVEAL_DELAYS_MS (500ms, 950ms, 1400ms,
    // 1850ms, 2300ms) so the visitor sees a wave of 5 identifications
    // within ~2.5s of landing. Rotation rows reuse the default 1500ms.
    const t1 = setTimeout(() => {
      setRevealed(true);
      setJustRevealed(true);
    }, revealDelayMs);
    const t2 = setTimeout(() => {
      setJustRevealed(false);
    }, revealDelayMs + 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [v.id, v.resolved, v.revealsTo, revealDelayMs]);

  // Pick which identity to render — anonymous source vs revealed target
  const showResolved = revealed && (v.resolved || !!v.revealsTo);
  const identity = showResolved && !v.resolved && v.revealsTo ? v.revealsTo : v;
  const photo = showResolved ? identity.photo : undefined;
  const initials = showResolved ? identity.initials : v.initials;
  const displayName = showResolved ? identity.name : v.name;
  const displayOrg = showResolved ? identity.org : v.org;
  const avatarColor = showResolved ? identity.color : "#e0e0e0";

  return (
    <li
      className={`${hideOnMobile ? "hidden sm:flex" : "flex"} items-center gap-3 px-5 md:px-6 py-3 sm:py-3.5`}
      style={{
        borderBottom: !isLast ? `1px solid ${BORDER}` : "none",
        animation: isTop ? "rowIn 520ms cubic-bezier(.2,.7,.2,1)" : undefined,
        backgroundColor: isTop ? "rgba(15,98,254,0.04)" : "transparent",
        transition: "background-color 1400ms ease",
      }}
    >
      {/* Avatar, flips when reveal fires */}
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
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: INK,
              fontWeight: 500,
              transition: "color 400ms ease",
              maxWidth: "100%",
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
                backgroundColor: justRevealed ? ACCENT : "rgba(15,98,254,0.12)",
                padding: "2px 6px",
                borderRadius: "2px",
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
            color: "#6f6f6f",
            marginTop: "2px",
            transition: "all 400ms ease",
          }}
        >
          {displayOrg} · viewed{" "}
          <span style={{ color: INK, fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>{v.page}</span>
        </p>
      </div>

      {/* Time-ago column: hidden on mobile (the cramped meta line above
          truncated names mid-word when the pill was also in play). Shown
          from sm: onward where there's room. */}
      <span
        className="hidden sm:inline flex-shrink-0"
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
