import Link from "next/link";
import type { ReactNode } from "react";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// Claude-style feature page: parchment canvas, Fraunces serif headline,
// terracotta eyebrow + checkmarks, editorial pacing.

export function FeaturePage({
  eyebrow,
  headline,
  subhead,
  whatItIs,
  howItWorks,
  results,
  bestFor,
  artifact,
}: {
  eyebrow: string;
  headline: string;
  subhead: string;
  whatItIs: string;
  howItWorks: string[];
  results: string[];
  bestFor: string;
  artifact?: ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <header>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-16 text-center">
          <p
            style={{
              color: "#8d8d8d",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: "20px",
            }}
          >
            {eyebrow}
          </p>
          <h1
            className="mx-auto"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.005em",
            }}
          >
            {headline}
          </h1>
          <p
            className="mx-auto mt-6 max-w-[640px]"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
            }}
          >
            {subhead}
          </p>
        </div>
      </header>

      {artifact ? (
        <section style={{ backgroundColor: "#FFFFFF" }}>
          <div className="max-w-[920px] mx-auto px-4 md:px-8 pb-16">
            {artifact}
          </div>
        </section>
      ) : null}

      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-16 text-center">
          <p
            className="mx-auto max-w-[760px]"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.35,
            }}
          >
            {whatItIs}
          </p>
        </div>
      </section>

      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20">
          <h2
            className="text-center mb-10"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.3,
            }}
          >
            How it works
          </h2>
          <ol className="space-y-3">
            {howItWorks.map((step) => (
              <li
                key={step}
                className="p-6 flex gap-5"
                style={{
                  backgroundColor: "#f4f4f4",
                  borderRadius: "2px",
                  boxShadow: "0 0 0 1px #e0e0e0",
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center flex-shrink-0 mt-1 w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: "rgba(15,98,254,0.14)",
                    color: "#0f62fe",
                    marginTop: "3px",
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
                <p
                  style={{
                    color: "#161616",
                    fontFamily: "var(--font-sans)",
                    fontSize: "16px",
                    lineHeight: 1.6,
                  }}
                >
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-16">
          <h2
            className="text-center mb-10"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.3,
            }}
          >
            What to expect
          </h2>
          <ul className="mx-auto max-w-[680px] space-y-3">
            {results.map((r) => (
              <li
                key={r}
                className="flex items-start gap-3"
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-sans)",
                  fontSize: "16px",
                  lineHeight: 1.6,
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center flex-shrink-0 mt-1 w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: "rgba(15,98,254,0.14)",
                    color: "#0f62fe",
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
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 text-center">
          <p
            className="mx-auto max-w-[720px]"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.35,
            }}
          >
            Best for {bestFor}
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-primary">
              Request pilot
            </Link>
            <BookDemoLink className="btn-secondary">
              Book a demo
            </BookDemoLink>
          </div>
        </div>
      </section>
    </div>
  );
}
