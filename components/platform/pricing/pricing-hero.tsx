// ---------------------------------------------------------------------------
// Pricing hero — Apple-clean rewrite.
//
// Centered editorial layout. One headline, one subhead, no trust strip
// (it duplicated the tier cards below). Plenty of negative space.
// ---------------------------------------------------------------------------

export function PricingHero() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #EEF2F6",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6 md:px-8 pt-28 md:pt-36 pb-16 md:pb-20 text-center">
        <p className="eyebrow mb-5">Pricing</p>

        <h1
          style={{
            color: "#0B1220",
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(44px, 6.5vw, 80px)",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.032em",
            maxWidth: "920px",
            margin: "0 auto",
          }}
        >
          Per property.
          <br />
          <span style={{ color: "#2563EB" }}>Month to month.</span>
        </h1>

        <p
          className="mt-7 mx-auto"
          style={{
            color: "#475569",
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(17px, 1.5vw, 20px)",
            lineHeight: 1.55,
            maxWidth: "640px",
          }}
        >
          One tier covers the whole portfolio. Graduated discounts kick in
          automatically. Add capability or capacity any time — every add-on
          is one click.
        </p>
      </div>
    </section>
  );
}
