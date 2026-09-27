import Link from "next/link";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// PricingHero — single-column centered text hero. No artifact, no
// split layout. Matches the /audit hero's centered rhythm so pricing
// reads as a focused buying moment instead of a marketing wall.
//
// Structure:
//   max-w-[1100px] outer  ·  max-w-3xl mx-auto text-center inner
//   centered eyebrow with mirroring blue lines
//   centered headline + accent color on the second line
//   centered subhead capped at max-w-2xl
//   centered CTA row
//
// 2026-07-21 pricing rebuild: the page is now one builder, not a hero plus
// tier cards plus a separate à-la-carte grid. "Start free trial" is the one
// primary CTA on the page and always resolves to the builder below (#builder)
// where the operator configures, then signs up with their exact selection.
// The old trust-chip strip is gone; its facts (14-day trial, no card) live
// in the subhead and again next to the builder's CTA.
// ---------------------------------------------------------------------------

const PRIMARY_HREF = "#builder";

export function PricingHero() {
  return (
    <section
      className="relative"
      style={{ backgroundColor: "#FFFFFF", color: "var(--color-ink)" }}
    >
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow — line + mono blue label + mirrored line */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span
              aria-hidden
              className="hidden sm:inline-block"
              style={{ width: 28, height: 1, backgroundColor: "var(--color-primary)" }}
            />
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}
            >
              Pricing
            </p>
            <span
              aria-hidden
              className="hidden sm:inline-block"
              style={{ width: 28, height: 1, backgroundColor: "var(--color-primary)" }}
            />
          </div>

          {/* Headline: one platform fee, add what you need. */}
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight"
            style={{ color: "var(--color-ink)" }}
          >
            One platform fee.
            <br />
            <span style={{ color: "var(--color-primary)" }}>Add only what you need.</span>
          </h1>

          {/* Subhead, capped at 20 words. */}
          <p
            className="mt-5 text-lg md:text-xl leading-relaxed mx-auto max-w-2xl"
            style={{ color: "#525252" }}
          >
            We walk through it on your own property's data first, then you
            pick the features it needs. Prefer to explore alone? Start a
            14-day free trial, no card required.
          </p>

          {/* Primary + secondary CTA — the one canonical buying pair on
              this page: "Book a demo" (primary) and "Start free trial". */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <BookDemoLink className="btn-primary">Book a demo</BookDemoLink>
            <Link href={PRIMARY_HREF} className="btn-secondary">
              Start free trial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
