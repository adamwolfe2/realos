// Pricing page hero — editorial rewrite matching the home rhythm.
// Was: centered hero with a left-of-center grid trust strip.
// Now: left-aligned editorial hero, bigger headline, hairline-divided
// trust row that sits under the body copy as a single unit.

export function PricingHero() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 pt-24 md:pt-32 pb-16 md:pb-20">
        <div className="max-w-3xl">
          <p className="eyebrow mb-4">Pricing</p>

          <h1
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(40px, 6vw, 72px)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
            }}
          >
            Built by operators.
            <br />
            <span style={{ color: "#2563EB" }}>Priced for the market.</span>
          </h1>

          <p
            className="mt-7"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "19px",
              lineHeight: 1.55,
              maxWidth: "680px",
            }}
          >
            We replace your retainer and give you more data for less money.
            Connect to your existing stack, see exactly what your digital
            marketing is doing, and get a clear recommendation on what to do
            next. Month-to-month. Cancel if pacing does not move.
          </p>
        </div>

        {/* Trust strip — left-aligned, hairline-divided, no centered grid. */}
        <div
          className="mt-12 grid grid-cols-2 md:grid-cols-4 max-w-[920px]"
          style={{
            borderTop: "1px solid #E2E8F0",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          {[
            { value: "Free pilot", label: "No commitment" },
            { value: "Month-to-month", label: "Cancel anytime" },
            { value: "Operator-built", label: "Not a vendor" },
            { value: "Live property", label: "Telegraph Commons" },
          ].map((t, i) => (
            <div
              key={t.label}
              className="py-5 md:py-6 md:px-6 first:md:pl-0"
              style={{
                borderLeft: i > 0 ? "1px solid #E2E8F0" : "none",
              }}
            >
              <p
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10.5px",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {t.label}
              </p>
              <p
                className="mt-2"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "20px",
                  fontWeight: 700,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.15,
                }}
              >
                {t.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
