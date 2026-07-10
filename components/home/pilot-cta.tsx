import Link from "next/link";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// PilotCta — small dedicated card that sits between the ProductTour and
// the PlatformWalkthrough. Reinforces the pilot offer at the moment the
// reader is most curious about the product, without competing with the
// hero or the final Proof CTA.
//
// Carbon wave 2 (2026-07-10): canonical CTA pair. "Request pilot" is
// the self-serve pilot entry (/sign-up, one destination site-wide);
// "Book intro call" opens the Cal.com modal via BookDemoLink for the
// operator-conversation intent this card's copy describes.

export function PilotCta() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #e0e0e0",
      }}
    >
      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-12 md:py-16">
        <div
          className="relative overflow-hidden rounded-[2px]"
          style={{
            padding: "32px 28px",
            background: "var(--color-accent)",
            boxShadow: "0 0 0 1px #e0e0e0",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-10">
            <div className="max-w-2xl">
              <p
                className="eyebrow mb-3"
                style={{ color: "#0f62fe" }}
              >
                Free pilot
              </p>
              <h2
                style={{
                  color: "#161616",
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
                  color: "#6f6f6f",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15.5px",
                  lineHeight: 1.6,
                }}
              >
                No sales pitch. No deck. Thirty minutes with the operator who built this.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <Link
                href="/sign-up"
                className="btn-primary"
                style={{ display: "inline-flex", justifyContent: "center" }}
                aria-label="Request pilot (creates your account)"
              >
                Request pilot
              </Link>
              <BookDemoLink
                className="btn-secondary"
                style={{ display: "inline-flex", justifyContent: "center" }}
                ariaLabel="Book intro call (opens scheduling)"
              >
                Book intro call
              </BookDemoLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
