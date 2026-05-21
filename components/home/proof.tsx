import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// Proof — final CTA section.
//
// Light-mode treatment matching the rest of the homepage. Was a dark navy
// slab with white text; that visual break dropped out of the page rhythm
// at the very bottom. Now: same content, white background, dark text,
// blue + amber accents preserved.
// ---------------------------------------------------------------------------

export function Proof() {
  const { final } = MARKETING.home;

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        color: "#1E2A3A",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        {/* Eyebrow — urgency cue. Norman feedback (2026-05-21): chart
            + accent colors stay on the brand blue ramp, no amber/
            terracotta semantic accents. */}
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
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#2563EB",
              marginRight: 8,
              verticalAlign: "middle",
            }}
          />
          Pilot cohort &middot; open now
        </p>

        {/* Hero row — offer on the left, action on the right */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:gap-12 items-end">
          <div>
            <h2
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(36px, 5.4vw, 64px)",
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
              }}
            >
              Free pilot.
              <br />
              <span style={{ color: "#2563EB" }}>No commitment.</span>
            </h2>
            <p
              className="mt-5 max-w-[560px]"
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                lineHeight: 1.55,
              }}
            >
              {final.body}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 lg:min-w-[220px]">
            <Link
              href={final.primaryHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "50px",
                padding: "14px 28px",
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                fontFamily: "var(--font-sans)",
                fontSize: "15.5px",
                fontWeight: 600,
                borderRadius: "3px",
                textDecoration: "none",
                letterSpacing: "-0.005em",
                transition: "background-color 0.2s ease",
              }}
            >
              {final.primaryCta}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                style={{ marginLeft: 8 }}
              >
                <path
                  d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              href="#live"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "50px",
                padding: "14px 28px",
                backgroundColor: "#FFFFFF",
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "15.5px",
                fontWeight: 600,
                borderRadius: "3px",
                textDecoration: "none",
                letterSpacing: "-0.005em",
                border: "1px solid #CBD5E1",
                transition: "background-color 0.2s ease",
              }}
            >
              See the data
            </Link>
          </div>
        </div>

        {/* Trust strip — inline horizontal proof points, not a giant grid */}
        <div
          className="mt-12 md:mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0"
          style={{
            borderTop: "1px solid #E2E8F0",
            paddingTop: 28,
          }}
        >
          <TrustPoint
            label="Time to live"
            value="14 days"
            body="From intake call to your domain firing."
            divider
          />
          <TrustPoint
            label="What you log into"
            value="1 portal"
            body="Not six vendors, six invoices, six dashboards."
            divider
          />
          <TrustPoint
            label="Lock-in"
            value="Month-to-month"
            body="No long-term contracts. Leave anytime."
          />
        </div>
      </div>
    </section>
  );
}

function TrustPoint({
  label,
  value,
  body,
  divider,
}: {
  label: string;
  value: string;
  body: string;
  divider?: boolean;
}) {
  return (
    <div
      className="md:px-8 md:first:pl-0 md:last:pr-0"
      style={{
        borderRight: divider ? "1px solid #E2E8F0" : "none",
      }}
    >
      <p
        style={{
          color: "#94A3B8",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        className="mt-2"
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(24px, 2.4vw, 28px)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      <p
        className="mt-2 max-w-[260px]"
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
    </div>
  );
}
