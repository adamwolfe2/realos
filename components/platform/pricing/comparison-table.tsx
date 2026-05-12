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

// The headline rows that drive tier decisions. Keep this list tight —
// anything that isn't a deal-breaker belongs in the full table behind
// the disclosure.
const HEADLINE_ROWS: Row[] = [
  {
    feature: "Identified website visitors / mo",
    foundation: "—",
    growth: "5,000",
    scale: "25,000",
  },
  {
    feature: "AI chatbot conversations / mo",
    foundation: "1,000",
    growth: "5,000",
    scale: "Unlimited",
  },
  {
    feature: "Google + Meta ad campaign management",
    foundation: false,
    growth: true,
    scale: true,
  },
  {
    feature: "Ad creative requests / mo",
    foundation: false,
    growth: "2",
    scale: "Unlimited",
  },
  {
    feature: "SEO module (GSC + GA4)",
    foundation: false,
    growth: true,
    scale: true,
  },
  {
    feature: "Audience builder + sync (Meta, Google, TikTok)",
    foundation: false,
    growth: false,
    scale: true,
  },
  {
    feature: "Outbound email campaigns",
    foundation: false,
    growth: false,
    scale: "3,000/mo",
  },
  {
    feature: "Support SLA",
    foundation: "48 hr email",
    growth: "24 hr Slack",
    scale: "4 hr + CSM",
  },
];

// Full 40-row matrix — only rendered when the disclosure is open.
const FULL_SECTIONS: Array<{ title: string; rows: Row[] }> = [
  {
    title: "Marketing site & listings",
    rows: [
      { feature: "Custom-branded marketing site, managed", foundation: true, growth: true, scale: true },
      { feature: "Live AppFolio listings sync", foundation: true, growth: true, scale: true },
      { feature: "Custom domain + SSL", foundation: true, growth: true, scale: true },
      { feature: "Mobile-first responsive build", foundation: true, growth: true, scale: true },
      { feature: "Site updates by our team", foundation: "Monthly", growth: "Bi-weekly", scale: "Weekly" },
    ],
  },
  {
    title: "AI chatbot",
    rows: [
      { feature: "AI chatbot trained on the property", foundation: true, growth: true, scale: true },
      { feature: "Lead capture inside chatbot", foundation: true, growth: true, scale: true },
      { feature: "Property-specific FAQ training", foundation: true, growth: true, scale: true },
    ],
  },
  {
    title: "Visitor identification",
    rows: [
      { feature: "Cursive Pixel installed + maintained", foundation: false, growth: true, scale: true },
      { feature: "Visitor stream with identity + page path", foundation: false, growth: true, scale: true },
    ],
  },
  {
    title: "Paid advertising",
    rows: [
      { feature: "Ad spend markup", foundation: "—", growth: "15%", scale: "15%" },
      { feature: "Multi-variant A/B testing", foundation: false, growth: true, scale: true },
    ],
  },
  {
    title: "SEO & content",
    rows: [
      { feature: "Content recommendations", foundation: false, growth: "Monthly", scale: "Weekly" },
      { feature: "Programmatic SEO pages", foundation: false, growth: false, scale: true },
    ],
  },
  {
    title: "Reputation",
    rows: [
      { feature: "Google reviews monitoring", foundation: true, growth: true, scale: true },
      { feature: "Reddit + open-web monitoring", foundation: true, growth: true, scale: true },
      { feature: "AI sentiment classification", foundation: true, growth: true, scale: true },
      { feature: "Multi-source reply drafting", foundation: true, growth: true, scale: true },
    ],
  },
  {
    title: "Outbound + retention",
    rows: [
      { feature: "Referral program", foundation: false, growth: false, scale: true },
      { feature: "Resident renewal pipeline", foundation: true, growth: true, scale: true },
    ],
  },
  {
    title: "Reporting & support",
    rows: [
      { feature: "Standard reports", foundation: true, growth: true, scale: true },
      { feature: "Advanced attribution + funnel", foundation: false, growth: true, scale: true },
      { feature: "Quarterly business review", foundation: false, growth: false, scale: true },
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
        color: "#141413",
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
        backgroundColor: "#faf9f5",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-2xl mb-8 md:mb-10">
          <p className="eyebrow mb-3">Compare</p>
          <h2
            className="heading-section"
            style={{ color: "#141413", fontSize: "clamp(24px, 3vw, 32px)" }}
          >
            The eight rows that drive the decision.
          </h2>
        </div>

        {/* Compact table — 8 headline rows, no section dividers. */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e8e6dc",
          }}
        >
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e6dc" }}>
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
                  { name: "Foundation", price: "$599" },
                  { name: "Growth", price: "$899", highlighted: true },
                  { name: "Scale", price: "$1,499" },
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
                        color: t.highlighted ? "#2563EB" : "#141413",
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
                        : "1px solid #f0eee6",
                  }}
                >
                  <td
                    className="py-2.5 pl-4 pr-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#4d4c48",
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
              border: "1px solid #e8e6dc",
            }}
          >
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e8e6dc" }}>
                  <th className="py-3 pl-4 pr-3" style={{ minWidth: "240px" }}></th>
                  <th
                    className="text-center py-3 px-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#141413",
                      minWidth: "110px",
                    }}
                  >
                    Foundation
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
                    Growth
                  </th>
                  <th
                    className="text-center py-3 px-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#141413",
                      minWidth: "110px",
                    }}
                  >
                    Scale
                  </th>
                </tr>
              </thead>
              <tbody>
                {FULL_SECTIONS.map((section) => (
                  <React.Fragment key={section.title}>
                    <tr style={{ backgroundColor: "#f5f4ed" }}>
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
                        style={{ borderBottom: "1px solid #f0eee6" }}
                      >
                        <td
                          className="py-2.5 pl-4 pr-3"
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12.5px",
                            color: "#4d4c48",
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
