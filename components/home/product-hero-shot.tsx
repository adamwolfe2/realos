import { ProductTour } from "@/components/product-tour";
import { ProductFrame } from "./product-frame";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { SectionShell, LabelChip } from "./section-shell";
import { Atmosphere } from "./atmosphere";
import { FrameSettle } from "./frame-settle";

// ---------------------------------------------------------------------------
// ProductHeroShot — [02] The system. The real operator portal shown large in
// the physical browser frame (depth addendum sec 2 + 6; motion pass sec 2).
// Atmosphere behind it, a blue contact glow beneath it so it sits ON
// something, and a perspective settle as it enters view.
//
// The embedded ProductTour is a portal-shared client component; per scope we
// do not edit its internals. Its "alive" staging is carried by the frame:
// perspective settle + fade, on a cool #fbfcfe viewport ground.
//
// id="product-tour" preserves the final CTA's "See the portal" anchor.
// ---------------------------------------------------------------------------

export function ProductHeroShot() {
  return (
    <SectionShell id="product-tour" index="02" indexLabel="The system" bg="#FFFFFF">
      <div className="relative py-16 md:py-20">
        <Atmosphere />

        <div className="relative">
          <LabelChip>Operator portal</LabelChip>
          <h2
            className="mt-4"
            style={{
              color: "#161616",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.4vw, 40px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            The system behind it.
          </h2>

          <div className="relative mt-10 md:mt-12">
            {/* Under-frame contact glow. */}
            <div
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                bottom: -28,
                width: "78%",
                height: 130,
                background:
                  "radial-gradient(50% 50% at 50% 50%, rgba(15,98,254,0.12), transparent 70%)",
                filter: "blur(26px)",
              }}
            />

            <FrameSettle className="relative">
              <ProductFrame
                url="app.leasestack.co/portal"
                contentStyle={{ backgroundColor: "#fbfcfe" }}
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
                      Open this page on a laptop to click through the live
                      operator portal.
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
            </FrameSettle>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
