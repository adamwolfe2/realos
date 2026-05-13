const METRICS = [
  {
    value: "100%",
    label: "Marketing spend tracked to lease. Google, Meta, referral, PMS, all in one view.",
  },
  {
    value: "4-8 wk",
    label: "Lead time on pacing alerts. Know your lease-up is falling behind before occupancy slips.",
  },
  {
    value: "48h",
    label: "Creative refresh on every ad, email, or landing block. No retainer to unlock it.",
  },
  {
    value: "14 days",
    label: "From intake call to live on your domain. Pixel firing. Chatbot answering. Ads running.",
  },
];

export function Numbers() {
  return (
    <section style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E2E8F0" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">By the numbers</p>
          <h2 className="heading-section" style={{ color: "#1E2A3A" }}>
            The shift, in figures you can hold a vendor to.
          </h2>
        </div>
        <div
          className="md:grid md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6 lg:gap-4 flex overflow-x-auto md:overflow-visible pb-3 md:pb-0"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {METRICS.map((m, i) => (
            <div
              key={m.value}
              className={`flex-shrink-0 md:flex-shrink px-0 lg:px-6 text-left ${i > 0 ? "lg:border-l" : ""}`}
              style={{ scrollSnapAlign: "start", width: "72vw", maxWidth: "280px", ...(i > 0 ? { borderColor: "#E2E8F0" } : undefined) }}
            >
              <p
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(40px, 5.2vw, 56px)",
                  fontWeight: 700,
                  lineHeight: 1.02,
                  letterSpacing: "-0.025em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {m.value}
              </p>
              <p
                className="mt-4 max-w-[280px]"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.55,
                }}
              >
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
