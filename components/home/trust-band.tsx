import React from "react";

// ---------------------------------------------------------------------------
// TrustBand — proof row under the product shot (2026-07-21 blueprint,
// section 3). Sits on #f4f4f4 (continuing from the seam above), one row of
// four items, left-aligned, display value over a small mono label. This is
// the only mono-caps moment on the page until the FAQ eyebrow.
//
// Mobile collapses to a 2x2 grid.
// ---------------------------------------------------------------------------

type Item = { value: string; label: string };

const ITEMS: Item[] = [
  { value: "14 days", label: "To live on your domain" },
  { value: "100%", label: "Ad spend tracked to lease" },
  { value: "$0", label: "Pilot. No commitment." },
  { value: "Telegraph Commons", label: "Built with operators, Berkeley" },
];

export function TrustBand() {
  return (
    <section
      style={{ backgroundColor: "#f4f4f4", borderBottom: "1px solid #e0e0e0" }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
          {ITEMS.map((item) => (
            <div key={item.label}>
              <p
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(20px, 2.2vw, 26px)",
                  fontWeight: 500,
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.value}
              </p>
              <p
                className="mt-2"
                style={{
                  color: "#8d8d8d",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  lineHeight: 1.4,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 500,
                }}
              >
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
