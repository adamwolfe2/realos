"use client";

import React, { useEffect, useState } from "react";

export type PortfolioProperty = {
  name: string;
  location: string;
  units: number;
  leased: number;
  trend: "up" | "down" | "flat";
  tag?: string;
};

type Props = {
  label?: string;
  properties?: PortfolioProperty[];
};

const DEFAULT_PROPERTIES: PortfolioProperty[] = [
  { name: "Telegraph Commons",  location: "Berkeley, CA",   units: 612, leased: 548, trend: "up",   tag: "Flagship" },
  { name: "Park & Pearl",       location: "Austin, TX",     units: 284, leased: 229, trend: "up"    },
  { name: "Sage at Greenpoint", location: "Brooklyn, NY",   units: 164, leased: 152, trend: "flat"  },
  { name: "The Rhodes",         location: "Nashville, TN",  units: 212, leased: 168, trend: "up"    },
];

const ACCENT = "#2F6FE5";
const INK = "#141413";
const MUTED = "#87867f";
const BORDER = "#f0eee6";
const PARCHMENT = "#faf9f5";
const SUCCESS = "#3a7d44";
const ERROR = "#b53333";

export function PortfolioOccupancy({
  label = "portfolio.overview",
  properties = DEFAULT_PROPERTIES,
}: Props) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setRevealed((r) => (r >= properties.length ? 0 : r + 1));
    }, 720);
    return () => clearInterval(id);
  }, [properties.length]);

  const totalUnits  = properties.reduce((sum, p) => sum + p.units, 0);
  const totalLeased = properties.reduce((sum, p) => sum + p.leased, 0);
  const totalPct    = Math.round((totalLeased / totalUnits) * 100);

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
        <div className="flex items-center gap-2">
          <span
            className="inline-block"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: ACCENT,
              animation: "pgLive 1.6s ease-in-out infinite",
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
            Live · {label}
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
            {totalPct}%
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9.5px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 500,
              marginTop: "3px",
            }}
          >
            Portfolio leased
          </p>
        </div>
      </div>

      <ul>
        {properties.map((p, i) => {
          const show = i < revealed;
          const pct = Math.round((p.leased / p.units) * 100);
          return (
            <li
              key={p.name}
              className="px-5 md:px-6 py-3.5"
              style={{
                borderBottom: i < properties.length - 1 ? `1px solid ${BORDER}` : "none",
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "14px",
                      color: INK,
                      fontWeight: 600,
                    }}
                  >
                    {p.name}
                  </span>
                  {p.tag && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "9px",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: ACCENT,
                        backgroundColor: "rgba(47,111,229,0.12)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      {p.tag}
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: MUTED,
                    }}
                  >
                    · {p.location}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11.5px",
                      color: MUTED,
                    }}
                  >
                    {p.leased}/{p.units}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: INK,
                      fontWeight: 600,
                      minWidth: "38px",
                      textAlign: "right",
                    }}
                  >
                    {pct}%
                  </span>
                  <TrendArrow trend={p.trend} />
                </div>
              </div>
              <div
                style={{
                  height: "6px",
                  backgroundColor: PARCHMENT,
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: show ? `${pct}%` : "0%",
                    backgroundColor: ACCENT,
                    borderRadius: "3px",
                    transition: "width 900ms cubic-bezier(.2,.7,.2,1)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className="px-5 md:px-6 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 500,
          }}
        >
          {properties.length} properties · one login
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: ACCENT,
            fontWeight: 600,
          }}
        >
          ↗ open portfolio
        </span>
      </div>

      <style jsx>{`
        @keyframes pgLive {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.3); opacity: 0.55;}
        }
      `}</style>
    </div>
  );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "flat") {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: MUTED, width: "12px", textAlign: "center" }}>
        —
      </span>
    );
  }
  const up = trend === "up";
  return (
    <span
      style={{
        color: up ? SUCCESS : ERROR,
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        fontWeight: 600,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d={up ? "M5 2L9 7H1L5 2Z" : "M5 8L1 3H9L5 8Z"}
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
