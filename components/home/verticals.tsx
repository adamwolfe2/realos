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
    stat: { l: "Avg pre-lease window", v: "8–10 mo" },
  },
  {
    href: "/multifamily",
    label: "Multifamily",
    tag: "Portfolio rollups, per-property retargeting, fair-housing-safe creative at every unit count.",
    stat: { l: "Per-property views", v: "Rollup" },
  },
  {
    href: "/senior-living",
    label: "Senior living",
    tag: "Family-first nurture sequences, patient conversion timelines, compliance-aware ad creative.",
    stat: { l: "Decision cycle", v: "3–9 mo" },
  },
  {
    href: "/commercial",
    label: "Commercial",
    tag: "Office, industrial, and retail. Broker-aware, spec-sheet driven, longer decision cycles.",
    stat: { l: "Broker-aware", v: "Yes" },
  },
];

export function Verticals() {
  return (
    <section style={{ backgroundColor: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-10 lg:gap-16 items-start">
          {/* Left column — editorial header */}
          <div>
            <p className="eyebrow mb-4">Same platform, tailored</p>
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
              Built around how your market actually works.
            </h2>
            <p
              className="mt-4 max-w-md"
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                lineHeight: 1.55,
              }}
            >
              The platform is one product. The intelligence layer adapts to
              the rhythm, compliance shape, and signal pattern of each
              vertical we serve.
            </p>
          </div>

          {/* Right column — editorial list, hairline-separated */}
          <ol
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {VERTICALS.map((v, i) => (
              <li
                key={v.href}
                style={{ borderTop: i === 0 ? "none" : "1px solid #E2E8F0" }}
              >
                <Link
                  href={v.href}
                  className="group flex items-center justify-between gap-4 px-5 py-5 md:py-6 hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <h3
                        style={{
                          color: "#1E2A3A",
                          fontFamily: "var(--font-sans)",
                          fontSize: "clamp(18px, 1.9vw, 22px)",
                          fontWeight: 700,
                          letterSpacing: "-0.015em",
                          lineHeight: 1.2,
                        }}
                      >
                        {v.label}
                      </h3>
                      {v.primary ? (
                        <span
                          style={{
                            color: "#2563EB",
                            fontFamily: "var(--font-mono)",
                            fontSize: "9.5px",
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            padding: "2px 7px",
                            backgroundColor: "rgba(37,99,235,0.10)",
                            borderRadius: 2,
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
                        fontSize: "14px",
                        lineHeight: 1.5,
                        maxWidth: "520px",
                      }}
                    >
                      {v.tag}
                    </p>
                  </div>
                  {/* Small stat chip + arrow on the right */}
                  <div className="hidden sm:flex flex-col items-end shrink-0 gap-2">
                    <span
                      style={{
                        color: "#64748B",
                        fontFamily: "var(--font-mono)",
                        fontSize: "9px",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {v.stat.l}
                    </span>
                    <span
                      style={{
                        color: "#1E2A3A",
                        fontFamily: "var(--font-mono)",
                        fontSize: "13px",
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {v.stat.v}
                    </span>
                  </div>
                  <span
                    className="shrink-0 inline-flex items-center justify-center transition-transform group-hover:translate-x-1"
                    style={{
                      width: 24,
                      height: 24,
                      color: "#94A3B8",
                    }}
                    aria-hidden="true"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3.5 8h9m0 0L8.5 4m4 4l-4 4"
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
