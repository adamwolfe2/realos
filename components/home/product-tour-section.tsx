import { ProductTour } from "@/components/product-tour";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// ProductTourSection — interactive operator portal embed.
//
// Mobile note (2026-05-21): the ProductTour itself is a 640px-tall
// dashboard mockup built for ≥768px viewports. On phones, the sidebar,
// dense KPI grid, and 7/30/90 toggle overlap the featured-property
// strip. Rather than rework the full mini-app for mobile, we hide the
// embed below md: and surface a plain "open on desktop" card with the
// same CTA. Desktop is unchanged.
// ---------------------------------------------------------------------------

export function ProductTourSection() {
  return (
    <section id="product-tour" style={{ backgroundColor: "#f4f4f4", borderTop: "1px solid #e0e0e0" }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-16 pb-16 md:pb-28 md:pt-24">
        <div className="max-w-3xl mb-8 md:mb-12">
          <p className="eyebrow mb-3 md:mb-4">Interactive preview</p>
          <h2 className="heading-section" style={{ color: "#161616" }}>
            <span className="hidden md:inline">Click through the operator portal.</span>
            <span className="md:hidden">The operator portal.</span>
          </h2>
          <p
            className="mt-3 md:mt-4 max-w-2xl"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              lineHeight: 1.6,
              color: "#6f6f6f",
            }}
          >
            <span className="hidden md:inline">
              Every tab below is a real surface in the platform. Open a lead. Read a chatbot conversation. Filter the creative queue. This ships day one.
            </span>
            <span className="md:hidden">
              Every surface ships day one. The full interactive tour is built for a wider screen.
            </span>
          </p>
        </div>

        {/* Mobile: simple placeholder card with screenshot + desktop CTA. */}
        <div className="md:hidden">
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #e0e0e0",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {/* Real screenshot of the desktop operator-portal dashboard
                (the same <ProductTour /> rendered below on md+), captured to
                /public/marketing/product-tour-preview.png. Regenerate by
                screenshotting the #product-tour dashboard at ~1280px wide. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marketing/product-tour-preview.png"
              alt="LeaseStack operator portal preview"
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
              }}
            />
            {/* No onError fallback: this section is SSR-only (Server
                Component), so no event handlers. The asset is committed at
                /public/marketing/product-tour-preview.png — keep it in sync
                with the live dashboard. */}
            <div
              style={{
                padding: "16px 18px",
                borderTop: "1px solid #e0e0e0",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  color: "#8d8d8d",
                }}
              >
                Best on desktop
              </p>
              <p
                className="mt-1"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#525252",
                }}
              >
                Open this page on a laptop to click through the live tour.
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
                Book intro call
              </BookDemoLink>
            </div>
          </div>
        </div>

        {/* Desktop: full interactive tour, unchanged. */}
        <div className="hidden md:block">
          <ProductTour />
        </div>
      </div>
    </section>
  );
}
