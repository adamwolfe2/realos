import type { Metadata } from "next";
import Link from "next/link";
import { SplitHero } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { PortfolioOccupancy } from "@/components/platform/artifacts/portfolio-occupancy";

export const metadata: Metadata = {
  title: "Residential leasing data",
  description:
    "One leasing-marketing engine for residential operators across student housing, multifamily, senior living, build-to-rent, and single-family rental.",
};

const CARDS = [
  {
    href: "/student-housing",
    title: "Student housing",
    body:
      "Pre-lease pacing, international applicants, parent co-signers. Live today on a real lease-up.",
    tag: "Live",
    accent: "#0f62fe",
  },
  {
    href: "/multifamily",
    title: "Multifamily",
    body:
      "Portfolio pacing, source-to-lease attribution, per-property retargeting.",
    tag: "Live",
    accent: "#0f62fe",
  },
  {
    href: "/senior-living",
    title: "Senior living",
    body:
      "Family-first nurture, long decision cycles, compliance-aware creative.",
    tag: "Live",
    accent: "#0f62fe",
  },
  {
    href: "/audiences",
    title: "SFR and build-to-rent",
    body:
      "Same data engine, scaled to single-asset operators and BTR portfolios.",
    tag: "Same engine",
    accent: "#0f62fe",
  },
];

export default function ResidentialHub() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Residential real estate"
        headline="Leasing data."
        headlineAccent="Every vertical."
        subhead="One data engine for student housing, multifamily, senior living, SFR, and BTR. Same pacing models, different playbooks."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Book a demo", href: "/onboarding", variant: "secondary" },
        ]}
        caption="Live today on a real lease-up. SFR and build-to-rent on the same engine."
        artifact={<PortfolioOccupancy label="Your residential portfolio" />}
      />

      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <h2
                className="mx-auto max-w-[720px]"
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                }}
              >
                Four playbooks. One data engine.
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
                    borderRadius: "2px",
                    boxShadow: "0 0 0 1px #e0e0e0",
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
                      color: "#161616",
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
                      color: "#6f6f6f",
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

      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <Reveal delay={60}>
            <h2
              className="mx-auto max-w-[760px]"
              style={{
                color: "#161616",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(26px, 3.6vw, 40px)",
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: "-0.008em",
              }}
            >
              Same channel reads, same pacing models, same weekly report. Playbook changes per vertical. Engine doesn't fork.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/sign-up" className="btn-primary">
                Request pilot
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
