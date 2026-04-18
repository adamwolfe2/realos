import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Residential real estate marketing",
  description:
    "Managed marketing platform for residential real estate operators across student housing, multifamily, senior living, co-living, and single-family rental.",
};

const CARDS = [
  {
    href: "/student-housing",
    title: "Student housing",
    body:
      "Sprint pricing, international applicants, turn-heavy calendars. Our wedge vertical, live today.",
    tag: "Live",
  },
  {
    href: "/multifamily",
    title: "Multifamily",
    body:
      "Portfolio-level dashboards, fair-housing compliant creative, per-property retargeting pools.",
    tag: "Live",
  },
  {
    href: "/senior-living",
    title: "Senior living",
    body:
      "Patient nurture, family-first copy, compliance-aware forms and ads.",
    tag: "Live",
  },
];

export default function ResidentialHub() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            Residential
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05] max-w-3xl"
            style={{ color: "var(--text-headline)" }}
          >
            One platform. Every residential vertical.
          </h1>
          <p
            className="mt-6 font-mono text-sm md:text-base leading-relaxed max-w-2xl"
            style={{ color: "var(--text-body)" }}
          >
            The modules are the same. The copy, the funnels, and the KPIs shift
            per audience. Pick your vertical to see the specifics.
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CARDS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group p-7 bg-white block"
                style={{
                  border: "1px solid var(--border-strong)",
                  borderRadius: "12px",
                }}
              >
                <div className="flex items-center justify-between">
                  <p
                    className="font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--blue)" }}
                  >
                    {c.tag}
                  </p>
                  <span
                    className="font-mono text-xl"
                    style={{ color: "var(--blue)" }}
                  >
                    →
                  </span>
                </div>
                <h2
                  className="font-serif text-2xl font-semibold mt-4"
                  style={{ color: "var(--text-headline)" }}
                >
                  {c.title}
                </h2>
                <p
                  className="font-mono text-xs mt-3 leading-relaxed"
                  style={{ color: "var(--text-body)" }}
                >
                  {c.body}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
