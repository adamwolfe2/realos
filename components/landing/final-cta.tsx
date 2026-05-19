import Link from "next/link";

// ---------------------------------------------------------------------------
// Final CTA — single action. Apple-clean closer.
// ---------------------------------------------------------------------------

export function LandingFinalCta() {
  return (
    <section
      style={{
        backgroundColor: "#FAFAFA",
        borderTop: "1px solid #EEF2F6",
      }}
    >
      <div className="max-w-[820px] mx-auto px-6 md:px-8 py-28 md:py-40 text-center">
        <h2
          style={{
            color: "#0B1220",
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(36px, 5vw, 60px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.028em",
          }}
        >
          See it on your own data.
        </h2>

        <p
          className="mt-6 mx-auto"
          style={{
            color: "#475569",
            fontFamily: "var(--font-sans)",
            fontSize: "18px",
            lineHeight: 1.6,
            maxWidth: "560px",
          }}
        >
          Connect your stack, pick your modules, and start a 14-day trial.
          No credit card.
        </p>

        <div className="mt-10 flex items-center justify-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-full transition-colors"
            style={{
              backgroundColor: "#0B1220",
              color: "#FFFFFF",
              padding: "16px 32px",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            Start a 14-day trial
          </Link>
        </div>
      </div>
    </section>
  );
}
