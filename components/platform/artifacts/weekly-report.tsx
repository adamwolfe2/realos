"use client";

import React from "react";
import { ResendMark, SlackMark } from "./brand-logos";

// ---------------------------------------------------------------------------
// WeeklyReport — Monday-morning email artifact.
//
// What an operator actually sees in their inbox at 7am Monday: leases
// attributed to source, pacing vs. last cycle, anomalies, and three
// concrete actions for the week. This is the payoff product surface — the
// thing the platform's weekly report module produces. Used in the
// CapabilitiesRail as the right-column artifact for capability 01.
//
// Design intent: looks like a real email open in a desktop client, not a
// marketing mockup. Subject line, sender, faux email-chrome header. Body
// is a clean editorial layout with one chart strip + a numbered action
// list. Hairline borders, no cards-within-cards.
// ---------------------------------------------------------------------------

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";
// Norman feedback (2026-05-21): every chart / accent stays on the
// brand blue ramp. SUCCESS = brand blue, WARN = a darker brand-blue
// shade for emphasis. The ATTRIBUTION channels also walk down the
// blue ramp from darkest to lightest so the channel mix bar reads
// like a single brand surface, not a rainbow.
const SUCCESS = "#2563EB";
const WARN = "#1E40AF";

const ATTRIBUTION = [
  { channel: "Google Ads",        leases: 4, share: 36, color: "#1E40AF" },
  { channel: "Meta",              leases: 3, share: 27, color: "#2563EB" },
  { channel: "Organic search",    leases: 2, share: 18, color: "#3B82F6" },
  { channel: "Resident referral", leases: 1, share: 10, color: "#60A5FA" },
  { channel: "Direct / brand",    leases: 1, share: 9,  color: "#93C5FD" },
];

const ACTIONS = [
  {
    text: "Shift $600 from Meta into Google. Google CPL is $48; Meta is $112 this cycle.",
    tag: "Spend",
  },
  {
    text: "Refresh the 2-bed creative. CTR down 32% over the last 10 days.",
    tag: "Creative",
  },
  {
    text: "Tour booking rate dropped on weekends. Approve the after-hours chatbot follow-up.",
    tag: "Workflow",
  },
];

export function WeeklyReport() {
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
      {/* Faux email header — hidden on mobile, the artifact's job there is one-glance density */}
      <div
        className="hidden sm:block px-5 md:px-6 py-4"
        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: "#FFFFFF",
                border: `1px solid ${BORDER}`,
              }}
            >
              <ResendMark size={14} />
            </span>
            <div className="min-w-0">
              <p
                className="truncate"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: INK,
                  fontWeight: 600,
                }}
              >
                LeaseStack weekly · Telegraph Commons
              </p>
              <p
                className="truncate"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: MUTED,
                  marginTop: 1,
                  letterSpacing: "0.04em",
                }}
              >
                reports@leasestack.co · today, 7:02 AM
              </p>
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: SUCCESS,
              fontWeight: 700,
            }}
          >
            ● Delivered
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 md:px-6 py-4 sm:py-5">
        {/* Subject + lead */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          Week 19 · Mon Nov 10 → Sun Nov 16
        </p>
        <h4
          className="mt-2 text-[16px] sm:text-[19px]"
          style={{
            fontFamily: "var(--font-sans)",
            color: INK,
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
          }}
        >
          11 new leases. Pacing 4 weeks ahead of last cycle.
        </h4>

        {/* Attribution strip */}
        <div className="mt-5">
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
            Leases · attributed to source
          </p>
          <div
            className="mt-2.5 flex overflow-hidden"
            style={{
              height: 10,
              borderRadius: 4,
              backgroundColor: PARCHMENT,
            }}
            role="img"
            aria-label="Leases attributed to source: Google Ads 36%, Meta 27%, Organic 18%, Referral 10%, Direct 9%"
          >
            {ATTRIBUTION.map((a) => (
              <div
                key={a.channel}
                style={{
                  width: `${a.share}%`,
                  backgroundColor: a.color,
                  height: "100%",
                }}
              />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 sm:grid-cols-2 gap-x-3 gap-y-1.5">
            {ATTRIBUTION.map((a, idx) => (
              <li
                key={a.channel}
                className={`flex items-center gap-2 min-w-0 ${idx >= 3 ? "hidden sm:flex" : ""}`}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: a.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    color: INK,
                    fontWeight: 500,
                  }}
                >
                  {a.channel}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: MUTED,
                    fontWeight: 500,
                    marginLeft: "auto",
                  }}
                >
                  {a.leases} · {a.share}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Three actions */}
        <div
          className="mt-5 pt-4"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: WARN,
              fontWeight: 700,
            }}
          >
            ▸ Three things to do this week
          </p>
          <ol className="mt-3 space-y-2.5">
            {ACTIONS.map((a, i) => (
              <li
                key={a.text}
                className={`flex items-start gap-3 ${i >= 2 ? "hidden sm:flex" : ""}`}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: INK,
                  lineHeight: 1.5,
                }}
              >
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "rgba(37, 99, 235, 0.10)",
                    color: ACCENT,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: MUTED,
                      fontWeight: 600,
                      marginRight: 8,
                    }}
                  >
                    {a.tag}
                  </span>
                  {a.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Footer, delivery channels — desktop only; mobile drops it to keep the artifact short */}
      <div
        className="hidden sm:flex px-5 md:px-6 py-3 items-center justify-between gap-3"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 500,
          }}
        >
          Delivered every Monday · 7am local
        </span>
        <span className="inline-flex items-center gap-2">
          <ResendMark size={14} />
          <SlackMark size={14} />
        </span>
      </div>
    </div>
  );
}
