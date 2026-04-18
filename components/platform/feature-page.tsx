import Link from "next/link";

// Tesla-style feature page: white canvas, centered composition, two type
// weights, 4px radii, Electric Blue CTAs. Numbered "how it works" rows sit
// on Light Ash with no borders, just spacing as the separator.

export function FeaturePage({
  eyebrow,
  headline,
  subhead,
  whatItIs,
  howItWorks,
  results,
  bestFor,
}: {
  eyebrow: string;
  headline: string;
  subhead: string;
  whatItIs: string;
  howItWorks: string[];
  results: string[];
  bestFor: string;
}) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#393C41" }}>
      <header>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 pt-24 pb-16 text-center">
          <p
            className="mb-5"
            style={{
              color: "#3E6AE1",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {eyebrow}
          </p>
          <h1
            className="mx-auto"
            style={{
              color: "#171A20",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px, 4.8vw, 52px)",
              fontWeight: 500,
              lineHeight: 1.1,
            }}
          >
            {headline}
          </h1>
          <p
            className="mx-auto mt-5 max-w-[620px]"
            style={{
              color: "#393C41",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.55,
            }}
          >
            {subhead}
          </p>
        </div>
      </header>

      <section style={{ backgroundColor: "#F4F4F4" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-16 text-center">
          <p
            style={{
              color: "#5C5E62",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: "12px",
            }}
          >
            What it is
          </p>
          <p
            className="mx-auto max-w-[720px]"
            style={{
              color: "#171A20",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(20px, 2.4vw, 28px)",
              fontWeight: 400,
              lineHeight: 1.4,
              letterSpacing: "normal",
            }}
          >
            {whatItIs}
          </p>
        </div>
      </section>

      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-16">
          <p
            className="text-center mb-10"
            style={{
              color: "#5C5E62",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            How it works
          </p>
          <ol className="space-y-3">
            {howItWorks.map((step, i) => (
              <li
                key={step}
                className="p-6 flex gap-5"
                style={{
                  backgroundColor: "#F4F4F4",
                  borderRadius: "12px",
                }}
              >
                <span
                  style={{
                    color: "#3E6AE1",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    minWidth: "2ch",
                    paddingTop: "2px",
                  }}
                >
                  0{i + 1}
                </span>
                <p
                  style={{
                    color: "#171A20",
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    fontWeight: 400,
                    lineHeight: 1.55,
                  }}
                >
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section style={{ backgroundColor: "#F4F4F4" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-16">
          <p
            className="text-center mb-8"
            style={{
              color: "#5C5E62",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            What to expect
          </p>
          <ul className="mx-auto max-w-[680px] space-y-3">
            {results.map((r) => (
              <li
                key={r}
                className="flex items-start gap-3"
                style={{
                  color: "#171A20",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  lineHeight: 1.55,
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center flex-shrink-0 mt-1 w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: "rgba(62,106,225,0.12)",
                    color: "#3E6AE1",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M1.5 5L4 7.5L8.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-16 text-center">
          <p
            style={{
              color: "#5C5E62",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: "12px",
            }}
          >
            Best for
          </p>
          <p
            className="mx-auto max-w-[720px]"
            style={{
              color: "#171A20",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(20px, 2.4vw, 28px)",
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            {bestFor}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/onboarding" className="btn-primary">
              Book a demo
            </Link>
            <Link href="/pricing" className="btn-secondary">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
