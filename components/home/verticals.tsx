import Link from "next/link";

// ---------------------------------------------------------------------------
// Verticals — editorial rewrite (matches the new home rhythm).
//
// Was: 2x2 card-grid with bordered tiles and a circular arrow chip.
// Now: editorial split layout. Section headline + intro on the left, four
// vertical entries listed as horizontal rows on the right. Each row is
// label · tagline · arrow. Hairline rule between rows. Reads as a
// confident "we cover these four markets" assertion, not a brochure.
// ---------------------------------------------------------------------------

const VERTICALS = [
  {
    href: "/student-housing",
    label: "Student housing",
    tag: "Pre-lease cycles, parent co-signers, campus-proximity targeting. Built around the academic calendar.",
    primary: true,
  },
  {
    href: "/multifamily",
    label: "Multifamily",
    tag: "Portfolio rollups, per-property retargeting, fair-housing-safe creative at every unit count.",
  },
  {
    href: "/senior-living",
    label: "Senior living",
    tag: "Family-first nurture sequences, patient conversion timelines, compliance-aware ad creative.",
  },
  {
    href: "/commercial",
    label: "Commercial",
    tag: "Office, industrial, and retail. Broker-aware, spec-sheet driven, longer decision cycles.",
  },
];

export function Verticals() {
  return (
    <section style={{ backgroundColor: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-12 lg:gap-20 items-start">
          {/* Left column — editorial header */}
          <div>
            <p className="eyebrow mb-4">Same platform, tailored</p>
            <h2
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(34px, 4.4vw, 52px)",
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.025em",
              }}
            >
              Built around how your market actually works.
            </h2>
            <p
              className="mt-6 max-w-md"
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "16.5px",
                lineHeight: 1.6,
              }}
            >
              The platform is one product. The intelligence layer adapts to
              the rhythm, compliance shape, and signal pattern of each
              vertical we serve.
            </p>
          </div>

          {/* Right column — editorial list, hairline-separated */}
          <ol>
            {VERTICALS.map((v, i) => (
              <li key={v.href} style={{ borderTop: i === 0 ? "none" : "1px solid #E2E8F0" }}>
                <Link
                  href={v.href}
                  className="group flex items-start justify-between gap-6 py-7 md:py-8"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3
                        style={{
                          color: "#1E2A3A",
                          fontFamily: "var(--font-sans)",
                          fontSize: "clamp(22px, 2.4vw, 28px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        {v.label}
                      </h3>
                      {v.primary ? (
                        <span
                          style={{
                            color: "#2563EB",
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            padding: "3px 8px",
                            backgroundColor: "rgba(37,99,235,0.10)",
                            borderRadius: 3,
                          }}
                        >
                          Primary ICP
                        </span>
                      ) : null}
                    </div>
                    <p
                      style={{
                        color: "#64748B",
                        fontFamily: "var(--font-sans)",
                        fontSize: "15.5px",
                        lineHeight: 1.6,
                        maxWidth: "520px",
                      }}
                    >
                      {v.tag}
                    </p>
                  </div>
                  <span
                    className="shrink-0 mt-1 inline-flex items-center justify-center transition-transform group-hover:translate-x-1"
                    style={{
                      width: 32,
                      height: 32,
                      color: "#64748B",
                    }}
                    aria-hidden="true"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M4 9h10m0 0L9.5 4.5M14 9l-4.5 4.5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
