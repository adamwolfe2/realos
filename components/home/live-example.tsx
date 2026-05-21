import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// LiveExample — link out to the actual live surfaces.
//
// Previous version wrapped each link in a browser-chrome card with a tiny
// faux-UI mockup of the resident site and the operator portal. The mockups
// were too small to convey product detail and the operator-portal preview
// duplicated the interactive ProductTour rendered immediately below this
// section. Stripped back to two clean editorial cards — no fake chrome,
// no fake mockups, prominent CTAs.
// ---------------------------------------------------------------------------

export function LiveExample() {
  const { liveExample } = MARKETING.home;

  return (
    <section
      id="live"
      style={{
        backgroundColor: "#F8FAFC",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="max-w-3xl mb-10 md:mb-14">
          <p className="eyebrow mb-3">{liveExample.eyebrow}</p>
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.6vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            {liveExample.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.55,
            }}
          >
            {liveExample.body}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <DestinationCard
            href={liveExample.siteHref}
            external
            kicker="Resident-facing site"
            host="your-property.com"
            title={liveExample.siteLabel}
            caption={liveExample.siteCaption}
            cta="Open the live site"
          />
          <DestinationCard
            href={liveExample.portalHref}
            kicker="Operator portal"
            host="leasestack.co/portal"
            title={liveExample.portalLabel}
            caption={liveExample.portalCaption}
            cta="Walk through the portal"
          />
        </div>
      </div>
    </section>
  );
}

function DestinationCard({
  href,
  external = false,
  kicker,
  host,
  title,
  caption,
  cta,
}: {
  href: string;
  external?: boolean;
  kicker: string;
  host: string;
  title: string;
  caption: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="group block transition-shadow hover:shadow-md"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 4,
        padding: "28px 28px 24px",
      }}
    >
      {/* Kicker row: label + live-host chip */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {kicker}
        </p>
        <span
          className="inline-flex items-center gap-1.5"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.04em",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              backgroundColor: "#2563EB",
              borderRadius: "50%",
            }}
          />
          {host}
        </span>
      </div>

      <h3
        className="mt-5"
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(20px, 2vw, 24px)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>
      <p
        className="mt-3"
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          lineHeight: 1.6,
        }}
      >
        {caption}
      </p>

      <p
        className="mt-6 inline-flex items-center gap-1.5 transition-transform group-hover:translate-x-1"
        style={{
          color: "#2563EB",
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          fontWeight: 600,
          letterSpacing: "-0.005em",
        }}
      >
        {cta}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d={
              external
                ? "M5 9L9 5M9 5H5.5M9 5V8.5"
                : "M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
            }
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </p>
    </Link>
  );
}
