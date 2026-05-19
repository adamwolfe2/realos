"use client";

import React, { useEffect, useState } from "react";
import { GoogleMark, MetaMark, TikTokMark } from "./brand-logos";

// ---------------------------------------------------------------------------
// AttributionBreakdown — channel → spend → leads → tours → leases waterfall.
//
// The hero product surface for "spend tied to lease signings, not
// impressions." Renders a single channel funnel (Google → ↘ → ↘ → leases)
// with a live-feeling animated CAC value at the top right. Used in the
// CapabilitiesRail as the right-column artifact for capability 02.
//
// Visually: clean table-as-funnel layout with cobalt accent on the active
// row. Each row tightens (spend → leads → tours → leases) so the eye
// reads "$ shrinks but the value rises." No fake chart libraries, just
// hand-tuned bars.
// ---------------------------------------------------------------------------

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";
const SUCCESS = "#16A34A";

type Channel = {
  name: string;
  logo: React.ReactNode;
  spend: number;
  leads: number;
  tours: number;
  leases: number;
  color: string;
};

const CHANNELS: Channel[] = [
  {
    name: "Google Ads",
    logo: <GoogleMark size={14} />,
    spend: 4200,
    leads: 142,
    tours: 38,
    leases: 4,
    color: "#2563EB",
  },
  {
    name: "Meta",
    logo: <MetaMark size={14} />,
    spend: 2800,
    leads: 96,
    tours: 21,
    leases: 3,
    color: "#5B8CE6",
  },
  {
    name: "TikTok",
    logo: <TikTokMark size={14} />,
    spend: 1100,
    leads: 54,
    tours: 9,
    leases: 1,
    color: "#0F172A",
  },
];

const TOTAL_SPEND = CHANNELS.reduce((s, c) => s + c.spend, 0);
const TOTAL_LEASES = CHANNELS.reduce((s, c) => s + c.leases, 0);
const CAC = Math.round(TOTAL_SPEND / TOTAL_LEASES);

export function AttributionBreakdown() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((a) => (a + 1) % CHANNELS.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const channel = CHANNELS[active];
  const cpl = Math.round(channel.spend / channel.leads);
  const cac = Math.round(channel.spend / channel.leases);

  // Bar widths anchored to the largest spend so visual proportions are honest
  const maxSpend = Math.max(...CHANNELS.map((c) => c.spend));

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(30, 42, 58, 0.06)`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-4"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: ACCENT,
              animation: "liveDot 1.6s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 600,
            }}
          >
            Last 30 days · channel attribution
          </span>
        </div>
        <div className="text-right">
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              color: INK,
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            ${CAC.toLocaleString()}
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 500,
              marginTop: 3,
            }}
          >
            Blended CAC · per lease
          </p>
        </div>
      </div>

      {/* Channel rows */}
      <ul>
        {CHANNELS.map((c, i) => {
          const isActive = i === active;
          const pct = (c.spend / maxSpend) * 100;
          return (
            <li
              key={c.name}
              className="px-5 md:px-6 py-3.5"
              style={{
                borderBottom: i < CHANNELS.length - 1 ? `1px solid ${BORDER}` : "none",
                backgroundColor: isActive ? "rgba(37,99,235,0.04)" : "transparent",
                transition: "background-color 320ms ease",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    backgroundColor: "#FFFFFF",
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  {c.logo}
                </span>
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    color: INK,
                    fontWeight: 500,
                  }}
                >
                  {c.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: INK,
                    fontWeight: 600,
                  }}
                >
                  ${c.spend.toLocaleString()}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2.5">
                <div
                  className="flex-1 relative overflow-hidden"
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: PARCHMENT,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      backgroundColor: c.color,
                      transition: "width 600ms cubic-bezier(.2,.7,.2,1)",
                    }}
                  />
                </div>
                <span
                  className="flex-shrink-0"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: MUTED,
                    fontWeight: 500,
                    minWidth: 88,
                    textAlign: "right",
                  }}
                >
                  {c.leads} · {c.tours} · <span style={{ color: SUCCESS, fontWeight: 700 }}>{c.leases}L</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Active channel detail */}
      <div
        className="px-5 md:px-6 py-4"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: MUTED,
                fontWeight: 600,
              }}
            >
              {channel.name} · cost per lead → cost per lease
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                color: INK,
                fontWeight: 500,
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>${cpl}</span>
              <span style={{ color: MUTED }}> CPL · </span>
              <span style={{ fontFamily: "var(--font-mono)", color: ACCENT, fontWeight: 700 }}>
                ${cac.toLocaleString()}
              </span>
              <span style={{ color: MUTED }}> per signed lease</span>
            </p>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: ACCENT,
              fontWeight: 600,
            }}
          >
            ↗ Drill into channel
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes liveDot {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.3); opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
