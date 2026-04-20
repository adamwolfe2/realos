"use client";

import React, { useEffect, useState } from "react";

const ACCENT = "#2F6FE5";
const SUCCESS = "#3a7d44";
const ERROR = "#b53333";
const INK = "#141413";
const MUTED = "#87867f";
const BORDER = "#f0eee6";
const PARCHMENT = "#faf9f5";

const BARS = [
  { d: "Mon", meta: 18, google: 12, tiktok: 6  },
  { d: "Tue", meta: 22, google: 15, tiktok: 8  },
  { d: "Wed", meta: 28, google: 18, tiktok: 10 },
  { d: "Thu", meta: 34, google: 20, tiktok: 14 },
  { d: "Fri", meta: 30, google: 24, tiktok: 12 },
  { d: "Sat", meta: 26, google: 14, tiktok: 18 },
  { d: "Sun", meta: 20, google: 10, tiktok: 16 },
];

const KPIS = [
  { label: "Leads",           value: "168",  delta: "+12%", tone: "up"   },
  { label: "Tours booked",    value: "31",   delta: "+4%",  tone: "up"   },
  { label: "Applied",         value: "11",   delta: "+9%",  tone: "up"   },
  { label: "Signed leases",   value: "4",    delta: "+1",   tone: "up"   },
  { label: "Cost per tour",   value: "$122", delta: "−8%",  tone: "down" },
  { label: "Cost per lease",  value: "$948", delta: "−11%", tone: "down" },
];

export function WeeklyReportSheet() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    const total = 1800;

    const step = (t: number) => {
      const p = Math.min((t - start) / total, 1);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setTimeout(() => {
          start = performance.now();
          setProgress(0);
          raf = requestAnimationFrame(step);
        }, 4400);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const max = Math.ceil(Math.max(...BARS.map((b) => b.meta + b.google + b.tiktok)) / 10) * 10;

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 30px 80px rgba(20,20,19,0.08)`,
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 md:px-7 py-4 flex items-center justify-between gap-4"
        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 500,
            }}
          >
            Weekly to owner + operator
          </p>
          <p
            className="mt-0.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "20px",
              color: INK,
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            Week of Apr 14 — Apr 20
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5"
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            boxShadow: `0 0 0 1px ${BORDER}`,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1V8M6 8L3 5M6 8L9 5M2 10H10" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: INK,
              fontWeight: 500,
            }}
          >
            PDF
          </span>
        </div>
      </div>

      <div className="px-5 md:px-7 pt-5 pb-3">
        <p
          className="mb-3"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 500,
          }}
        >
          Leads by channel
        </p>
        <div className="flex items-end gap-2 h-[110px]">
          {BARS.map((b, idx) => {
            const total = b.meta + b.google + b.tiktok;
            const reveal = Math.max(0, Math.min(1, progress * BARS.length - idx));
            const heightPct = (total / max) * 100 * reveal;
            const metaPct = (b.meta / total) * 100;
            const googlePct = (b.google / total) * 100;
            const tiktokPct = (b.tiktok / total) * 100;
            return (
              <div key={b.d} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className="w-full max-w-[26px] flex flex-col rounded-md overflow-hidden"
                  style={{
                    height: `${heightPct}%`,
                    minHeight: heightPct > 0 ? "4px" : 0,
                  }}
                >
                  <div style={{ height: `${metaPct}%`,   backgroundColor: ACCENT }} />
                  <div style={{ height: `${googlePct}%`, backgroundColor: "#5B8CE6" }} />
                  <div style={{ height: `${tiktokPct}%`, backgroundColor: "#b0aea5" }} />
                </div>
                <p
                  className="mt-1.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9.5px",
                    color: MUTED,
                  }}
                >
                  {b.d}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Swatch color={ACCENT}    label="Meta" />
          <Swatch color="#5B8CE6"   label="Google" />
          <Swatch color="#b0aea5"   label="TikTok" />
        </div>
      </div>

      <div
        className="px-5 md:px-7 py-4 grid grid-cols-3 gap-2"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        {KPIS.map((k, i) => {
          const shown = progress > (i + 1) / (KPIS.length + 2);
          return (
            <div
              key={k.label}
              style={{
                backgroundColor: PARCHMENT,
                borderRadius: "10px",
                padding: "10px 12px",
                opacity: shown ? 1 : 0.3,
                transform: shown ? "translateY(0)" : "translateY(4px)",
                transition: "opacity 380ms ease, transform 380ms ease",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9.5px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: MUTED,
                  fontWeight: 500,
                }}
              >
                {k.label}
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "18px",
                    color: INK,
                    fontWeight: 500,
                    lineHeight: 1.1,
                  }}
                >
                  {k.value}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: k.tone === "up" ? SUCCESS : ERROR,
                    fontWeight: 600,
                  }}
                >
                  {k.delta}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="px-5 md:px-7 py-3 flex items-center justify-between gap-3"
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
          Sent · Mon 7:00 AM · owner + GM
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: ACCENT,
            fontWeight: 600,
          }}
        >
          ↗ open full report
        </span>
      </div>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          width: "9px",
          height: "9px",
          borderRadius: "2px",
          backgroundColor: color,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: MUTED,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
    </span>
  );
}
