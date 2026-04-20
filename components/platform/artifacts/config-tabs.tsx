"use client";

import React, { useEffect, useState } from "react";

type Row = { label: string; value: string; path: string };

type Step = {
  key: string;
  num: string;
  title: string;
  subtitle: string;
  fieldsLabel: string;
  rows: Row[];
  footer: string;
};

const STEPS: Step[] = [
  {
    key: "intake",
    num: "01",
    title: "Intake",
    subtitle: "portfolio.config.ts",
    fieldsLabel: "fields set",
    rows: [
      { label: "Operator",       value: "Acme Residential",        path: "org.name" },
      { label: "Portfolio",      value: "4 properties · 612 units", path: "portfolio.size" },
      { label: "Primary color",  value: "#2F6FE5",                  path: "branding.primary" },
      { label: "Primary domain", value: "live.acmeres.com",         path: "domain.primary" },
      { label: "Markets",        value: "Berkeley, Austin, NYU",    path: "portfolio.markets" },
      { label: "Stage gates",    value: "Lead → Tour → Lease",      path: "funnel.stages" },
      { label: "Channels",       value: "Meta, Google, TikTok, SEO",path: "ads.channels" },
      { label: "Billing",        value: "Monthly, net-30",          path: "billing.terms" },
    ],
    footer: "Intake complete — 8 fields captured from a 30-minute call.",
  },
  {
    key: "build",
    num: "02",
    title: "Build",
    subtitle: "assets.pipeline.ts",
    fieldsLabel: "assets shipped",
    rows: [
      { label: "Marketing site",    value: "12 pages, on-brand",      path: "site.published" },
      { label: "Pixel",             value: "Installed, identifying",  path: "pixel.live" },
      { label: "Chatbot",           value: "Trained on your voice",   path: "chatbot.ready" },
      { label: "Ad campaigns",      value: "Meta + Google, launched", path: "ads.live" },
      { label: "Creative variants", value: "24 static, 6 video",      path: "creative.count" },
      { label: "CRM",               value: "Connected to leasing",    path: "crm.synced" },
      { label: "Reporting",         value: "Monday weekly, PDF",      path: "reports.cadence" },
    ],
    footer: "Build complete — every surface live, one login, one bill.",
  },
  {
    key: "launch",
    num: "03",
    title: "Launch",
    subtitle: "go-live.checklist",
    fieldsLabel: "checks passed",
    rows: [
      { label: "DNS",              value: "CNAME verified",         path: "dns.ready" },
      { label: "SSL",              value: "Issued, auto-renew",     path: "ssl.active" },
      { label: "Tracking",         value: "GA4 + pixel confirmed",  path: "analytics.ok" },
      { label: "Chatbot QA",       value: "27 prompts passed",      path: "chatbot.qa" },
      { label: "Ads live",         value: "Meta + Google spending", path: "ads.spend" },
      { label: "Lead routing",     value: "Email + CRM + Slack",    path: "routing.ok" },
      { label: "Owner access",     value: "Invite sent",            path: "owner.invited" },
    ],
    footer: "Launched in 14 days — domain live, first leads flowing.",
  },
  {
    key: "report",
    num: "04",
    title: "Weekly",
    subtitle: "report.monday.pdf",
    fieldsLabel: "metrics tracked",
    rows: [
      { label: "Leads",            value: "168  ↑ 12%",  path: "kpi.leads" },
      { label: "Tours booked",     value: "31  ↑ 4%",    path: "kpi.tours" },
      { label: "Applied",          value: "11  ↑ 9%",    path: "kpi.applied" },
      { label: "Signed",           value: "4  ↑ 1",      path: "kpi.signed" },
      { label: "Cost per tour",    value: "$122  ↓ 8%",  path: "kpi.cpt" },
      { label: "Cost per lease",   value: "$948  ↓ 11%", path: "kpi.cpl" },
      { label: "Delivered to",     value: "owner + GM",  path: "report.distro" },
    ],
    footer: "Weekly recap delivered every Monday, 7:00 AM local.",
  },
];

const ACCENT = "#2F6FE5";
const INK = "#141413";
const MUTED = "#87867f";
const BORDER = "#f0eee6";
const PARCHMENT = "#faf9f5";

export function ConfigTabs() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % STEPS.length);
    }, 4800);
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
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(20,20,19,0.06)`,
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
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
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
        <div
          className="flex items-start justify-between gap-4 px-5 md:px-7 pt-6"
        >
          <div>
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
              Step {step.num} · {step.title}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                color: INK,
                fontWeight: 500,
              }}
            >
              {step.subtitle}
            </p>
          </div>
          <div className="text-right">
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "28px",
                color: INK,
                fontWeight: 500,
                lineHeight: 1,
              }}
            >
              {step.rows.length}/{step.rows.length}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: MUTED,
                fontWeight: 500,
              }}
            >
              {step.fieldsLabel}
            </p>
          </div>
        </div>

        <ul className="mt-4 px-3 md:px-4 pb-4">
          {step.rows.map((row, i) => (
            <li
              key={row.path}
              className="flex items-center gap-3 px-2 md:px-3 py-2.5 rounded-lg"
              style={{
                backgroundColor: i % 2 === 0 ? PARCHMENT : "transparent",
                animation: `configRow 480ms ease both`,
                animationDelay: `${i * 45}ms`,
              }}
            >
              <Check />
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
                  color: "#4d4c48",
                  maxWidth: "45%",
                  textAlign: "right",
                }}
              >
                {row.value}
              </span>
              <span
                className="hidden md:inline"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: MUTED,
                  minWidth: "130px",
                  textAlign: "right",
                }}
              >
                {row.path}
              </span>
            </li>
          ))}
        </ul>

        <div
          className="mx-5 md:mx-7 mb-5 px-4 py-3 flex items-center gap-2"
          style={{
            backgroundColor: ACCENT,
            color: "#ffffff",
            borderRadius: "10px",
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
          Live demo — {paused ? "paused · hover out to resume" : "auto-advances"} · click any tab to jump
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

function Check() {
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        backgroundColor: "rgba(47,111,229,0.12)",
        color: ACCENT,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M1.5 5L4 7.5L8.5 2.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
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
