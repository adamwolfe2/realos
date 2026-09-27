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
            color: "var(--color-ink)",
            maxWidth: "720px",
            margin: "0 auto",
            fontSize: "clamp(28px, 4vw, 40px)",
          }}
        >
          See it on your property.{" "}
          <span style={{ color: "var(--color-primary)" }}>Book a demo.</span>
        </h2>
        <p
          className="mt-5 mx-auto"
          style={{
            color: "var(--gray-70)",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.55,
            maxWidth: "620px",
          }}
        >
          We connect to your stack, show you your own numbers, and set up
          the features each property needs with you. Prefer to explore on
          your own first? The 14-day free trial needs no card.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <BookDemoLink className="btn-primary">Book a demo</BookDemoLink>
          <Link href="#builder" className="btn-secondary">
            Start free trial
          </Link>
        </div>

        <p
          className="mt-8"
          style={{
            color: "var(--gray-60)",
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
