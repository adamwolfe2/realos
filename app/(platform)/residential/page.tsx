import type { Metadata } from "next";
import Link from "next/link";
import { SplitHero } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { PortfolioOccupancy } from "@/components/platform/artifacts/portfolio-occupancy";

export const metadata: Metadata = {
  title: "Residential leasing intelligence",
  description:
    "Leasing intelligence platform for residential operators across student housing, multifamily, senior living, build-to-rent, and single-family rental.",
};

const CARDS = [
  {
    href: "/student-housing",
    title: "Student housing",
    body:
      "Sprint pricing, international applicants, turn-heavy calendars. Live today on a real lease-up.",
    tag: "Live",
    accent: "#2563EB",
  },
  {
    href: "/multifamily",
    title: "Multifamily",
    body:
      "Portfolio-level pacing reads, source-to-lease attribution, per-property recommendations.",
    tag: "Live",
    accent: "#2563EB",
  },
  {
    href: "/senior-living",
    title: "Senior living",
    body:
      "Family-first inquiry handling, longer-cycle pacing models, compliance-aware forms.",
    tag: "Live",
    accent: "#2563EB",
  },
  {
    href: "/audiences",
    title: "SFR and build-to-rent",
    body:
      "For single-asset operators and BTR portfolios. Same data engine, scaled to single-asset operators.",
    tag: "Live",
    accent: "#2563EB",
  },
];

export default function ResidentialHub() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <SplitHero
        eyebrow="Residential real estate"
        headline="Your leasing data."
        headlineAccent="Working for you."
        subhead="One data engine across every residential vertical. The pacing models, the source-to-lease read, and the operator-written weekly note are the same. The KPIs and the compliance guardrails shift per audience. Pick your vertical to see the specifics, or keep scrolling for the rollup."
        ctas={[
          { label: "Start the free pilot", href: "/onboarding" },
          { label: "See it on a live property", href: "/demo", variant: "secondary" },
        ]}
        caption="Live today at Telegraph Commons. SFR and build-to-rent on the same engine."
        artifact={<PortfolioOccupancy label="Your residential portfolio" />}
      />

      <section style={{ backgroundColor: "#F1F5F9" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p
                className="mb-4"
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                Pick your vertical
              </p>
              <h2
                className="mx-auto max-w-[720px]"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                }}
              >
                Different playbooks. Same data engine underneath.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CARDS.map((c, i) => (
              <Reveal key={c.href} delay={i * 80}>
                <Link
                  href={c.href}
                  className="group block p-7 h-full relative"
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "16px",
                    boxShadow: "0 0 0 1px #E2E8F0",
                    transition: "transform 260ms ease, box-shadow 260ms ease",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        color: c.accent,
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                      }}
                    >
                      {c.tag}
                    </span>
                    <span
                      style={{
                        color: c.accent,
                        fontFamily: "var(--font-mono)",
                        fontSize: "18px",
                        transition: "transform 260ms ease",
                      }}
                      className="group-hover:translate-x-1 inline-block"
                    >
                      →
                    </span>
                  </div>
                  <h3
                    className="mt-5"
                    style={{
                      color: "#1E2A3A",
                      fontFamily: "var(--font-display)",
                      fontSize: "24px",
                      fontWeight: 500,
                      lineHeight: 1.2,
                    }}
                  >
                    {c.title}
                  </h3>
                  <p
                    className="mt-3"
                    style={{
                      color: "#64748B",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14.5px",
                      lineHeight: 1.6,
                    }}
                  >
                    {c.body}
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <Reveal>
            <p
              className="mb-6"
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              One codebase
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h2
              className="mx-auto max-w-[760px]"
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(26px, 3.6vw, 40px)",
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: "-0.008em",
              }}
            >
              Same channel reads, same pacing models, same operator-written weekly note. The playbook changes per vertical. The data engine does not fork.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/onboarding" className="btn-primary">
                Start the free pilot
              </Link>
              <Link href="/commercial" className="btn-secondary">
                Commercial roadmap
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
