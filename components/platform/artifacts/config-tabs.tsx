"use client";

import React, { useEffect, useState } from "react";
import {
  MetaMark, GoogleMark, TikTokMark, SlackMark, CalcomMark,
  ResendMark, GA4Mark, AppFolioMark, ChatGPTMark, PerplexityMark, ClaudeMark,
  GeminiMark, LinkedInMark, VercelMark, FigmaMark,
} from "./brand-logos";

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";
const SUCCESS = "#16A34A";
const ERROR = "#DC2626";

type Delta = "up" | "down-good" | "down-bad" | "neutral";

type Row = {
  label: string;
  value: string;
  icon: "check" | "home" | "brand" | "chat" | "ads" | "pixel" | "report" | "handshake" | "cal" | "mail" | "search" | "shield" | "phone";
  logos?: React.ReactNode[];
  delta?: Delta;
};

type Step = {
  key: string;
  num: string;
  title: string;
  heading: string;
  headingSub: string;
  countLabel: string;
  rows: Row[];
  footer: string;
};

const STEPS: Step[] = [
  {
    key: "intake",
    num: "01",
    title: "Onboard",
    heading: "Getting to know your portfolio",
    headingSub: "One 30-minute call. We learn your properties, your brand, and your goals.",
    countLabel: "Items captured",
    rows: [
      { label: "Your brand",           value: "Colors, voice, logos locked in",            icon: "brand",     logos: [<FigmaMark key="fig" size={16} />] },
      { label: "Your properties",      value: "4 buildings, 612 units",                     icon: "home",      logos: [<AppFolioMark key="af" size={16} />] },
      { label: "Your markets",         value: "Berkeley, Austin, NYU",                      icon: "home" },
      { label: "Your leasing system",  value: "We connect to what's already running",       icon: "handshake", logos: [<AppFolioMark key="af2" size={16} />] },
      { label: "Your channels",        value: "Where your traffic comes from",              icon: "ads",       logos: [<MetaMark key="m" size={16} />, <GoogleMark key="g" size={16} />, <TikTokMark key="t" size={16} />] },
      { label: "Your team",            value: "Who gets the hot-lead ping",                 icon: "phone",     logos: [<SlackMark key="s" size={16} />, <ResendMark key="r" size={16} />] },
      { label: "Your workflow",        value: "Converting leads to tours to applications",  icon: "check" },
      { label: "Your contract",        value: "Free trial, month-to-month, maximum flexibility", icon: "shield" },
    ],
    footer: "Onboarding complete. We have everything we need to start unlocking your leasing intelligence.",
  },
  {
    key: "customize",
    num: "02",
    title: "Customize",
    heading: "We build every module",
    headingSub: "Your single insightful leasing intelligence platform, live in fourteen days.",
    countLabel: "Modules shipped",
    rows: [
      { label: "Data analytics",                       value: "Every channel, every signal, unified",       icon: "report", logos: [<GA4Mark key="ga" size={16} />, <AppFolioMark key="af" size={16} />] },
      { label: "Custom site (optional)",               value: "Your domain, capturing every visit",         icon: "home",   logos: [<VercelMark key="v" size={16} />, <FigmaMark key="fig" size={16} />] },
      { label: "Visitor identification (optional)",    value: "Names plus emails on your traffic",          icon: "pixel",  logos: [<GA4Mark key="ga2" size={16} />, <LinkedInMark key="li" size={16} />] },
      { label: "AI chatbot (optional)",                value: "Trained on each individual property",        icon: "chat",   logos: [<ClaudeMark key="cl" size={16} />] },
      { label: "Ad campaigns (optional)",              value: "Launched and pacing",                        icon: "ads",    logos: [<MetaMark key="m" size={16} />, <GoogleMark key="g" size={16} />, <TikTokMark key="t" size={16} />] },
      { label: "AI discovery (optional)",              value: "Pages written to be cited",                  icon: "search", logos: [<ChatGPTMark key="c" size={16} />, <PerplexityMark key="p" size={16} />, <ClaudeMark key="cl2" size={16} />, <GeminiMark key="gem" size={16} />] },
      { label: "Reputation management (optional)",     value: "Live mentions and review monitoring",        icon: "shield", logos: [<GoogleMark key="g2" size={16} />] },
      { label: "Keyword optimization (optional)",      value: "AI-guided effective keyword rankings",       icon: "search", logos: [<GoogleMark key="g3" size={16} />] },
    ],
    footer: "Custom data modules live and running. One login, one bill.",
  },
  {
    key: "launch",
    num: "03",
    title: "Launch",
    heading: "Your data goes live, day fourteen",
    headingSub: "Live monitoring, automated reports, and AI recommendations flowing the same week we launch.",
    countLabel: "Go-live signals",
    rows: [
      { label: "Custom LeaseStack",       value: "Live, indexed, and tracking",                 icon: "shield", logos: [<VercelMark key="v" size={16} />, <GA4Mark key="ga" size={16} />] },
      { label: "Automated reports",       value: "First weekly insights delivered to your team", icon: "report", logos: [<ResendMark key="r" size={16} />] },
      { label: "AI recommendations",      value: "Daily actions, prioritized by impact",         icon: "check",  logos: [<ClaudeMark key="cl" size={16} />] },
      { label: "Channel monitoring",      value: "Anomalies flagged across every source",        icon: "ads",    logos: [<MetaMark key="m" size={16} />, <GoogleMark key="g2" size={16} />, <TikTokMark key="t" size={16} />] },
      { label: "AI search discovery",     value: "Your pages being indexed and quoted",          icon: "search", logos: [<ChatGPTMark key="c" size={16} />, <PerplexityMark key="p" size={16} />, <ClaudeMark key="cl2" size={16} />, <GeminiMark key="gem" size={16} />, <GoogleMark key="g3" size={16} />] },
      { label: "Visitor identification",  value: "Contact info flowing into your CRM",           icon: "pixel",  logos: [<GA4Mark key="ga2" size={16} />, <LinkedInMark key="li" size={16} />] },
      { label: "Keyword insights",        value: "Ranking opportunities surfaced weekly",        icon: "search", logos: [<GoogleMark key="g4" size={16} />] },
      { label: "Operator access",         value: "Live dashboards open to your team",            icon: "mail",   logos: [<SlackMark key="s" size={16} />, <ResendMark key="r2" size={16} />] },
    ],
    footer: "Your custom LeaseStack is live. First insights and recommendations are flowing.",
  },
  {
    key: "report",
    num: "04",
    title: "Weekly",
    heading: "Monday mornings, the Operator Report",
    headingSub: "One PDF of insights. Live dashboards open whenever you want to dig deeper.",
    countLabel: "This week's snapshot",
    rows: [
      { label: "New leads",          value: "168, up 12% vs last week",     icon: "check",  delta: "up",        logos: [<MetaMark key="m" size={16} />, <GoogleMark key="g" size={16} />, <TikTokMark key="t" size={16} />] },
      { label: "Tours booked",       value: "31, up 4% vs last week",       icon: "cal",    delta: "up",        logos: [<CalcomMark key="c" size={16} />] },
      { label: "Applications",       value: "11, up 9% vs last week",       icon: "mail",   delta: "up",        logos: [<AppFolioMark key="af" size={16} />] },
      { label: "Leases signed",      value: "4, up 1 vs last week",         icon: "home",   delta: "up",        logos: [<AppFolioMark key="af2" size={16} />] },
      { label: "Cost per lease",     value: "$948, down 11% vs last month", icon: "report", delta: "down-good" },
      { label: "AI recommendations", value: "3 new actions for this week",   icon: "check",  logos: [<ClaudeMark key="cl" size={16} />] },
      { label: "Visitors identified", value: "312 named this week",         icon: "pixel",  logos: [<LinkedInMark key="li" size={16} />, <GA4Mark key="ga" size={16} />] },
      { label: "Delivered to",       value: "Operator and GM, Monday 7am",  icon: "mail",   logos: [<ResendMark key="r" size={16} />, <SlackMark key="s" size={16} />] },
    ],
    footer: "One weekly report. Open your live dashboards anytime to dig deeper.",
  },
];

