import Link from "next/link";
import { SectionEyebrow } from "@/components/platform/section-eyebrow";

// Bottom CTA. Parchment background, blue accent on the headline, two
// paths forward. Self-serve framing.

export function PricingCta() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24 text-center">
        <SectionEyebrow align="center" className="mb-4">
          Start with the pilot
        </SectionEyebrow>
        <h2
          className="heading-section"
          style={{
            color: "#1E2A3A",
            maxWidth: "720px",
            margin: "0 auto",
            fontSize: "clamp(28px, 4vw, 40px)",
          }}
        >
          See what your dashboard actually says.{" "}
          <span style={{ color: "#2563EB" }}>Free. No commitment.</span>
        </h2>
        <p
          className="mt-5 mx-auto"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.55,
            maxWidth: "620px",
          }}
        >
          Connect your existing stack and we will show you exactly what your
          digital marketing is doing. One weekly snapshot, one operator-written
          recommendation, no card on file. Upgrade when you want us to keep
          going.
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
            Start the free pilot
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#1E2A3A",
              border: "1px solid #d6d3c8",
            }}
          >
            See it on a live property
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
          Free pilot. No contracts. Flexible, month-to-month.
        </p>
      </div>
    </section>
  );
}
