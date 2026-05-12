import Link from "next/link";

// Bottom CTA — final conversion push.
//
// Brand pass: the previous dark/black background broke the cream + blue
// palette every other surface uses. Now sits on the same parchment as
// the rest of the page with a thin top border, blue accent CTA, ghost
// secondary, and a single trust line. The eye lands on the headline +
// button without a hard color shift to fight through.

export function PricingCta() {
  return (
    <section
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #e8e6dc",
      }}
    >
      <div className="max-w-[960px] mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
        <p className="eyebrow mb-4">Ready when you are</p>
        <h2
          className="heading-section"
          style={{
            color: "#141413",
            maxWidth: "720px",
            margin: "0 auto",
          }}
        >
          Live in 14 days. Pay only when{" "}
          <span style={{ color: "#2563EB" }}>your site goes live.</span>
        </h2>
        <p
          className="mt-5 mx-auto"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.55,
            maxWidth: "620px",
          }}
        >
          Book a 30-minute demo to walk through the platform, the AppFolio
          sync, and what your dashboard would look like with your real data
          loaded in.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/demo"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "#2563EB",
              color: "#ffffff",
            }}
          >
            Book a demo
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#141413",
              border: "1px solid #d6d3c8",
            }}
          >
            Start onboarding
          </Link>
        </div>

        <p
          className="mt-8"
          style={{
            color: "#88867f",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          14-day setup · No contracts · 30-day money-back
        </p>
      </div>
    </section>
  );
}
