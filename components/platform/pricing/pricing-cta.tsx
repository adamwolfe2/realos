import Link from "next/link";

// Bottom CTA — last chance to convert. Keeps it simple: two paths
// (talk to sales vs. start now), social proof line, no marketing fluff.

export function PricingCta() {
  return (
    <section
      style={{
        backgroundColor: "#141413",
        color: "#ffffff",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
        <p
          className="eyebrow mb-5"
          style={{ color: "#bdbcb6" }}
        >
          Ready when you are
        </p>
        <h2
          className="heading-section"
          style={{
            color: "#ffffff",
            maxWidth: "720px",
            margin: "0 auto",
          }}
        >
          Live in 14 days. Pay only when your site goes live.
        </h2>
        <p
          className="mt-5 mx-auto"
          style={{
            color: "#bdbcb6",
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

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
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
              color: "#ffffff",
              border: "1px solid #4d4c48",
            }}
          >
            Start onboarding now
          </Link>
        </div>

        <p
          className="mt-8"
          style={{
            color: "#88867f",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          14-day setup · No contracts · 30-day money-back
        </p>
      </div>
    </section>
  );
}
