// ---------------------------------------------------------------------------
// Numbers — product-grounded stat strip.
//
// Earlier version was a 2x2 grid of 56-104px numerals with massive whitespace
// that read as a magazine spread, not a SaaS product. This rewrite ties each
// stat to a small product visual (mini sparkline, attribution bar,
// progress strip) so the page reads as data + product, not typography alone.
// Total section height dropped from ~720px to ~440px on desktop.
// ---------------------------------------------------------------------------

const METRICS: Array<{
  label: string;
  value: string;
  unit: string;
  body: string;
  visual: "attribution" | "alert" | "creative" | "launch";
}> = [
  {
    label: "Marketing spend tracked to lease",
    value: "100",
    unit: "%",
    body: "Google, Meta, referral, PMS, organic. Every dollar mapped to a lease signing, not an impression.",
    visual: "attribution",
  },
  {
    label: "Pacing alert lead time",
    value: "4–8",
    unit: "wk",
    body: "Know your lease-up is falling behind before occupancy slips. Time to fix it, not explain it.",
    visual: "alert",
  },
  {
    label: "Creative refresh turnaround",
    value: "48",
    unit: "hr",
    body: "Ad creative, email variants, landing-block copy. Shipped in two days. No retainer, no change-order form.",
    visual: "creative",
  },
  {
    label: "Intake to live on your domain",
    value: "14",
    unit: "days",
    body: "Day 1 is a 30-minute intake. Day 14 the pixel fires, the chatbot answers, and the report writes itself.",
    visual: "launch",
  },
];

export function Numbers() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-3xl mb-10 md:mb-12">
          <p className="eyebrow mb-3">By the numbers</p>
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.6vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            The shift, in figures you can hold us to.
          </h2>
        </div>

        {/* Dense 4-column strip with product micro-visuals. Each cell sits in
            a clean bordered tile so the section reads as data, not editorial
            whitespace. */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4"
          style={{
            border: "1px solid #E2E8F0",
            borderRadius: 4,
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
          }}
        >
          {METRICS.map((m, i) => (
            <div
              key={m.label}
              className="p-5 md:p-6 flex flex-col"
              style={{
                borderRight:
                  i < METRICS.length - 1 ? "1px solid #E2E8F0" : "none",
                borderBottom: i < 2 ? "1px solid #E2E8F0" : "none",
                minHeight: 220,
              }}
            >
              {/* Eyebrow label */}
              <p
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  minHeight: 28,
                }}
              >
                {m.label}
              </p>

              {/* Numeral */}
              <p
                className="mt-3 flex items-baseline gap-1"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(36px, 4vw, 48px)",
                  fontWeight: 700,
                  lineHeight: 0.95,
                  letterSpacing: "-0.035em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {m.value}
                <span
                  style={{
                    color: "#2563EB",
                    fontSize: "0.55em",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {m.unit}
                </span>
              </p>

              {/* Inline product micro-visual */}
              <div className="mt-4">
                <MicroVisual kind={m.visual} />
              </div>

              {/* Body copy */}
              <p
                className="mt-4"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.55,
                }}
              >
                {m.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// MicroVisual — tiny product-flavored visual per metric tile. Pure SVG +
// styled divs, no chart library, so the section stays light and consistent
// with the rest of the editorial palette.
// ---------------------------------------------------------------------------
function MicroVisual({ kind }: { kind: "attribution" | "alert" | "creative" | "launch" }) {
  if (kind === "attribution") {
    // Stacked horizontal bar showing 5 lead sources, all summing to 100%.
    const bars = [
      { label: "Google", pct: 34, color: "#2563EB" },
      { label: "Meta", pct: 26, color: "#3B82F6" },
      { label: "Referral", pct: 18, color: "#60A5FA" },
      { label: "Organic", pct: 14, color: "#93C5FD" },
      { label: "PMS", pct: 8, color: "#BFDBFE" },
    ];
    return (
      <div>
        <div
          className="flex h-2 w-full overflow-hidden"
          style={{ borderRadius: 1 }}
          aria-hidden="true"
        >
          {bars.map((b) => (
            <div
              key={b.label}
              style={{
                width: `${b.pct}%`,
                backgroundColor: b.color,
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {bars.slice(0, 3).map((b) => (
            <span
              key={b.label}
              style={{
                color: "#64748B",
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  backgroundColor: b.color,
                  borderRadius: 1,
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              {b.label} {b.pct}%
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "alert") {
    // Pacing line with a downward arc that triggers an alert flag 5 weeks out.
    return (
      <svg
        viewBox="0 0 100 36"
        preserveAspectRatio="none"
        className="w-full h-9"
        aria-hidden="true"
      >
        {/* target baseline */}
        <line
          x1="0"
          y1="14"
          x2="100"
          y2="14"
          stroke="#CBD5E1"
          strokeWidth="0.5"
          strokeDasharray="1.5 1.5"
          vectorEffect="non-scaling-stroke"
        />
        {/* actual line — drops below target */}
        <path
          d="M0 14 L20 14 L40 18 L60 24 L80 30 L100 32"
          stroke="#DC2626"
          strokeWidth="1.5"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        {/* alert flag at week 5 */}
        <circle cx="60" cy="24" r="2.4" fill="#F59E0B" />
        <line
          x1="60"
          y1="24"
          x2="60"
          y2="6"
          stroke="#F59E0B"
          strokeWidth="0.75"
          vectorEffect="non-scaling-stroke"
        />
        <rect x="60" y="2" width="14" height="6" fill="#F59E0B" rx="0.5" />
        <text
          x="62"
          y="6.6"
          fontFamily="var(--font-mono)"
          fontSize="3.4"
          fill="#FFFFFF"
          fontWeight="700"
          letterSpacing="0.04em"
        >
          ALERT
        </text>
      </svg>
    );
  }
  if (kind === "creative") {
    // 3 creative cards, the third highlighted as "new"
    return (
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => {
          const isNew = i === 2;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col gap-1"
              style={{
                padding: 5,
                borderRadius: 2,
                backgroundColor: isNew ? "rgba(37,99,235,0.08)" : "#F8FAFC",
                border: `1px solid ${isNew ? "#2563EB" : "#E2E8F0"}`,
              }}
              aria-hidden="true"
            >
              <div
                style={{
                  height: 4,
                  width: "60%",
                  borderRadius: 1,
                  backgroundColor: isNew ? "#2563EB" : "#CBD5E1",
                }}
              />
              <div
                style={{
                  height: 3,
                  width: "85%",
                  borderRadius: 1,
                  backgroundColor: "#E2E8F0",
                }}
              />
              <div
                style={{
                  height: 3,
                  width: "70%",
                  borderRadius: 1,
                  backgroundColor: "#E2E8F0",
                }}
              />
              {isNew ? (
                <span
                  style={{
                    color: "#2563EB",
                    fontFamily: "var(--font-mono)",
                    fontSize: "8px",
                    letterSpacing: "0.12em",
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  NEW
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }
  // launch — 14-day progress bar, fully complete at the right with a launch flag.
  return (
    <div>
      <div
        className="relative h-1.5 w-full"
        style={{ backgroundColor: "#E2E8F0", borderRadius: 1 }}
        aria-hidden="true"
      >
        <div
          className="absolute left-0 top-0 h-full"
          style={{
            width: "100%",
            backgroundColor: "#2563EB",
            borderRadius: 1,
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span
          style={{
            color: "#64748B",
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          D1 INTAKE
        </span>
        <span
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
            letterSpacing: "0.12em",
            fontWeight: 700,
          }}
        >
          D14 LIVE ●
        </span>
      </div>
    </div>
  );
}
