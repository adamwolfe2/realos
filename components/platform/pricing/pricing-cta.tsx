import Link from "next/link";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// Bottom CTA. White background, blue accent on the headline. No eyebrow
// (the page already has one on the hero; rule of one eyebrow per three
// sections). The one canonical buying pair on this page: "Start free
// trial" (routes back to the builder, the single source of truth for
// what gets configured) and "Book a demo" → Cal.com via BookDemoLink.

export function PricingCta() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid var(--hair)",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24 text-center">
        <h2
          className="heading-section"
          style={{
            color: "#1E2A3A",
            maxWidth: "720px",
            margin: "0 auto",
            fontSize: "clamp(28px, 4vw, 40px)",
          }}
        >
          Configure your platform.{" "}
          <span style={{ color: "var(--color-primary)" }}>Start free trial today.</span>
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
          Connect your existing stack, pick the features each property needs,
          and go live on a 14-day free trial. No card required.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="#builder"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors active:scale-[0.98]"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "#ffffff",
            }}
          >
            Start free trial
          </Link>
          <BookDemoLink
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors active:scale-[0.98]"
            style={{
              backgroundColor: "transparent",
              color: "#1E2A3A",
              border: "1px solid var(--hair-strong)",
            }}
          >
            Book a demo
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
          No contracts. Flexible, month-to-month.
        </p>
      </div>
    </section>
  );
}
