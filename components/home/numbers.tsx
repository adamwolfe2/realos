// ---------------------------------------------------------------------------
// Numbers — editorial rewrite (matches the new home rhythm).
//
// Was: 4-column thin metric strip that read as a hero-stats afterthought.
// Now: full-bleed 2x2 grid of enormous numerals (clamp 56→96px), each in
// its own quadrant with hairline dividers and generous whitespace.
// Reads as a confident data statement, not a small caption row.
// ---------------------------------------------------------------------------

const METRICS = [
  {
    label: "Marketing spend tracked to lease",
    value: "100",
    unit: "%",
    body: "Google, Meta, referral, PMS, organic. Every dollar mapped to a lease signing, not an impression.",
  },
  {
    label: "Pacing alert lead time",
    value: "4–8",
    unit: " wk",
    body: "Know your lease-up is falling behind before occupancy slips. Time to fix it, not explain it.",
  },
  {
    label: "Creative refresh turnaround",
    value: "48",
    unit: " hr",
    body: "Ad creative, email variants, landing-block copy. Shipped in two days. No retainer, no change-order form.",
  },
  {
    label: "Intake to live on your domain",
    value: "14",
    unit: " days",
    body: "Day 1 is a 30-minute intake. Day 14 the pixel fires, the chatbot answers, and the report writes itself.",
  },
];

export function Numbers() {
  return (
    <section style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E2E8F0" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-20">
          <p className="eyebrow mb-4">By the numbers</p>
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(34px, 4.8vw, 56px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            The shift, in figures you can hold us to.
          </h2>
        </div>

        {/* 2x2 grid with hairline dividers. Each cell has space to breathe so
            the numeral commands the page instead of competing with three
            siblings on a single row. */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          {METRICS.map((m, i) => {
            const isRightCol = i % 2 === 1;
            const isBottomRow = i >= 2;
            return (
              <div
                key={m.label}
                className="py-12 md:py-16 md:px-10 first:pt-0 first:md:pt-16"
                style={{
                  borderTop: i > 0 ? "1px solid #E2E8F0" : "none",
                  borderLeft: isRightCol ? "1px solid #E2E8F0" : "none",
                  // Reset the borderTop on md+ for the second column so we
                  // don't get a double-stack at the row boundary.
                  ...(i === 1 ? { borderTop: "none" } : undefined),
                  ...(isBottomRow ? { borderTop: "1px solid #E2E8F0" } : undefined),
                }}
              >
                <p
                  style={{
                    color: "#64748B",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {m.label}
                </p>
                <p
                  className="mt-5 flex items-baseline gap-1"
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-sans)",
                    fontSize: "clamp(56px, 8.4vw, 104px)",
                    fontWeight: 700,
                    lineHeight: 0.95,
                    letterSpacing: "-0.04em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {m.value}
                  <span
                    style={{
                      color: "#2563EB",
                      fontSize: "clamp(28px, 4vw, 48px)",
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {m.unit}
                  </span>
                </p>
                <p
                  className="mt-6 max-w-[440px]"
                  style={{
                    color: "#64748B",
                    fontFamily: "var(--font-sans)",
                    fontSize: "15.5px",
                    lineHeight: 1.6,
                  }}
                >
                  {m.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
