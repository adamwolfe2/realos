import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// Comparison — editorial contrast rewrite (drastic structural change).
//
// Was: two side-by-side checklist cards with X / ✓ icons (~2018 SaaS).
// Now: a single editorial contrast block. Each row is a single split line —
// muted strikethrough-style "before" on the left, bold cobalt "after" on the
// right, separated by a hairline. Reads as a confident editorial statement,
// not a feature-by-feature checklist.
// ---------------------------------------------------------------------------

export function Comparison() {
  const { comparison } = MARKETING.home;
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-16">
          <p className="eyebrow mb-4">{comparison.eyebrow}</p>
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
            {comparison.headline}
          </h2>
          <p
            className="mt-6 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {comparison.body}
          </p>
        </div>

        {/* Column headers — restrained typographic anchor, not pill chips. */}
        <div
          className="hidden md:grid md:grid-cols-2 gap-12 mb-6"
          style={{ borderBottom: "1px solid #E2E8F0", paddingBottom: 16 }}
        >
          <p
            style={{
              color: "#94A3B8",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {comparison.leftLabel}
          </p>
          <p
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            {comparison.rightLabel}
          </p>
        </div>

        {/* Rows — large editorial contrast. No X / ✓ pills. */}
        <ol>
          {comparison.rows.map((row, i) => (
            <li
              key={row.new}
              className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-12 py-7 md:py-9"
              style={{
                borderTop: i === 0 ? "none" : "1px solid #E2E8F0",
              }}
            >
              <p
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  lineHeight: 1.5,
                  letterSpacing: "-0.01em",
                  fontWeight: 400,
                }}
              >
                {row.old}
              </p>
              <p
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "19px",
                  lineHeight: 1.4,
                  letterSpacing: "-0.015em",
                  fontWeight: 600,
                }}
              >
                {row.new}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
