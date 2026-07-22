import Link from "next/link";
import React from "react";
import { SplitHero } from "./split-hero";
import { Reveal } from "./reveal";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { getBookDemoHref } from "@/lib/marketing/book-demo";

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
  // "Book a demo" (secondary) routes through the centralized book-demo
  // resolver (NEXT_PUBLIC_CAL_BOOK_URL → Cal.com link when set,
  // /onboarding fallback). Per-vertical pages can still pass an
  // explicit ctaHref when they want a non-default landing.
  ctaHref = getBookDemoHref(),
  artifact,
  painsHeading = "The three things that made them look.",
  modulesHeading = "Six modules. One launch. Live in two weeks.",
  caption,
}: VerticalLandingProps) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow={eyebrow}
        headline={headline}
        headlineAccent={headlineAccent}
        subhead={subhead}
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Book a demo", href: ctaHref, variant: "secondary" },
        ]}
        caption={caption}
        artifact={artifact}
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
                    borderRadius: "2px",
                    boxShadow: "0 0 0 1px #e0e0e0",
                    transition: "transform 260ms ease, box-shadow 260ms ease",
                  }}
                >
                  <h3
                    style={{
                      color: "#161616",
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
                      color: "#6f6f6f",
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

      <section style={{ backgroundColor: "#FFFFFF" }}>
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
                    backgroundColor: "#f4f4f4",
                    borderRadius: "2px",
                    boxShadow: "0 0 0 1px #e0e0e0",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="flex-shrink-0 inline-flex items-center justify-center"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "2px",
                      backgroundColor: "rgba(15,98,254,0.12)",
                      color: "#0f62fe",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2 9l3.5 3.5L12 4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div className="flex-1">
                    <h3
                      style={{
                        color: "#161616",
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
                        color: "#6f6f6f",
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

      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-24 md:py-28 text-center">
          <Reveal delay={60}>
            <h2
              className="mx-auto max-w-[760px]"
              style={{
                color: "#161616",
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
                color: "#6f6f6f",
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
              <Link href="/sign-up" className="btn-primary">
                Request pilot
              </Link>
              <BookDemoLink className="btn-secondary">
                Book a demo
              </BookDemoLink>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
