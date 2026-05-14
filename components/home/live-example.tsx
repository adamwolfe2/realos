import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// LiveExample — editorial rewrite (matches new home rhythm).
//
// Was: 2 bordered card tiles with icon + brand-pill + "Live deployment" /
// "Operator portal" green-dot badges.
// Now: split editorial section. Header + body on the top, two large
// destination blocks below — each block is a label + headline + caption +
// arrow link, no card chrome. Reads as "here are two surfaces, click in,"
// not "look at these two cards."
// ---------------------------------------------------------------------------

export function LiveExample() {
  const { liveExample } = MARKETING.home;
  return (
    <section
      id="live"
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-16">
          <p className="eyebrow mb-4">{liveExample.eyebrow}</p>
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(34px, 4.8vw, 56px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            {liveExample.headline}
          </h2>
          <p
            className="mt-6 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {liveExample.body}
          </p>
        </div>

        {/* Two destinations — clean editorial blocks, hairline rule between. */}
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ borderTop: "1px solid #E2E8F0" }}
        >
          <LiveBlock
            href={liveExample.siteHref}
            kicker="Resident-facing"
            title={liveExample.siteLabel}
            caption={liveExample.siteCaption}
            external
          />
          <LiveBlock
            href={liveExample.portalHref}
            kicker="Operator portal"
            title={liveExample.portalLabel}
            caption={liveExample.portalCaption}
            withDivider
          />
        </div>
      </div>
    </section>
  );
}

function LiveBlock({
  href,
  kicker,
  title,
  caption,
  external = false,
  withDivider = false,
}: {
  href: string;
  kicker: string;
  title: string;
  caption: string;
  external?: boolean;
  withDivider?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="group block py-10 md:py-12 md:px-10"
      style={{
        borderLeft: withDivider ? "1px solid #E2E8F0" : "none",
      }}
    >
      <p
        style={{
          color: "#2563EB",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <span
          aria-hidden
          className="inline-block mr-2"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#16A34A",
            verticalAlign: "middle",
          }}
        />
        {kicker} · live
      </p>
      <h3
        className="mt-3"
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(26px, 3vw, 36px)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        {title}
      </h3>
      <p
        className="mt-4 max-w-md"
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: "16px",
          lineHeight: 1.6,
        }}
      >
        {caption}
      </p>
      <p
        className="mt-6 inline-flex items-center gap-2 transition-transform group-hover:translate-x-1"
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          fontWeight: 600,
          letterSpacing: "-0.005em",
        }}
      >
        {external ? "Open the live site" : "Click through the portal"}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d={
              external
                ? "M5 9L9 5M9 5H5.5M9 5V8.5"
                : "M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
            }
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </p>
    </Link>
  );
}