export function ConfigTabs() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % STEPS.length);
    }, 5200);
    return () => clearInterval(id);
  }, [paused]);

  const step = STEPS[active];

  return (
    <div
      className="w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(30, 42, 58,0.06)`,
        overflow: "hidden",
      }}
    >
      <div
        className="grid grid-cols-4"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        {STEPS.map((s, i) => {
          const isActive = i === active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setPaused(true);
                setActive(i);
              }}
              className="px-3 py-3 md:px-4 md:py-4 text-left transition-colors"
              style={{
                backgroundColor: isActive ? ACCENT : "transparent",
                color: isActive ? "#ffffff" : MUTED,
                borderRight: i < STEPS.length - 1 ? `1px solid ${BORDER}` : "none",
                cursor: "pointer",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  fontWeight: 500,
                  opacity: isActive ? 0.85 : 0.7,
                }}
              >
                {s.num}
              </p>
              <p
                className="mt-0.5"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  letterSpacing: "0.02em",
                  fontWeight: 600,
                }}
              >
                {s.title}
              </p>
            </button>
          );
        })}
      </div>

      <div key={step.key} style={{ animation: "configFade 420ms ease" }}>
        <div className="flex items-start justify-between gap-4 px-5 md:px-7 pt-6">
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.14em",
                color: MUTED,
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              Step {step.num}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "18px",
                color: INK,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.015em",
              }}
            >
              {step.heading}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12.5px",
                color: "#64748B",
                lineHeight: 1.45,
              }}
            >
              {step.headingSub}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "28px",
                color: INK,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.025em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {step.rows.length}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: MUTED,
                fontWeight: 500,
              }}
            >
              {step.countLabel}
            </p>
          </div>
        </div>

        <ul className="mt-4 px-3 md:px-4 pb-4" style={{ minHeight: "408px" }}>
          {step.rows.map((row, i) => (
            <li
              key={row.label}
              className="flex items-center gap-3 px-2 md:px-3 py-2.5 rounded-lg"
              style={{
                backgroundColor: i % 2 === 0 ? PARCHMENT : "transparent",
                animation: `configRow 480ms ease both`,
                animationDelay: `${i * 45}ms`,
              }}
            >
              <FeatureIcon kind={row.icon} />
              <span
                className="flex-1 truncate"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13.5px",
                  color: INK,
                  fontWeight: 500,
                }}
              >
                {row.label}
              </span>
              <span
                className="hidden sm:inline truncate"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: deltaColor(row.delta) ?? "#64748B",
                  fontWeight: row.delta ? 600 : 400,
                  maxWidth: "52%",
                  textAlign: "right",
                }}
              >
                {row.value}
              </span>
              {row.logos && row.logos.length > 0 ? (
                <span className="hidden md:inline-flex items-center gap-1 flex-shrink-0">
                  {row.logos}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <div
          className="mx-5 md:mx-7 mb-5 px-4 py-3 flex items-center gap-2"
          style={{
            backgroundColor: ACCENT,
            color: "#ffffff",
            borderRadius: "3px",
          }}
        >
          <CheckSolid />
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {step.footer}
          </span>
        </div>
      </div>

      <div
        className="px-5 md:px-7 py-3 flex items-center gap-2 flex-wrap"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <span
          className="inline-block"
          style={{
            width: "8px",
            height: "8px",
            backgroundColor: ACCENT,
            borderRadius: "1px",
          }}
        />
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
          {paused ? "Paused. Move your mouse away to resume" : "Live walkthrough. Click any step to jump"}
        </span>
      </div>

      <style jsx>{`
        @keyframes configFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes configRow {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function deltaColor(d?: Delta) {
  if (d === "up") return SUCCESS;
  if (d === "down-good") return SUCCESS;
  if (d === "down-bad") return ERROR;
  return null;
}

function FeatureIcon({ kind }: { kind: Row["icon"] }) {
  const wrap = {
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    backgroundColor: "rgba(37,99,235,0.12)",
    color: ACCENT,
  } as const;
  return (
    <span className="inline-flex items-center justify-center flex-shrink-0" style={wrap}>
      <IconGlyph kind={kind} />
    </span>
  );
}

function IconGlyph({ kind }: { kind: Row["icon"] }) {
  const p = { width: 12, height: 12, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (kind) {
    case "check":     return <svg {...p}><path d="M3 7l2.5 2.5L11 4" /></svg>;
    case "home":      return <svg {...p}><path d="M2 7L7 3L12 7V12H8V9H6V12H2V7Z" /></svg>;
    case "brand":     return <svg {...p}><path d="M4 3h6v3h-2v5h-2v-5H4V3Z" fill="currentColor" stroke="none"/></svg>;
    case "chat":      return <svg {...p}><path d="M2 3H12V9H5L2 11V3Z" /></svg>;
    case "ads":       return <svg {...p}><path d="M2 5H5L9 2V12L5 9H2V5Z" /></svg>;
    case "pixel":     return <svg {...p}><circle cx="7" cy="7" r="4"/><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>;
    case "report":    return <svg {...p}><path d="M3 11V3h8v8H3Zm2-4h4M5 9h4M5 5h3"/></svg>;
    case "handshake": return <svg {...p}><path d="M2 8l3-3 2 2 3-3 2 2v3l-3 3-2-2-3 3-2-2V8Z"/></svg>;
    case "cal":       return <svg {...p}><rect x="2" y="3" width="10" height="9" rx="1.5"/><path d="M2 6h10M5 2v2M9 2v2"/></svg>;
    case "mail":      return <svg {...p}><path d="M2 4h10v6H2V4Zm0 0l5 4 5-4"/></svg>;
    case "search":    return <svg {...p}><circle cx="6" cy="6" r="3.5"/><path d="M9 9l3 3"/></svg>;
    case "shield":    return <svg {...p}><path d="M7 2L3 4v3c0 3 2 5 4 5s4-2 4-5V4L7 2Z"/></svg>;
    case "phone":     return <svg {...p}><path d="M3 3C3 3 4 5 6 7C8 9 11 10 11 10L12 8L9 7L8 8C8 8 7 7 6 6C5 5 6 4 6 4L5 2L3 3Z" fill="currentColor" stroke="none"/></svg>;
  }
}

function CheckSolid() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="7" fill="rgba(255,255,255,0.22)" />
      <path
        d="M3.5 7L6 9.5L10.5 4.5"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
