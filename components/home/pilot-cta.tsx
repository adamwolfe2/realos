import Link from "next/link";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// PilotCta — small dedicated card that sits between the ProductTour and
// the PlatformWalkthrough. Reinforces the pilot offer at the moment the
// reader is most curious about the product, without competing with the
// hero or the final Proof CTA.
//
// Norman feedback (2026-06-02): "Request pilot" used to route to
// /onboarding (the trial wizard), bouncing prospects from a sales-call
// intent into a product-onboarding flow. Now wired through BookDemoLink
// so it opens the inline Cal.com modal — same conversation outcome,
// without the path collision with self-serve trialers.

export function PilotCta() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-12 md:py-16">
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{
            padding: "32px 28px",
            background:
              "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(37,99,235,0.02) 60%, #FFFFFF 100%)",
            boxShadow:
              "0 0 0 1px rgba(15,23,42,0.06), 0 12px 36px rgba(37,99,235,0.06)",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-10">
            <div className="max-w-2xl">
              <p
                className="eyebrow mb-3"
                style={{ color: "#2563EB" }}
              >
                Free pilot
              </p>
              <h2
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(22px, 2.6vw, 30px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                Connect your stack. See your dashboard light up.
              </h2>
              {/* Norman v2 MC3: subcopy reframed from "no card / no
                  commitment" to operator-led intro framing. */}
              <p
                className="mt-3"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15.5px",
                  lineHeight: 1.6,
                }}
              >
                No sales pitch. No deck. Thirty minutes with the operator who built this.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <BookDemoLink
                className="btn-primary"
                style={{ display: "inline-flex", justifyContent: "center" }}
                ariaLabel="Request pilot — opens scheduling"
              >
                Request pilot
              </BookDemoLink>
              <Link
                href="/demo"
                className="btn-secondary"
                style={{ display: "inline-flex", justifyContent: "center" }}
              >
                See a live property
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
