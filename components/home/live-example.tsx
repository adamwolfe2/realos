import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// LiveExample — product preview frames.
//
// Earlier version was two text-only blocks with arrow links. Read as "click
// here" placeholders, not proof of a live deployment. This rewrite frames
// each destination in a browser-chrome card that previews the actual surface
// the prospect would land on. Resident-facing site shows a property hero
// strip and listings grid; operator portal shows the dashboard KPI tiles
// and lead source mix. Both are styled CSS — no images, no external load.
// ---------------------------------------------------------------------------

export function LiveExample() {
  const { liveExample } = MARKETING.home;
  return (
    <section
      id="live"
      style={{
        backgroundColor: "#F1F5F9",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-16 md:py-24">
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

        {/* Two preview cards. Each is a browser-chrome frame wrapping a mini
            mock of the actual surface, with link metadata + CTA underneath. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
          <PreviewCard
            href={liveExample.siteHref}
            host="your-property.com"
            kicker="Resident-facing · live"
            title={liveExample.siteLabel}
            caption={liveExample.siteCaption}
            cta="Open the live site"
            external
            preview={<ResidentSitePreview />}
          />
          <PreviewCard
            href={liveExample.portalHref}
            host="leasestack.co/portal"
            kicker="Operator portal · live"
            title={liveExample.portalLabel}
            caption={liveExample.portalCaption}
            cta="Click through the portal"
            preview={<OperatorPortalPreview />}
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PreviewCard — browser chrome + content slot + metadata footer.
// ---------------------------------------------------------------------------
function PreviewCard({
  href,
  host,
  kicker,
  title,
  caption,
  cta,
  external = false,
  preview,
}: {
  href: string;
  host: string;
  kicker: string;
  title: string;
  caption: string;
  cta: string;
  external?: boolean;
  preview: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="group block overflow-hidden transition-shadow hover:shadow-lg"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 4,
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5"
        style={{
          backgroundColor: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <div className="flex gap-1.5">
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              backgroundColor: "#E2E8F0",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              backgroundColor: "#E2E8F0",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              backgroundColor: "#E2E8F0",
            }}
          />
        </div>
        <div
          className="flex-1 mx-2 px-2.5 py-1 flex items-center gap-2"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 3,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#16A34A",
            }}
          />
          <span
            style={{
              color: "#64748B",
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.04em",
            }}
          >
            {host}
          </span>
        </div>
        <span
          style={{
            color: "#16A34A",
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          LIVE
        </span>
      </div>

      {/* Preview content */}
      <div
        className="overflow-hidden"
        style={{
          height: 240,
          backgroundColor: "#FFFFFF",
        }}
      >
        {preview}
      </div>

      {/* Footer metadata */}
      <div
        className="px-5 py-4"
        style={{ borderTop: "1px solid #E2E8F0" }}
      >
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
        <h3
          className="mt-2"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.25,
          }}
        >
          {title}
        </h3>
        <p
          className="mt-2"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            lineHeight: 1.55,
          }}
        >
          {caption}
        </p>
        <p
          className="mt-3 inline-flex items-center gap-1.5 transition-transform group-hover:translate-x-1"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {cta}
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              d={
                external
                  ? "M4.5 8.5L8.5 4.5M8.5 4.5H5M8.5 4.5V8"
                  : "M2.5 6.5h8m0 0L7 3m3.5 3.5L7 10"
              }
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ResidentSitePreview — student-housing site mockup.
// ---------------------------------------------------------------------------
function ResidentSitePreview() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Site header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid #F1F5F9" }}
      >
        <span
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "11.5px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Your Property
        </span>
        <div className="flex gap-3">
          {["Floor plans", "Tours", "Apply"].map((t) => (
            <span
              key={t}
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "10px",
                fontWeight: 500,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Hero strip */}
      <div
        className="px-4 py-3 flex items-end justify-between"
        style={{
          background:
            "linear-gradient(135deg, #1E2A3A 0%, #2563EB 100%)",
          minHeight: 80,
        }}
      >
        <div>
          <p
            style={{
              color: "rgba(255,255,255,0.7)",
              fontFamily: "var(--font-mono)",
              fontSize: "8.5px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Now leasing · Fall 2026
          </p>
          <p
            className="mt-1"
            style={{
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
            }}
          >
            Steps from campus.
            <br />
            Built for students.
          </p>
        </div>
        <button
          type="button"
          tabIndex={-1}
          style={{
            padding: "5px 10px",
            backgroundColor: "#FFFFFF",
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "10px",
            fontWeight: 600,
            borderRadius: 2,
            border: "none",
          }}
        >
          Book a tour
        </button>
      </div>

      {/* Listings grid */}
      <div
        className="px-4 py-3 flex-1"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <span
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "10.5px",
              fontWeight: 600,
            }}
          >
            Available units
          </span>
          <span
            style={{
              color: "#64748B",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.06em",
            }}
          >
            12 available
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { plan: "Studio", price: "$1,495" },
            { plan: "1 BR", price: "$1,795" },
            { plan: "2 BR · 2 BA", price: "$2,395" },
          ].map((u) => (
            <div
              key={u.plan}
              className="px-2 py-2"
              style={{
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 2,
              }}
            >
              <p
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-mono)",
                  fontSize: "8.5px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {u.plan}
              </p>
              <p
                className="mt-1"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {u.price}
              </p>
              <p
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "9px",
                  marginTop: 1,
                }}
              >
                Move-in Aug
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Chatbot launcher */}
      <div
        className="absolute"
        style={{
          right: 12,
          bottom: 12,
          padding: "5px 9px",
          backgroundColor: "#2563EB",
          borderRadius: 999,
          color: "#FFFFFF",
          fontFamily: "var(--font-sans)",
          fontSize: "9.5px",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          pointerEvents: "none",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            backgroundColor: "#FFFFFF",
            borderRadius: "50%",
          }}
        />
        Chat now
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OperatorPortalPreview — KPI strip + lead source mix mockup.
// ---------------------------------------------------------------------------
function OperatorPortalPreview() {
  return (
    <div
      className="h-full w-full flex flex-col"
      style={{ backgroundColor: "#FAFBFC" }}
    >
      {/* Portal header */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              backgroundColor: "#2563EB",
              borderRadius: "50%",
            }}
          />
          <span
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "10.5px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Portfolio · Overview
          </span>
        </div>
        <span
          style={{
            color: "#64748B",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.08em",
          }}
        >
          Last sync 2m ago
        </span>
      </div>

      {/* KPI strip */}
      <div className="px-3 py-3 grid grid-cols-3 gap-2">
        {[
          { label: "Leads · 28d", v: "142", d: "+18%", up: true },
          { label: "Tours", v: "38", d: "27%", up: true },
          { label: "Apps", v: "11", d: "29%", up: false },
        ].map((k, i) => (
          <div
            key={k.label}
            className="px-2.5 py-2"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 3,
            }}
          >
            <p
              style={{
                color: "#64748B",
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {k.label}
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: i === 0 ? "20px" : "16px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {k.v}
              </span>
              <span
                style={{
                  color: k.up ? "#16A34A" : "#64748B",
                  fontFamily: "var(--font-mono)",
                  fontSize: "8.5px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  padding: "1px 4px",
                  backgroundColor: k.up
                    ? "rgba(22,163,74,0.10)"
                    : "rgba(100,116,139,0.10)",
                  borderRadius: 2,
                }}
              >
                {k.d}
              </span>
            </div>
            {/* Mini sparkline */}
            <svg
              viewBox="0 0 60 14"
              preserveAspectRatio="none"
              className="mt-1.5"
              style={{ width: "100%", height: 12 }}
              aria-hidden="true"
            >
              <polyline
                points={
                  i === 0
                    ? "0,11 10,8 20,9 30,6 40,5 50,3 60,2"
                    : i === 1
                      ? "0,9 10,9 20,7 30,6 40,8 50,5 60,4"
                      : "0,6 10,4 20,6 30,5 40,7 50,8 60,9"
                }
                fill="none"
                stroke="#2563EB"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Lead source mix bar */}
      <div className="px-3 pb-3">
        <div
          className="px-3 py-2.5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 3,
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <span
              style={{
                color: "#64748B",
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Lead source · 28d
            </span>
            <span
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              142 total
            </span>
          </div>
          <div
            className="flex h-2 w-full overflow-hidden"
            style={{ borderRadius: 1 }}
          >
            <div style={{ width: "34%", backgroundColor: "#2563EB" }} />
            <div style={{ width: "26%", backgroundColor: "#3B82F6" }} />
            <div style={{ width: "18%", backgroundColor: "#60A5FA" }} />
            <div style={{ width: "14%", backgroundColor: "#93C5FD" }} />
            <div style={{ width: "8%", backgroundColor: "#BFDBFE" }} />
          </div>
          <div className="mt-2 flex gap-3 flex-wrap">
            {[
              { l: "Google", v: "48" },
              { l: "Meta", v: "37" },
              { l: "Chatbot", v: "26" },
              { l: "Organic", v: "20" },
            ].map((row, idx) => (
              <span
                key={row.l}
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    backgroundColor:
                      idx === 0
                        ? "#2563EB"
                        : idx === 1
                          ? "#3B82F6"
                          : idx === 2
                            ? "#60A5FA"
                            : "#93C5FD",
                    borderRadius: 1,
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />
                {row.l} {row.v}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
