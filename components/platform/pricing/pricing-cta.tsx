import Link from "next/link";
import { SectionEyebrow } from "@/components/platform/section-eyebrow";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// Bottom CTA. White background, blue accent on the headline, the one
// canonical buying pair: "Request pilot" → /sign-up and "Book intro
// call" → Cal.com via BookDemoLink.

export function PricingCta() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid var(--hair)",
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
          <span style={{ color: "var(--color-primary)" }}>Free. No commitment.</span>
        </h2>
        <p
          className="mt-5 mx-auto"
          style={{
            color: "var(--olive-gray)",
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
              backgroundColor: "var(--color-primary)",
              color: "#ffffff",
            }}
          >
            Request pilot
          </Link>
          <BookDemoLink
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#1E2A3A",
              border: "1px solid var(--hair-strong)",
            }}
          >
            Book intro call
          </BookDemoLink>
        </div>

        <p
          className="mt-8"
          style={{
            color: "var(--stone-gray)",
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
