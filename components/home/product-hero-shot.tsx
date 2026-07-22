import { ProductTour } from "@/components/product-tour";
import { ProductFrame } from "./product-frame";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { Reveal } from "@/components/platform/reveal";

// ---------------------------------------------------------------------------
// ProductHeroShot — the moment (2026-07-21 blueprint, section 2).
//
// The real, interactive operator portal shown large in a browser frame,
// directly under the hero copy. The frame straddles the white -> #f4f4f4
// seam: a white band covers the top of the section (continuing the hero),
// the section base is #f4f4f4 (flowing into the trust band), and the frame
// overlaps both.
//
// Desktop shows the live <ProductTour /> (built for >= 768px). Mobile
// swaps to the committed screenshot + a "book a demo" line, since the
// dense dashboard doesn't collapse to a phone.
//
// id="product-tour" preserves the existing #product-tour anchor used by
// the final CTA's "See the portal" link.
// ---------------------------------------------------------------------------

export function ProductHeroShot() {
  return (
    <section
      id="product-tour"
      className="relative"
      style={{ backgroundColor: "#f4f4f4" }}
    >
      {/* White upper band so the frame straddles the seam into #f4f4f4. */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ height: "56%", backgroundColor: "#FFFFFF" }}
        aria-hidden
      />

      <div className="relative max-w-[1240px] mx-auto px-4 md:px-8 pt-14 md:pt-16 pb-16 md:pb-24">
        <Reveal y={24}>
          <ProductFrame
            url="app.leasestack.co/portal"
            contentStyle={{ backgroundColor: "#F1F5F9" }}
          >
            {/* Desktop: real interactive tour. */}
            <div className="hidden md:block">
              <ProductTour />
            </div>

            {/* Mobile: committed screenshot fallback. */}
            <div className="md:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/marketing/product-tour-preview.png"
                alt="LeaseStack operator portal"
                loading="lazy"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
              <div
                style={{
                  padding: "16px 18px",
                  borderTop: "1px solid #e0e0e0",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#525252",
                  }}
                >
                  Open this page on a laptop to click through the live operator
                  portal.
                </p>
                <BookDemoLink
                  className="mt-3 inline-flex items-center"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f62fe",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Book a demo
                </BookDemoLink>
              </div>
            </div>
          </ProductFrame>
        </Reveal>
      </div>
    </section>
  );
}
