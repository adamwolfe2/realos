"use client";

import * as React from "react";
import { Check, Minus, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Compressed tier comparison table.
//
// Earlier version had 40+ rows in 9 sections, which dominated the page
// and forced a long scroll. New approach:
//
//   1. Show ONLY 8 "deal-breaker" rows by default — the ones that
//      actually drive a tier decision (visitor ID, paid ads, audience
//      sync, support SLA, etc.). 90% of buyers decide on these.
//   2. Hide the long-form 40-row matrix behind a "Show every detail"
//      disclosure for the obsessive buyer who wants the dense table.
//
// Compact mode is the default. Open the disclosure to expand.
// ---------------------------------------------------------------------------

type Cell = boolean | string;
type Row = { feature: string; foundation: Cell; growth: Cell; scale: Cell };

// Headline rows that drive tier decisions. Anything that isn't a deal-
// breaker belongs in the full table behind the disclosure below.
const HEADLINE_ROWS: Row[] = [
  {
    feature: "Identified visitors per month (visitor pixel)",
    foundation: "Connected, read-only",
    growth: "5,000",
    scale: "25,000",
  },
  {
    feature: "AI chatbot conversations per month",
    foundation: "1,000",
    growth: "5,000",
    scale: "Unlimited",
  },
  {
    feature: "Source-to-lease attribution (Google, Meta, GSC, GA4)",
    foundation: "Read-only snapshot",
    growth: true,
    scale: true,
  },
  {
    feature: "Operator-written weekly recommendation",
    foundation: "One per pilot",
    growth: "Weekly",
    scale: "Weekly + portfolio rollup",
  },
  {
    feature: "Audience sync (Meta, Google, TikTok)",
    foundation: false,
    growth: false,
    scale: true,
  },
  {
    feature: "Outbound email",
    foundation: false,
    growth: false,
    scale: "3,000 per month",
  },
  {
    feature: "Dedicated operator success contact",
    foundation: false,
    growth: false,
    scale: true,
  },
  {
    feature: "Commitment",
    foundation: "Free, no card",
    growth: "Month-to-month",
    scale: "Month-to-month",
  },
];

// Full feature matrix. Rendered only when the disclosure opens. Every
// row is a real platform capability, not a service promise. If you're
// editing this list, make sure the feature genuinely ships at that
// tier today.
const FULL_SECTIONS: Array<{ title: string; rows: Row[] }> = [
  {
    title: "Marketing site",
    rows: [
      { feature: "In-product site builder", foundation: true, growth: true, scale: true },
      { feature: "Live AppFolio listings sync", foundation: true, growth: true, scale: true },
      { feature: "Custom domain with SSL", foundation: true, growth: true, scale: true },
      { feature: "Mobile responsive layouts", foundation: true, growth: true, scale: true },
      { feature: "White-label branding", foundation: false, growth: false, scale: false },
    ],
  },
  {
    title: "AI leasing chatbot",
    rows: [
      { feature: "Property-aware conversation training", foundation: true, growth: true, scale: true },
      { feature: "Lead capture inside the chatbot widget", foundation: true, growth: true, scale: true },
      { feature: "Tour scheduling", foundation: true, growth: true, scale: true },
      { feature: "Embed on third-party sites", foundation: true, growth: true, scale: true },
    ],
  },
  {
    title: "Visitor identification",
    rows: [
      { feature: "Cursive pixel install and config", foundation: false, growth: true, scale: true },
      { feature: "Visitor stream with identity + page path", foundation: false, growth: true, scale: true },
      { feature: "Visitor to lead attribution", foundation: false, growth: true, scale: true },
    ],
  },
  {
    title: "Paid advertising",
    rows: [
      { feature: "Google Ads campaign builder UI", foundation: false, growth: true, scale: true },
      { feature: "Meta Ads campaign builder UI", foundation: false, growth: true, scale: true },
      { feature: "Multi-variant A/B testing", foundation: false, growth: true, scale: true },
      { feature: "Connect your own ad accounts", foundation: false, growth: true, scale: true },
    ],
  },
  {
    title: "SEO and content",
    rows: [
      { feature: "Google Search Console integration", foundation: false, growth: true, scale: true },
      { feature: "GA4 integration", foundation: false, growth: true, scale: true },
      { feature: "In-product content recommendations", foundation: false, growth: true, scale: true },
      { feature: "Programmatic SEO pages", foundation: false, growth: false, scale: true },
    ],
  },
  {
    title: "Reputation",
    rows: [
      { feature: "Google reviews monitoring", foundation: true, growth: true, scale: true },
      { feature: "Reddit and open-web monitoring", foundation: true, growth: true, scale: true },
      { feature: "AI sentiment classification", foundation: true, growth: true, scale: true },
      { feature: "Reply drafting tools", foundation: true, growth: true, scale: true },
    ],
  },
  {
    title: "Audiences and outbound",
    rows: [
      { feature: "Audience builder (segments)", foundation: false, growth: false, scale: true },
      { feature: "Sync to Meta Custom Audiences", foundation: false, growth: false, scale: true },
      { feature: "Sync to Google Customer Match", foundation: false, growth: false, scale: true },
      { feature: "Sync to TikTok Custom Audiences", foundation: false, growth: false, scale: true },
      { feature: "Outbound email", foundation: false, growth: false, scale: "3,000 per month" },
    ],
  },
  {
    title: "Reporting",
    rows: [
      { feature: "Standard reports + monthly email digest", foundation: true, growth: true, scale: true },
      { feature: "Multi-touch attribution and funnel reports", foundation: false, growth: true, scale: true },
      { feature: "Scheduled custom reports by email", foundation: false, growth: false, scale: true },
    ],
  },
  {
    title: "Operations",
    rows: [
      { feature: "Multi-property dashboard", foundation: true, growth: true, scale: true },
      { feature: "Lead CRM with statuses and notes", foundation: true, growth: true, scale: true },
      { feature: "Resident and renewal pipeline (AppFolio)", foundation: true, growth: true, scale: true },
      { feature: "Resident referral program", foundation: false, growth: false, scale: true },
    ],
  },
];

function CellContent({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <Check
        size={15}
        strokeWidth={2.5}
        style={{ color: "#2563EB" }}
        aria-label="Included"
      />
    );
  }
  if (value === false) {
    return (
      <Minus
        size={13}
        strokeWidth={2}
        style={{ color: "#bdbcb6" }}
        aria-label="Not included"
      />
    );
  }
  return (
    <span
      style={{
        color: "#1E2A3A",
        fontFamily: "var(--font-sans)",
        fontSize: "12.5px",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
}

export function ComparisonTable() {
  const [showFull, setShowFull] = React.useState(false);

  return (
    <section
      style={{
        backgroundColor: "#F1F5F9",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-2xl mb-8 md:mb-10">
          <p className="eyebrow mb-3">Compare</p>
          <h2
            className="heading-section"
            style={{ color: "#1E2A3A", fontSize: "clamp(24px, 3vw, 32px)" }}
          >
            The rows operators ask about first.
          </h2>
        </div>

        {/* Compact table — 8 headline rows, no section dividers. */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #E2E8F0",
          }}
        >
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <th
                  className="text-left py-3 pl-4 pr-3"
                  style={{
                    minWidth: "240px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#88867f",
                    fontWeight: 600,
                  }}
                >
                  Feature
                </th>
                {[
                  { name: "Pilot", price: "Free" },
                  { name: "Standard", price: "$899", highlighted: true },
                  { name: "Portfolio", price: "$1,499" },
                ].map((t) => (
                  <th
                    key={t.name}
                    className="text-center py-3 px-3"
                    style={{
                      minWidth: "110px",
                      backgroundColor: t.highlighted
                        ? "rgba(37,99,235,0.04)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "13.5px",
                        fontWeight: 700,
                        color: t.highlighted ? "#2563EB" : "#1E2A3A",
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "11.5px",
                        fontWeight: 500,
                        color: "#88867f",
                        marginTop: "1px",
                      }}
                    >
                      {t.price}/mo
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HEADLINE_ROWS.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom:
                      idx === HEADLINE_ROWS.length - 1
                        ? "none"
                        : "1px solid #E2E8F0",
                  }}
                >
                  <td
                    className="py-2.5 pl-4 pr-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#1E2A3A",
                      lineHeight: 1.4,
                    }}
                  >
                    {row.feature}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <CellContent value={row.foundation} />
                  </td>
                  <td
                    className="py-2.5 px-3 text-center"
                    style={{ backgroundColor: "rgba(37,99,235,0.04)" }}
                  >
                    <CellContent value={row.growth} />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <CellContent value={row.scale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Disclosure for the dense buyer who wants every detail. */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setShowFull((v) => !v)}
            aria-expanded={showFull}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#2563EB",
              border: "1px solid rgba(37,99,235,0.25)",
            }}
          >
            {showFull ? "Hide full comparison" : "Show every detail"}
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              aria-hidden="true"
              style={{
                transform: showFull ? "rotate(180deg)" : "none",
                transition: "transform 160ms ease",
              }}
            />
          </button>
        </div>

        {showFull ? (
          <div
            className="mt-6 rounded-xl overflow-hidden"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #E2E8F0",
            }}
          >
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <th className="py-3 pl-4 pr-3" style={{ minWidth: "240px" }}></th>
                  <th
                    className="text-center py-3 px-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#1E2A3A",
                      minWidth: "110px",
                    }}
                  >
                    Pilot
                  </th>
                  <th
                    className="text-center py-3 px-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#2563EB",
                      backgroundColor: "rgba(37,99,235,0.04)",
                      minWidth: "110px",
                    }}
                  >
                    Standard
                  </th>
                  <th
                    className="text-center py-3 px-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#1E2A3A",
                      minWidth: "110px",
                    }}
                  >
                    Portfolio
                  </th>
                </tr>
              </thead>
              <tbody>
                {FULL_SECTIONS.map((section) => (
                  <React.Fragment key={section.title}>
                    <tr style={{ backgroundColor: "#FFFFFF" }}>
                      <td
                        colSpan={4}
                        className="py-2.5 px-4"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "#2563EB",
                          fontWeight: 600,
                        }}
                      >
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map((row, idx) => (
                      <tr
                        key={`${section.title}-${idx}`}
                        style={{ borderBottom: "1px solid #E2E8F0" }}
                      >
                        <td
                          className="py-2.5 pl-4 pr-3"
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12.5px",
                            color: "#1E2A3A",
                            lineHeight: 1.4,
                          }}
                        >
                          {row.feature}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <CellContent value={row.foundation} />
                        </td>
                        <td
                          className="py-2.5 px-3 text-center"
                          style={{ backgroundColor: "rgba(37,99,235,0.04)" }}
                        >
                          <CellContent value={row.growth} />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <CellContent value={row.scale} />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
