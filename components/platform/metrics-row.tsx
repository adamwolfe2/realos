// ---------------------------------------------------------------------------
// MetricsRow
// Four big numbers with serif display + mono source line, Wholesail style.
// DECISION: framed as operator outcomes (not vanity "5x" style); each stat
// has a real source label so the numbers feel claimable.
// ---------------------------------------------------------------------------

const METRICS = [
  {
    value: "<14 days",
    label:
      "from intake call to custom domain, full-stack marketing, and first spend live",
    source: "Onboarding median, Q1 2026",
  },
  {
    value: "95%",
    label:
      "of site visitors named and routed to nurture, not just the 5% who fill a form",
    source: "Cursive identity graph, U.S.",
  },
  {
    value: "$1,100/mo",
    label:
      "average retainer delta versus Conversion Logix on the same modules",
    source: "vs. CL published rate card",
  },
  {
    value: "48 hrs",
    label:
      "turnaround on managed creative: new ad concepts, landing blocks, SMS, email",
    source: "Creative studio SLA",
  },
];

export function MetricsRow() {
  return (
    <section style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-14">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-10"
          style={{ color: "var(--text-muted)" }}
        >
          The numbers we hit
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {METRICS.map((m, i) => (
            <div
              key={m.value}
              className="px-0 lg:px-6 py-6 lg:py-2"
              style={{
                borderLeft: i > 0 ? "1px solid var(--border)" : "none",
              }}
            >
              <p
                className="font-serif leading-none"
                style={{
                  color: "var(--text-headline)",
                  fontSize: "clamp(32px, 4vw, 44px)",
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                }}
              >
                {m.value}
              </p>
              <p
                className="font-mono text-[11px] mt-4 leading-relaxed"
                style={{ color: "var(--text-body)" }}
              >
                {m.label}
              </p>
              <p
                className="font-mono text-[10px] mt-3"
                style={{
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
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
