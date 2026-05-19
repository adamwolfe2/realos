import Link from "next/link";

// ---------------------------------------------------------------------------
// Landing Hero — Apple-clean.
//
// Single bold value prop. One primary CTA. No competing actions above the
// fold. Generous whitespace, restrained color (Enterprise Blue accent
// only). The previous SplitHero shipped a sidecar config-tabs widget;
// we drop that here in favor of stillness — the artifact appears later
// in the page, not above the fold.
// ---------------------------------------------------------------------------

export function LandingHero() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6 md:px-8 pt-28 md:pt-40 pb-20 md:pb-28 text-center">
        <p
          className="eyebrow mb-6"
          style={{ color: "#2563EB" }}
        >
          Leasing intelligence platform
        </p>

        <h1
          style={{
            color: "#0B1220",
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(44px, 7vw, 88px)",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.035em",
            margin: "0 auto",
            maxWidth: "920px",
          }}
        >
          Every leasing channel.
          <br />
          <span style={{ color: "#2563EB" }}>One source of truth.</span>
        </h1>

        <p
          className="mt-8 mx-auto"
          style={{
            color: "#475569",
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(17px, 1.6vw, 21px)",
            lineHeight: 1.55,
            maxWidth: "640px",
            fontWeight: 400,
          }}
        >
          The marketing stack for real estate operators. Site, chatbot,
          ads, attribution, and reputation — built to work together, priced
          to replace your retainer.
        </p>

        <div className="mt-12 flex items-center justify-center">
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
              letterSpacing: "-0.005em",
            }}
          >
            Start a 14-day trial
          </Link>
        </div>

        <p
          className="mt-5"
          style={{
            color: "#94A3B8",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
          }}
        >
          No credit card. Pick the modules you want when you sign up.
        </p>
      </div>
    </section>
  );
}
