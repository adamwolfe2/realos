// Pricing page hero. Self-serve SaaS framing: clear capabilities, no
// promises of agency labor. Matches the platform palette of parchment
// background, blue accent, soft borders, generous whitespace.

export function PricingHero() {
  return (
    <section
      style={{
        backgroundColor: "#f5f4ed",
        borderBottom: "1px solid #e8e6dc",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-24 md:pt-32 pb-12 md:pb-16">
        <p className="eyebrow mb-4">Pricing</p>
        <h1
          className="heading-section"
          style={{
            color: "#141413",
            fontSize: "clamp(36px, 5vw, 56px)",
            letterSpacing: "-0.022em",
            maxWidth: "880px",
          }}
        >
          One platform for every property.{" "}
          <span style={{ color: "#2563EB" }}>Self-serve, per property.</span>
        </h1>
        <p
          className="mt-5"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "18px",
            lineHeight: 1.55,
            maxWidth: "680px",
          }}
        >
          Sign up, pick a plan, connect your data, and run your marketing from
          one workspace. Site builder, AI chatbot, listings sync, visitor
          pixel, ads, reputation, audiences. Pause anytime.
        </p>

        <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3">
          {[
            { value: "Self-serve", label: "Sign up in minutes" },
            { value: "No contracts", label: "Month-to-month" },
            { value: "Pause anytime", label: "Keep your data" },
            { value: "30-day guarantee", label: "Money back" },
          ].map((t) => (
            <div key={t.label}>
              <div
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-sans)",
                  fontSize: "20px",
                  fontWeight: 600,
                  letterSpacing: "-0.012em",
                }}
              >
                {t.value}
              </div>
              <div
                style={{
                  color: "#88867f",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginTop: "2px",
                }}
              >
                {t.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
