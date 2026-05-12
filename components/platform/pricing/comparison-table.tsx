// Tier comparison table — the dense-detail surface for the
// "I want to see every line" buyer. Lives below the cards + bills so
// it never interrupts the scan-and-decide path. Sticky header lets
// people stay oriented while they scroll the long feature list.

import { Check, Minus } from "lucide-react";

type Cell = boolean | string;
type Row = { feature: string; foundation: Cell; growth: Cell; scale: Cell };

const SECTIONS: Array<{ title: string; rows: Row[] }> = [
  {
    title: "Marketing site & listings",
    rows: [
      {
        feature: "Custom-branded marketing site, managed",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Live AppFolio listings sync",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Custom domain + SSL",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Mobile-first responsive build",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Site updates by our team",
        foundation: "Monthly",
        growth: "Bi-weekly",
        scale: "Weekly",
      },
    ],
  },
  {
    title: "AI chatbot",
    rows: [
      {
        feature: "AI chatbot trained on the property",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Conversation cap per month",
        foundation: "1,000",
        growth: "5,000",
        scale: "Unlimited",
      },
      {
        feature: "Lead capture inside chatbot",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Property-specific FAQ training",
        foundation: true,
        growth: true,
        scale: true,
      },
    ],
  },
  {
    title: "Visitor identification",
    rows: [
      {
        feature: "Cursive Pixel installed + maintained",
        foundation: false,
        growth: true,
        scale: true,
      },
      {
        feature: "Identified visitors per month",
        foundation: false,
        growth: "5,000",
        scale: "25,000",
      },
      {
        feature: "Visitor stream with identity + page path",
        foundation: false,
        growth: true,
        scale: true,
      },
    ],
  },
  {
    title: "Paid advertising",
    rows: [
      {
        feature: "Google Ads campaign management",
        foundation: false,
        growth: true,
        scale: true,
      },
      {
        feature: "Meta Ads campaign management",
        foundation: false,
        growth: true,
        scale: true,
      },
      {
        feature: "Ad spend markup",
        foundation: "—",
        growth: "15%",
        scale: "15%",
      },
      {
        feature: "Ad creative requests / mo",
        foundation: false,
        growth: "2",
        scale: "Unlimited",
      },
      {
        feature: "Multi-variant A/B testing",
        foundation: false,
        growth: true,
        scale: true,
      },
    ],
  },
  {
    title: "SEO & content",
    rows: [
      {
        feature: "Google Search Console integration",
        foundation: false,
        growth: true,
        scale: true,
      },
      {
        feature: "GA4 integration",
        foundation: false,
        growth: true,
        scale: true,
      },
      {
        feature: "Content recommendations",
        foundation: false,
        growth: "Monthly",
        scale: "Weekly",
      },
      {
        feature: "Programmatic SEO pages",
        foundation: false,
        growth: false,
        scale: true,
      },
    ],
  },
  {
    title: "Reputation",
    rows: [
      {
        feature: "Google reviews monitoring",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Reddit + open-web monitoring",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "AI sentiment classification",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Multi-source reply drafting",
        foundation: true,
        growth: true,
        scale: true,
      },
    ],
  },
  {
    title: "Audiences & retargeting",
    rows: [
      {
        feature: "Audience builder (segments)",
        foundation: false,
        growth: false,
        scale: true,
      },
      {
        feature: "Sync to Meta Custom Audiences",
        foundation: false,
        growth: false,
        scale: true,
      },
      {
        feature: "Sync to Google Customer Match",
        foundation: false,
        growth: false,
        scale: true,
      },
      {
        feature: "Sync to TikTok Custom Audiences",
        foundation: false,
        growth: false,
        scale: true,
      },
    ],
  },
  {
    title: "Outbound + retention",
    rows: [
      {
        feature: "Outbound email campaigns",
        foundation: false,
        growth: false,
        scale: "3,000/mo",
      },
      {
        feature: "Referral program",
        foundation: false,
        growth: false,
        scale: true,
      },
      {
        feature: "Resident renewal pipeline",
        foundation: true,
        growth: true,
        scale: true,
      },
    ],
  },
  {
    title: "Reporting & support",
    rows: [
      {
        feature: "Standard reports",
        foundation: true,
        growth: true,
        scale: true,
      },
      {
        feature: "Advanced attribution + funnel",
        foundation: false,
        growth: true,
        scale: true,
      },
      {
        feature: "Quarterly business review",
        foundation: false,
        growth: false,
        scale: true,
      },
      {
        feature: "Support channel",
        foundation: "Email",
        growth: "Shared Slack",
        scale: "Priority + CSM",
      },
      {
        feature: "Response SLA",
        foundation: "48 hr",
        growth: "24 hr",
        scale: "4 hr",
      },
    ],
  },
];

function CellContent({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <Check
        size={16}
        strokeWidth={2.5}
        style={{ color: "#2563EB" }}
        aria-label="Included"
      />
    );
  }
  if (value === false) {
    return (
      <Minus
        size={14}
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
        fontSize: "13px",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
}

export function ComparisonTable() {
  return (
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-28">
        <div className="max-w-3xl mb-10">
          <p className="eyebrow mb-4">Compare</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Everything in every tier.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            For the buyer who wants every line. Skim by section header.
          </p>
        </div>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #e8e6dc",
                }}
              >
                <th
                  className="text-left py-4 pr-4"
                  style={{
                    minWidth: "260px",
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
                  { name: "Growth", price: "$899" },
                  { name: "Scale", price: "$1,499" },
                ].map((t, i) => (
                  <th
                    key={t.name}
                    className="text-center py-4 px-3"
                    style={{
                      minWidth: "140px",
                      backgroundColor: i === 1 ? "#ffffff" : "transparent",
                      borderLeft:
                        i === 1 ? "1px solid #e8e6dc" : "none",
                      borderRight:
                        i === 1 ? "1px solid #e8e6dc" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#141413",
                        letterSpacing: "-0.008em",
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#88867f",
                        marginTop: "2px",
                      }}
                    >
                      {t.price}/mo
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((section) => (
                <React.Fragment key={section.title}>
                  <tr
                    style={{
                      backgroundColor: "#f5f4ed",
                    }}
                  >
                    <td
                      colSpan={4}
                      className="py-3 px-4"
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
                        className="py-3 pr-4 pl-4"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13.5px",
                          color: "#4d4c48",
                          lineHeight: 1.4,
                        }}
                      >
                        {row.feature}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <CellContent value={row.foundation} />
                      </td>
                      <td
                        className="py-3 px-3 text-center"
                        style={{
                          backgroundColor: "#ffffff",
                          borderLeft: "1px solid #e8e6dc",
                          borderRight: "1px solid #e8e6dc",
                        }}
                      >
                        <CellContent value={row.growth} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <CellContent value={row.scale} />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// Local import — kept at the bottom so the top of the file stays
// readable as a "what's the data" header.
import * as React from "react";
