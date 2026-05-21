"use client";

import React from "react";

// ---------------------------------------------------------------------------
// PacingAlert — early-warning lease-up trendline.
//
// The signal that proves the platform is *predictive*, not just reportive.
// Two lines: last cycle (muted) and this cycle (cobalt). This cycle is
// pacing 11% behind by week 19; the alert fires 4-8 weeks before that
// gap shows up in physical occupancy.
//
// Built as a small hand-rendered SVG line chart — no recharts, no chart
// library. Light enough to ship inline, honest about the shape of the
// data. Used in the CapabilitiesRail as the right-column artifact for
// capability 05.
// ---------------------------------------------------------------------------

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";
// Norman feedback (2026-05-21): every chart + accent on the marketing
// surface stays on the brand blue ramp. Darker brand-blue reads as the
// active alert, lighter blue carries the muted background, and SUCCESS
// is the same brand blue used for the chart line — no semantic
// green/amber/red on the marketing site.
const WARN = "#1E40AF";
const WARN_BG = "rgba(37, 99, 235, 0.08)";
const SUCCESS = "#2563EB";

// 24-week cycle. Values are cumulative leases signed each week.
const LAST_CYCLE = [
  2, 4, 7, 11, 16, 22, 29, 37, 46, 56, 67, 79, 92, 104, 117, 131, 146, 162, 179, 197, 215, 232, 247, 260,
];
// This cycle: tracks ahead through week 12, then a slowdown — exactly the
// kind of inflection a weekly cron catches before occupancy does.
const THIS_CYCLE = [
  3, 6, 10, 15, 21, 28, 35, 43, 52, 62, 73, 85, 96, 105, 113, 120, 127, 134, 141,
  // null markers for "future" weeks, rendered as projected dashed
];

// Where the alert fires (current week)
const ALERT_WEEK_INDEX = 18; // week 19 (0-indexed 18)

export function PacingAlert() {
  const width = 560;
  const height = 220;
  const padX = 28;
  const padTop = 24;
  const padBottom = 36;

  const allValues = [...LAST_CYCLE, ...THIS_CYCLE];
  const maxY = Math.ceil(Math.max(...allValues) / 50) * 50; // round up to nearest 50
  const weeks = LAST_CYCLE.length;

  const xFor = (i: number) =>
    padX + (i / (weeks - 1)) * (width - padX * 2);
  const yFor = (v: number) =>
    padTop + (1 - v / maxY) * (height - padTop - padBottom);

  const linePath = (data: number[]) =>
    data
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`)
      .join(" ");

  const areaPath = (data: number[]) =>
    `${linePath(data)} L ${xFor(data.length - 1)} ${height - padBottom} L ${xFor(0)} ${height - padBottom} Z`;

  // Alert annotation position
  const alertX = xFor(ALERT_WEEK_INDEX);
  const alertY = yFor(THIS_CYCLE[ALERT_WEEK_INDEX]);

  // Pacing gap math
  const lastAtAlert = LAST_CYCLE[ALERT_WEEK_INDEX];
  const thisAtAlert = THIS_CYCLE[ALERT_WEEK_INDEX];
  const gapPct = Math.round(((thisAtAlert - lastAtAlert) / lastAtAlert) * 100);
  const isBehind = gapPct < 0;

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
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 600,
            }}
          >
            Lease-up · cumulative leases signed
          </p>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              color: INK,
              fontWeight: 600,
            }}
          >
            Telegraph Commons · 612 units · cycle week 19 of 24
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 px-2.5 py-1"
          style={{
            backgroundColor: WARN_BG,
            borderRadius: 6,
            border: `1px solid rgba(245, 158, 11, 0.25)`,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: WARN,
              animation: "alertPulse 1.4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: WARN,
              fontWeight: 700,
            }}
          >
            Pacing alert
          </span>
        </span>
      </div>

      {/* Chart */}
      <div className="px-3 md:px-4 py-4" style={{ backgroundColor: "#FFFFFF" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ display: "block", height: "auto" }}
          role="img"
          aria-label={`Lease-up trendline showing this cycle pacing ${gapPct}% ${isBehind ? "behind" : "ahead of"} last cycle at week 19.`}
        >
          {/* Y axis gridlines */}
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1={padX}
              x2={width - padX}
              y1={padTop + t * (height - padTop - padBottom)}
              y2={padTop + t * (height - padTop - padBottom)}
              stroke={BORDER}
              strokeDasharray={t === 1 ? "" : "2 3"}
              strokeWidth={1}
            />
          ))}

          {/* Last cycle, muted */}
          <path
            d={linePath(LAST_CYCLE)}
            fill="none"
            stroke={MUTED}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* This cycle, area + line */}
          <defs>
            <linearGradient id="thisCycleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.15" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath(THIS_CYCLE)} fill="url(#thisCycleFill)" />
          <path
            d={linePath(THIS_CYCLE)}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Alert pin on current week */}
          <line
            x1={alertX}
            x2={alertX}
            y1={padTop}
            y2={height - padBottom}
            stroke={WARN}
            strokeDasharray="2 3"
            strokeWidth={1}
            opacity={0.6}
          />
          <circle
            cx={alertX}
            cy={alertY}
            r={9}
            fill="#FFFFFF"
            stroke={WARN}
            strokeWidth={2}
          />
          <circle cx={alertX} cy={alertY} r={3.5} fill={WARN} />

          {/* X axis labels, week markers */}
          {[0, 6, 12, 18, 23].map((i) => (
            <text
              key={i}
              x={xFor(i)}
              y={height - padBottom + 18}
              fontFamily="var(--font-mono)"
              fontSize="10"
              fill={MUTED}
              textAnchor="middle"
              fontWeight={500}
              letterSpacing="0.08em"
            >
              W{i + 1}
            </text>
          ))}

          {/* Legend swatches */}
          <g transform={`translate(${padX}, 8)`}>
            <rect x={0} y={0} width={10} height={2} fill={ACCENT} rx={1} />
            <text x={14} y={4} fontFamily="var(--font-mono)" fontSize="9.5" fill={INK} fontWeight={600} letterSpacing="0.08em">
              THIS CYCLE
            </text>
            <rect x={92} y={0} width={10} height={2} fill={MUTED} rx={1} />
            <text x={106} y={4} fontFamily="var(--font-mono)" fontSize="9.5" fill={MUTED} fontWeight={500} letterSpacing="0.08em">
              LAST CYCLE
            </text>
          </g>
        </svg>
      </div>

      {/* Alert callout */}
      <div
        className="px-5 md:px-6 py-4"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: WARN_BG }}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              backgroundColor: WARN,
              color: "#FFFFFF",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              marginTop: 1,
            }}
          >
            !
          </span>
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: INK,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              Pacing {Math.abs(gapPct)}% behind last cycle at week 19. Projected to land 14 units short of full lease-up.
            </p>
            <p
              className="mt-1.5"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                color: "#64748B",
                lineHeight: 1.5,
              }}
            >
              Detected <span style={{ color: SUCCESS, fontWeight: 600 }}>6 weeks before</span> occupancy would have shown the gap. Three recommended actions queued in the weekly report.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes alertPulse {
          0%, 100% { transform: scale(1);   opacity: 1;    }
          50%      { transform: scale(1.4); opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
