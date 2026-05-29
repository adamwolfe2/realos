import { ProductTour } from "@/components/product-tour";

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
    <section id="product-tour" style={{ backgroundColor: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-16 pb-16 md:pb-28 md:pt-24">
        <div className="max-w-3xl mb-8 md:mb-12">
          <p className="eyebrow mb-3 md:mb-4">Interactive preview</p>
          <h2 className="heading-section" style={{ color: "#1E2A3A" }}>
            <span className="hidden md:inline">Click through the operator portal.</span>
            <span className="md:hidden">The operator portal.</span>
          </h2>
          <p
            className="mt-3 md:mt-4 max-w-2xl"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              lineHeight: 1.6,
              color: "#64748B",
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
              border: "1px solid #E2E8F0",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 12px 32px rgba(30, 42, 58, 0.06)",
            }}
          >
            {/* TODO(#25): swap stock for custom photography — and ship the
                actual screenshot. The path below resolves to /public/marketing/
                which does not exist yet; a real PNG of the operator-portal
                dashboard (not a stock illustration) needs to land here so the
                mobile fallback stops rendering a broken image. */}
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
            {/* Note: no onError fallback — Next 16 forbids event handlers
                on Server Component output (this section ships SSR-only).
                The asset exists at /public/marketing/; if it ever goes
                missing the browser-default broken-image is acceptable
                rather than re-introducing a Client Component boundary. */}
            <div
              style={{
                padding: "16px 18px",
                borderTop: "1px solid #E2E8F0",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  color: "#94A3B8",
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
                  color: "#475569",
                }}
              >
                Open this page on a laptop to click through the live tour.
              </p>
              <a
                href="/onboarding"
                className="mt-3 inline-flex items-center"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#2563EB",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Book a demo instead
              </a>
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
