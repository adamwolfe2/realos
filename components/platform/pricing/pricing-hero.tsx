// Pricing page hero. Centered layout, two-line headline with blue accent
// on the second line. Self-serve framing throughout.

export function PricingHero() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[960px] mx-auto px-4 md:px-8 pt-24 md:pt-32 pb-12 md:pb-16 text-center">
        <p className="eyebrow mb-4">Pricing</p>

        <h1
          className="heading-section"
          style={{
            color: "#1E2A3A",
            fontSize: "clamp(36px, 5vw, 56px)",
            letterSpacing: "-0.022em",
            lineHeight: 1.08,
            margin: "0 auto",
          }}
        >
          Built by operators,
          <span
            style={{
              display: "block",
              color: "#2563EB",
              marginTop: "4px",
            }}
          >
            priced for the market.
          </span>
        </h1>

        <p
          className="mt-6 mx-auto"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "18px",
            lineHeight: 1.55,
            maxWidth: "640px",
          }}
        >
          We replace your retainer and give you more data for less money. Connect to your existing stack, see exactly what your digital marketing is doing, and get a clear recommendation on what to do about it. Cancel if pacing does not move.
        </p>

        {/* Trust strip. Same four anchors as before but now centered
            with consistent column widths so the row reads as a single
            unit, not a left-justified list. */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-[760px] mx-auto">
          {[
            { value: "Free pilot", label: "No commitment" },
            { value: "Month-to-month", label: "Cancel anytime" },
            { value: "Operator-built", label: "Not a vendor" },
            { value: "Live property", label: "Telegraph Commons" },
          ].map((t) => (
            <div key={t.label} className="text-center">
              <div
                style={{
                  color: "#1E2A3A",
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
