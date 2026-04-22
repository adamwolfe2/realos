import Link from "next/link";

const VERTICALS = [
  {
    href: "/student-housing",
    label: "Student housing",
    tag: "Pre-lease cycles, parent decision-makers, campus-proximity plays.",
  },
  {
    href: "/multifamily",
    label: "Multifamily",
    tag: "Portfolio rollups, per-property retargeting, fair-housing-safe creative.",
  },
  {
    href: "/senior-living",
    label: "Senior living",
    tag: "Family-first nurture, patient conversion, compliance-aware forms.",
  },
  {
    href: "/commercial",
    label: "Commercial",
    tag: "Office, industrial, retail. Broker-aware, spec-sheet driven. Coming soon.",
  },
];

export function Verticals() {
  return (
    <section style={{ backgroundColor: "#f5f4ed", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-14">
          <p className="eyebrow mb-4">Same platform, tailored</p>
          <h2
            style={{
              color: "#141413",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.2vw, 42px)",
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
            }}
          >
            Built for the way your vertical actually operates.
          </h2>
        </div>
        <div
          className="md:grid md:grid-cols-2 gap-3 flex overflow-x-auto md:overflow-visible pb-3 md:pb-0"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {VERTICALS.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className="group flex-shrink-0 md:flex-shrink block p-6 md:p-7"
              style={{
                scrollSnapAlign: "start",
                width: "82vw",
                maxWidth: "360px",
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 0 0 1px #f0eee6",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    style={{
                      color: "#141413",
                      fontFamily: "var(--font-sans)",
                      fontSize: "22px",
                      fontWeight: 600,
                      lineHeight: 1.25,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {v.label}
                  </h3>
                  <p
                    className="mt-3 max-w-md"
                    style={{
                      color: "#5e5d59",
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      lineHeight: 1.6,
                    }}
                  >
                    {v.tag}
                  </p>
                </div>
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    color: "#5e5d59",
                    boxShadow: "0 0 0 1px #e8e6dc",
                  }}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
