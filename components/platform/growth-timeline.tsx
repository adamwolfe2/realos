"use client";

import React, { useEffect, useState } from "react";

type TimelineStep = {
  when: string;
  title: string;
  body: string;
  metric?: string;
  metricTone?: "neutral" | "up";
};

const TIMELINE: TimelineStep[] = [
  { when: "Day 1",  title: "Intake call",       body: "30-minute audit. Build plan locked." },
  { when: "Day 7",  title: "Site preview",      body: "Custom site on staging. You approve." },
  { when: "Day 14", title: "Live on your domain", body: "Pixel, chatbot, ads all firing.", metric: "Launch",          metricTone: "neutral" },
  { when: "Day 30", title: "First leases",      body: "Leads flowing. Tours booking.",      metric: "+40 leads",       metricTone: "up"      },
  { when: "Day 60", title: "Cost curves drop",  body: "Ads optimized. AI engines citing you.", metric: "-8% per tour", metricTone: "up"      },
  { when: "Day 90", title: "Compounding",       body: "Portfolio-wide. Real growth.",       metric: "+12% MoM",        metricTone: "up"      },
];

const ACCENT = "#2F6FE5";
const ACCENT_GLOW = "rgba(47,111,229,0.35)";
const SUCCESS = "#1f7a3a";
const INK = "#141413";
const MUTED = "#87867f";

export function GrowthTimeline() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % TIMELINE.length);
    }, 2200);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p
            style={{
              color: ACCENT,
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Your first 90 days
          </p>
          <h3
            className="mt-2"
            style={{
              color: INK,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 3.2vw, 38px)",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.005em",
            }}
          >
            Launch on day fourteen. Compound from day one.
          </h3>
        </div>
        <p
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {paused ? "Paused · hover out to resume" : "Auto-playing · hover to pause"}
        </p>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 relative">
        <div
          aria-hidden
          className="hidden lg:block absolute"
          style={{
            top: "32px",
            left: "8%",
            right: "8%",
            height: "2px",
            background: `linear-gradient(to right, ${ACCENT} 0%, ${ACCENT} ${progressPercent(active)}%, #f0eee6 ${progressPercent(active)}%, #f0eee6 100%)`,
            transition: "background 640ms ease",
          }}
        />
        {TIMELINE.map((step, i) => {
          const isActive = i === active;
          const hasPassed = i < active;
          return (
            <li
              key={step.when}
              onClick={() => {
                setPaused(true);
                setActive(i);
              }}
              className="relative p-5 cursor-pointer"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "14px",
                boxShadow: isActive
                  ? `0 0 0 2px ${ACCENT}, 0 10px 30px ${ACCENT_GLOW}`
                  : `0 0 0 1px #f0eee6`,
                transform: isActive ? "translateY(-4px)" : "translateY(0)",
                transition: "box-shadow 420ms ease, transform 420ms ease, opacity 420ms ease",
                opacity: isActive || hasPassed ? 1 : 0.72,
                zIndex: isActive ? 2 : 1,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block relative"
                  style={{
                    width: isActive ? "12px" : "10px",
                    height: isActive ? "12px" : "10px",
                    borderRadius: "50%",
                    backgroundColor: hasPassed || isActive ? ACCENT : "#b0aea5",
                    boxShadow: isActive
                      ? `0 0 0 4px #ffffff, 0 0 0 6px ${ACCENT_GLOW}`
                      : `0 0 0 4px #ffffff`,
                    transition: "width 320ms ease, height 320ms ease, background-color 320ms ease, box-shadow 320ms ease",
                  }}
                >
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        borderRadius: "50%",
                        backgroundColor: ACCENT,
                        opacity: 0.4,
                        animation: "gtPulse 1.8s ease-out infinite",
                      }}
                    />
                  ) : null}
                </span>
                <p
                  style={{
                    color: hasPassed || isActive ? ACCENT : MUTED,
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    transition: "color 320ms ease",
                  }}
                >
                  {step.when}
                </p>
              </div>
              <h4
                className="mt-3"
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "18px",
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                {step.title}
              </h4>
              <p
                className="mt-2"
                style={{
                  color: "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {step.body}
              </p>
              {step.metric ? (
                <p
                  className="mt-3"
                  style={{
                    color: step.metricTone === "up" ? SUCCESS : ACCENT,
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    padding: "4px 8px",
                    backgroundColor: step.metricTone === "up"
                      ? (isActive ? "rgba(31,122,58,0.18)" : "rgba(31,122,58,0.10)")
                      : (isActive ? "rgba(47,111,229,0.18)" : "rgba(47,111,229,0.10)"),
                    borderRadius: "6px",
                    display: "inline-block",
                    transition: "background-color 320ms ease",
                  }}
                >
                  {step.metric}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <style jsx>{`
        @keyframes gtPulse {
          0%   { transform: scale(1);   opacity: 0.4; }
          70%  { transform: scale(2.6); opacity: 0;   }
          100% { transform: scale(2.6); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}

function progressPercent(active: number) {
  if (TIMELINE.length <= 1) return 0;
  return Math.round((active / (TIMELINE.length - 1)) * 100);
}
