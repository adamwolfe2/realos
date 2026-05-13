"use client";

import React, { useEffect, useState } from "react";

type Visitor = {
  id: number;
  initials: string;
  name: string;
  org: string;
  page: string;
  color: string;
  resolved: boolean;
  ago: string;
};

const POOL: Omit<Visitor, "id" | "ago">[] = [
  { initials: "MR", name: "Marisol Reyes",   org: "UC Berkeley · sophomore", page: "/floor-plans/2-bed",   color: "#2563EB", resolved: true  },
  { initials: "DJ", name: "Derek Johansson",  org: "parent · Illinois",       page: "/parents",              color: "#5B8CE6", resolved: true  },
  { initials: "?",  name: "Anonymous visitor", org: "Berkeley, CA",             page: "/floor-plans",          color: "#94A3B8", resolved: false },
  { initials: "AL", name: "Aisha Lin",        org: "Cal Housing transfer",    page: "/amenities",            color: "#2563EB", resolved: true  },
  { initials: "TM", name: "Tomás Mendes",     org: "NYU · rising junior",      page: "/floor-plans/3-bed",    color: "#5B8CE6", resolved: true  },
  { initials: "?",  name: "Anonymous visitor", org: "mobile · Oakland",         page: "/gallery",              color: "#94A3B8", resolved: false },
  { initials: "SP", name: "Sofia Petrova",    org: "parent · California",      page: "/parents-faq",          color: "#2563EB", resolved: true  },
  { initials: "RK", name: "Ravi Krishnan",    org: "UC Berkeley · junior",     page: "/tour/schedule",        color: "#2563EB", resolved: true  },
  { initials: "?",  name: "Anonymous visitor", org: "Seattle, WA",              page: "/location",             color: "#94A3B8", resolved: false },
  { initials: "JW", name: "Jordan Wu",        org: "Stanford · transfer",      page: "/floor-plans/1-bed",    color: "#5B8CE6", resolved: true  },
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
          <li
            key={v.id}
            className="flex items-center gap-3 px-5 md:px-6 py-3.5"
            style={{
              borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : "none",
              animation: i === 0 ? "rowIn 520ms cubic-bezier(.2,.7,.2,1)" : undefined,
              backgroundColor: i === 0 ? "rgba(37,99,235,0.04)" : "transparent",
              transition: "background-color 1400ms ease",
            }}
          >
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: v.resolved ? v.color : PARCHMENT,
                color: v.resolved ? "#ffffff" : MUTED,
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.02em",
                border: v.resolved ? "none" : `1px dashed ${MUTED}`,
              }}
            >
              {v.initials}
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
                  }}
                >
                  {v.name}
                </span>
                {v.resolved ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: ACCENT,
                      backgroundColor: "rgba(37,99,235,0.12)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: 600,
                    }}
                  >
                    Identified
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
                }}
              >
                {v.org} · viewed <span style={{ color: INK, fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>{v.page}</span>
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
          </li>
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
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
