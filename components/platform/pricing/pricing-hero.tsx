// Pricing page hero. Centered layout, two-line headline with blue accent
// on the second line. Self-serve framing throughout.

export function PricingHero() {
  return (
    <section
      style={{
        backgroundColor: "#f5f4ed",
        borderBottom: "1px solid #e8e6dc",
      }}
    >
      <div className="max-w-[960px] mx-auto px-4 md:px-8 pt-24 md:pt-32 pb-12 md:pb-16 text-center">
        <p className="eyebrow mb-4">Pricing</p>

        <h1
          className="heading-section"
          style={{
            color: "#141413",
            fontSize: "clamp(36px, 5vw, 56px)",
            letterSpacing: "-0.022em",
            lineHeight: 1.08,
            margin: "0 auto",
          }}
        >
          One platform for every property.
          <span
            style={{
              display: "block",
              color: "#2563EB",
              marginTop: "4px",
            }}
          >
            Scale with your portfolio.
          </span>
        </h1>

        <p
          className="mt-6 mx-auto"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "18px",
            lineHeight: 1.55,
            maxWidth: "640px",
          }}
        >
          Sign up, pick a plan, connect your data, and run your marketing from
          one workspace. Site builder, AI chatbot, listings sync, visitor
          pixel, ads, reputation, audiences. Pause anytime.
        </p>

        {/* Trust strip. Same four anchors as before but now centered
            with consistent column widths so the row reads as a single
            unit, not a left-justified list. */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-[760px] mx-auto">
          {[
            { value: "Self-serve", label: "Sign up in minutes" },
            { value: "No contracts", label: "Month-to-month" },
            { value: "Pause anytime", label: "Keep your data" },
            { value: "30-day guarantee", label: "Money back" },
          ].map((t) => (
            <div key={t.label} className="text-center">
              <div
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-sans)",
                  fontSize: "18px",
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
                  fontSize: "10.5px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginTop: "3px",
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
