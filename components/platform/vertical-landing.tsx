import Link from "next/link";
import React from "react";
import { SplitHero } from "./split-hero";
import { Reveal } from "./reveal";

export type VerticalLandingProps = {
  eyebrow: string;
  headline: string;
  headlineAccent?: string;
  subhead: string;
  pains: Array<{ title: string; body: string }>;
  modules: Array<{ title: string; body: string }>;
  caseStudy?: { client: string; stat: string; body: string };
  ctaHref?: string;
  artifact: React.ReactNode;
  painsHeading?: string;
  modulesHeading?: string;
  caption?: string;
};

export function VerticalLanding({
  eyebrow,
  headline,
  headlineAccent,
  subhead,
  pains,
  modules,
  ctaHref = "/onboarding",
  artifact,
  painsHeading = "The three things that made them look.",
  modulesHeading = "Six modules. One launch. Live in two weeks.",
  caption,
}: VerticalLandingProps) {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <SplitHero
        eyebrow={eyebrow}
        headline={headline}
        headlineAccent={headlineAccent}
        subhead={subhead}
        ctas={[
          { label: "Book a demo", href: ctaHref },
          { label: "See it live", href: "/#live", variant: "secondary" },
        ]}
        caption={caption}
        artifact={artifact}
      />

      <section style={{ backgroundColor: "#faf9f5" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p
                className="mb-4"
                style={{
                  color: "#87867f",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                Operators tell us
              </p>
              <h2
                className="mx-auto max-w-[720px]"
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                }}
              >
                {painsHeading}
              </h2>
            </div>
          </Reveal>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pains.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <li
                  className="p-7 h-full"
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "16px",
                    boxShadow: "0 0 0 1px #f0eee6",
                    transition: "transform 260ms ease, box-shadow 260ms ease",
                  }}
                >
                  <span
                    style={{
                      color: "#2563EB",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      letterSpacing: "0.14em",
                      fontWeight: 600,
                    }}
                  >
                    0{i + 1}
                  </span>
                  <h3
                    className="mt-4"
                    style={{
                      color: "#141413",
                      fontFamily: "var(--font-display)",
                      fontSize: "20px",
                      fontWeight: 500,
                      lineHeight: 1.25,
                    }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="mt-3"
                    style={{
                      color: "#5e5d59",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14.5px",
                      lineHeight: 1.6,
                    }}
                  >
                    {p.body}
                  </p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ backgroundColor: "#f5f4ed" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p
                className="mb-4"
                style={{
                  color: "#87867f",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                What you get on day one
              </p>
              <h2
                className="mx-auto max-w-[720px]"
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                }}
              >
                {modulesHeading}
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((m, i) => (
              <Reveal key={m.title} delay={i * 60}>
                <div
                  className="p-7 h-full flex gap-4"
                  style={{
                    backgroundColor: "#faf9f5",
                    borderRadius: "16px",
                    boxShadow: "0 0 0 1px #f0eee6",
                  }}
                >
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(37,99,235,0.12)",
                      color: "#2563EB",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    0{i + 1}
                  </span>
                  <div className="flex-1">
                    <h3
                      style={{
                        color: "#141413",
                        fontFamily: "var(--font-display)",
                        fontSize: "19px",
                        fontWeight: 500,
                        lineHeight: 1.25,
                      }}
                    >
                      {m.title}
                    </h3>
                    <p
                      className="mt-2"
                      style={{
                        color: "#5e5d59",
                        fontFamily: "var(--font-sans)",
                        fontSize: "14.5px",
                        lineHeight: 1.6,
                      }}
                    >
                      {m.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-24 md:py-28 text-center">
          <Reveal>
            <p
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: "16px",
              }}
            >
              One platform
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h2
              className="mx-auto max-w-[760px]"
              style={{
                color: "#141413",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(30px, 3.8vw, 44px)",
                fontWeight: 500,
                lineHeight: 1.12,
                letterSpacing: "-0.008em",
              }}
            >
              The same modules every operator gets. The playbook is what changes.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p
              className="mx-auto mt-5 max-w-[620px]"
              style={{
                color: "#5e5d59",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                lineHeight: 1.6,
              }}
            >
              Same site engine, same pixel, same chatbot, same ad studio.
              Different intake playbook, different creative library, different
              compliance guardrails per vertical.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={ctaHref} className="btn-primary">
                Book a demo
              </Link>
              <Link href="/#live" className="btn-secondary">
                See it live
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
