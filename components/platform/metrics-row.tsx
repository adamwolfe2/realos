// ---------------------------------------------------------------------------
// MetricsRow (Linear-inspired)
// Four big numbers in Inter display weight 510 with aggressive negative
// tracking. Sits on the near-black canvas with translucent hairlines
// between cells.
// ---------------------------------------------------------------------------

const METRICS = [
  {
    value: "<14d",
    label: "From intake call to custom domain and first ad spend live.",
    source: "Onboarding median, Q1 2026",
  },
  {
    value: "95%",
    label: "Of site visitors named and routed to nurture, not just the 5% who fill a form.",
    source: "Cursive identity graph, US",
  },
  {
    value: "$1,100",
    label: "Per-month retainer delta versus Conversion Logix on the same modules.",
    source: "vs. CL published rate card",
  },
  {
    value: "48h",
    label: "Turnaround on managed creative: ad concepts, landing blocks, SMS, email.",
    source: "Creative studio SLA",
  },
];

export function MetricsRow() {
  return (
    <section
      style={{
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-14">
        <p className="eyebrow mb-10">The numbers we hit</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m, i) => (
            <div
              key={m.value}
              className="px-0 lg:px-6 py-6 lg:py-2"
              style={{
                borderLeft:
                  i > 0
                    ? "1px solid var(--border-subtle)"
                    : "none",
              }}
            >
              <p
                className="leading-none"
                style={{
                  color: "var(--text-headline)",
                  fontSize: "clamp(38px, 5vw, 56px)",
                  fontWeight: 510,
                  letterSpacing: "-0.03em",
                }}
              >
                {m.value}
              </p>
              <p
                className="text-[14px] mt-4 leading-relaxed max-w-sm"
                style={{
                  color: "var(--text-body)",
                  letterSpacing: "-0.011em",
                }}
              >
                {m.label}
              </p>
              <p
                className="font-mono text-[10px] mt-3"
                style={{
                  color: "var(--text-subtle)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {m.source}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
