import Link from "next/link";
import { SoftBlurIn } from "@/components/ui/animate-text";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// Hero — product-forward rebuild (2026-07-21 blueprint, section 1).
//
// Full-width confident typography, no artifact beside it. The real product
// is shown large directly underneath (see ProductHeroShot). No eyebrow.
// Headline: two lines, second sentence in brand blue, weight 550 so it
// reads SET, not typed. Subtext <= 20 words. Canonical CTA pair.
// ---------------------------------------------------------------------------

export function Hero() {
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 pt-20 md:pt-24 pb-0">
        <h1
          style={{
            color: "#161616",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(44px, 7vw, 76px)",
            fontWeight: 550,
            lineHeight: 1.02,
            letterSpacing: "-0.04em",
            maxWidth: "980px",
          }}
        >
          <SoftBlurIn
            segments={[
              { text: "Every lead, tour, and lease." },
              { text: "One system.", color: "#0f62fe" },
            ]}
          />
        </h1>

        <p
          className="mt-6 md:mt-7"
          style={{
            color: "#6f6f6f",
            fontFamily: "var(--font-sans)",
            fontSize: "18px",
            lineHeight: 1.6,
            maxWidth: "560px",
          }}
        >
          LeaseStack unifies marketing, leasing, and reputation data into one
          dashboard your whole team runs on.
        </p>

        <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center gap-3">
          <Link
            href="/sign-up"
            className="btn-primary sm:w-auto"
            style={{ display: "flex", justifyContent: "center" }}
          >
            Request pilot
          </Link>
          <BookDemoLink
            className="btn-secondary sm:w-auto"
            style={{ display: "flex", justifyContent: "center" }}
          >
            Book a demo
          </BookDemoLink>
        </div>
      </div>
    </section>
  );
}
