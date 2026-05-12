// Pricing page hero. Sets the value frame ("managed, not DIY") before
// the tier cards so the price never reads as just-software. Matches the
// platform brand palette: parchment background, blue accent, generous
// negative space.

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
          Replace four vendors and an agency.{" "}
          <span style={{ color: "#2563EB" }}>One price per property.</span>
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
          A managed marketing stack — site, listings, chatbot, pixel, ads,
          reputation, audiences — built and run by our team. You get the
          dashboard. We do the work. Pause anytime, no annual contracts.
        </p>

        {/* Trust strip — same pattern as the home hero so the eye lands
            in a familiar place. */}
        <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3">
          {[
            { value: "14 days", label: "Call to live" },
            { value: "No contracts", label: "Month-to-month" },
            { value: "Pause anytime", label: "We hold your setup" },
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
