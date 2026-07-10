"use client";

import React, { useEffect, useRef, useState } from "react";
import { GoogleMark, MetaMark, TikTokMark } from "./brand-logos";

// ---------------------------------------------------------------------------
// useEaseInProgress
//
// Drives a 0 → 1 value over `durationMs` using requestAnimationFrame and
// an easeOutCubic curve. One progress source feeds every animated number
// + bar width on mount, so the card "draws in" as a single coordinated
// motion rather than each cell snapping at its own time.
//
// Cleans up via cancelAnimationFrame on unmount.
// ---------------------------------------------------------------------------
function useEaseInProgress(durationMs: number): number {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      // easeOutCubic — feels like a measurement settling, not a snap.
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return progress;
}

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

const ACCENT = "#0f62fe";
const INK = "#161616";
const MUTED = "#8d8d8d";
const BORDER = "#e0e0e0";
const PARCHMENT = "#f4f4f4";
// Norman feedback (2026-05-21): all marketing-surface chart + accent
// colors stay on the brand blue ramp. SUCCESS reads as a calmer
// brand-blue accent (no green/amber).
const SUCCESS = "#0f62fe";

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
    color: "#0f62fe",
  },
  {
    name: "Meta",
    logo: <MetaMark size={14} />,
    spend: 2800,
    leads: 96,
    tours: 21,
    leases: 3,
    color: "#4589ff",
  },
  {
    name: "TikTok",
    logo: <TikTokMark size={14} />,
    spend: 1100,
    leads: 54,
    tours: 9,
    leases: 1,
    color: "#161616",
  },
];

const TOTAL_SPEND = CHANNELS.reduce((s, c) => s + c.spend, 0);
const TOTAL_LEASES = CHANNELS.reduce((s, c) => s + c.leases, 0);
const CAC = Math.round(TOTAL_SPEND / TOTAL_LEASES);

// Mount animation duration. The whole card "draws in" over this window
// (bars from 0 → width, every number from 0 → target). Tuned to feel
// like a real-time analytics surface settling, not a screenshot. Norman
// 2026-05-21: every motion stays inside the brand-blue ramp; no flashy
// easing curves that read as "marketing site," just measurement.
const MOUNT_ANIM_MS = 1400;

export function AttributionBreakdown() {
  const [active, setActive] = useState(0);

  // Single shared progress drives every animated value on the card.
  const progress = useEaseInProgress(MOUNT_ANIM_MS);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((a) => (a + 1) % CHANNELS.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const channel = CHANNELS[active];
  const cpl = Math.round(channel.spend / channel.leads);
  const cac = Math.round(channel.spend / channel.leases);

  // Bar widths anchored to the largest spend so visual proportions are honest.
  const maxSpend = Math.max(...CHANNELS.map((c) => c.spend));

  // Helpers — every animated number ramps from 0 → target on mount.
  // Using Math.round keeps the count-up visually integer-clean; the
  // final value is correct because progress lands exactly at 1.
  const animInt = (target: number) => Math.round(target * progress);
  // Animated currency lazily formats so tabular-nums in the SVG-less
  // numeric font still looks clean during the count-up.
  const animCurrency = (target: number) => animInt(target).toLocaleString();

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 2,
        boxShadow: `0 0 0 1px ${BORDER}`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-3 sm:py-4"
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
            <span className="hidden sm:inline">Last 30 days · channel attribution</span>
            <span className="sm:hidden">Channel attribution</span>
          </span>
        </div>
        <div className="text-right">
          <p
            className="text-[18px] sm:text-[22px] tabular-nums"
            style={{
              fontFamily: "var(--font-display)",
              color: INK,
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            ${animCurrency(CAC)}
          </p>
          <p
            className="hidden sm:block"
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
          // Stagger the bar draw-in so the three rows feel like a wave
          // rather than three things popping at once. Each row's bar
          // unlocks 0.18 of the progress window later than the previous.
          // Row 0 fully draws by progress = 0.64, row 1 by 0.82, row 2
          // by 1.0 — so the whole sequence still finishes inside
          // MOUNT_ANIM_MS.
          const rowStart = i * 0.18;
          const rowSpan = 1 - 0.36;
          const rowProgress = Math.max(
            0,
            Math.min(1, (progress - rowStart) / rowSpan),
          );
          return (
            <li
              key={c.name}
              className="px-5 md:px-6 py-2.5 sm:py-3.5"
              style={{
                borderBottom: i < CHANNELS.length - 1 ? `1px solid ${BORDER}` : "none",
                backgroundColor: isActive ? "rgba(15,98,254,0.04)" : "transparent",
                transition: "background-color 320ms ease",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 2,
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
                  className="tabular-nums"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: INK,
                    fontWeight: 600,
                  }}
                >
                  ${Math.round(c.spend * rowProgress).toLocaleString()}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2.5">
                <div
                  className="flex-1 relative overflow-hidden"
                  style={{
                    height: 6,
                    borderRadius: 2,
                    backgroundColor: PARCHMENT,
                  }}
                >
                  {/* Bar draws in via scaleX from left so it reads as
                      "data measuring out" rather than a CSS width
                      reflow. transform-origin pinned left so the
                      growth animates from the start of the track. */}
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      backgroundColor: c.color,
                      transform: `scaleX(${rowProgress})`,
                      transformOrigin: "left center",
                      transition: "transform 80ms linear",
                    }}
                  />
                </div>
                <span
                  className="flex-shrink-0 tabular-nums"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: MUTED,
                    fontWeight: 500,
                    minWidth: 88,
                    textAlign: "right",
                  }}
                >
                  {Math.round(c.leads * rowProgress)} ·{" "}
                  {Math.round(c.tours * rowProgress)} ·{" "}
                  <span style={{ color: SUCCESS, fontWeight: 700 }}>
                    {Math.round(c.leases * rowProgress)}L
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Active channel detail — desktop only; the channel rows above already show the data on mobile */}
      <div
        className="hidden sm:block px-5 md:px-6 py-4"
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
              className="mt-1 tabular-nums"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                color: INK,
                fontWeight: 500,
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                ${animInt(cpl)}
              </span>
              <span style={{ color: MUTED }}> CPL · </span>
              <span style={{ fontFamily: "var(--font-mono)", color: ACCENT, fontWeight: 700 }}>
                ${animCurrency(cac)}
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
