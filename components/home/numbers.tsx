const METRICS = [
  {
    value: "One",
    label: "Platform replaces five-plus vendors: site, chatbot, ads, CRM, creative.",
  },
  {
    value: "24/7",
    label: "AI chatbot that answers, qualifies, and captures leads after hours.",
  },
  {
    value: "48h",
    label: "Turnaround on every managed creative asset: ads, landing blocks, emails.",
  },
  {
    value: "14 days",
    label: "From intake call to a custom site live on your domain with full stack.",
  },
];

export function Numbers() {
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <p className="eyebrow mb-10 text-center">The numbers we hit</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6 lg:gap-4">
          {METRICS.map((m, i) => (
            <div
              key={m.value}
              className={`px-0 lg:px-6 text-left ${i > 0 ? "lg:border-l" : ""}`}
              style={i > 0 ? { borderColor: "#e8e6dc" } : undefined}
            >
              <p
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(40px, 5.2vw, 56px)",
                  fontWeight: 500,
                  lineHeight: 1.05,
                  letterSpacing: "-0.005em",
                }}
              >
                {m.value}
              </p>
              <p
                className="mt-4 max-w-[280px]"
                style={{
                  color: "#5e5d59",
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
