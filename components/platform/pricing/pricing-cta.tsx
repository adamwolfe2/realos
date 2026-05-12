import Link from "next/link";

// Bottom CTA. Parchment background, blue accent on the headline, two
// paths forward. Self-serve framing.

export function PricingCta() {
  return (
    <section
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #e8e6dc",
      }}
    >
      <div className="max-w-[960px] mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
        <p className="eyebrow mb-4">Ready when you are</p>
        <h2
          className="heading-section"
          style={{
            color: "#141413",
            maxWidth: "720px",
            margin: "0 auto",
            fontSize: "clamp(28px, 4vw, 40px)",
          }}
        >
          Sign up in minutes.{" "}
          <span style={{ color: "#2563EB" }}>Pause or cancel anytime.</span>
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
          Pick a tier, create your account, and your workspace is live. Connect
          AppFolio, install the pixel, and configure the chatbot at your own
          pace inside the product.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "#2563EB",
              color: "#ffffff",
            }}
          >
            Get started
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#141413",
              border: "1px solid #d6d3c8",
            }}
          >
            Book a demo
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
          No contracts. No setup fee. 30-day money back.
        </p>
      </div>
    </section>
  );
}
