import React from "react";
import Link from "next/link";
import { Reveal } from "./reveal";

type CTA = { label: string; href: string; variant?: "primary" | "secondary" };

type TrustItem = { value: string; label: string };

export function SplitHero({
  eyebrow,
  headline,
  headlineAccent,
  subhead,
  ctas,
  trust,
  artifact,
  caption,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  headlineAccent?: React.ReactNode;
  subhead: React.ReactNode;
  ctas: CTA[];
  trust?: TrustItem[];
  artifact: React.ReactNode;
  caption?: string;
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "#f5f4ed" }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 pt-20 md:pt-24 pb-16 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6">
            <Reveal>
              <div className="flex items-center gap-3 mb-5">
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: "28px",
                    height: "1px",
                    backgroundColor: "#2F6FE5",
                  }}
                />
                <p
                  style={{
                    color: "#2F6FE5",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {eyebrow}
                </p>
              </div>
            </Reveal>

            <Reveal delay={60}>
              <h1
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(38px, 4.8vw, 60px)",
                  fontWeight: 500,
                  lineHeight: 1.06,
                  letterSpacing: "-0.012em",
                }}
              >
                {headline}
                {headlineAccent ? (
                  <>
                    {" "}
                    <span style={{ color: "#2F6FE5" }}>{headlineAccent}</span>
                  </>
                ) : null}
              </h1>
            </Reveal>

            <Reveal delay={140}>
              <p
                className="mt-7"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "19px",
                  lineHeight: 1.65,
                  color: "#5e5d59",
                  fontWeight: 400,
                  maxWidth: "580px",
                }}
              >
                {subhead}
              </p>
            </Reveal>

            <Reveal delay={220}>
              <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {ctas.map((c) => (
                  <Link
                    key={c.label}
                    href={c.href}
                    className={c.variant === "secondary" ? "btn-secondary" : "btn-primary"}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </Reveal>

            {trust && trust.length > 0 ? (
              <Reveal delay={300}>
                <div
                  className="mt-10 pt-6 grid grid-cols-3 gap-4"
                  style={{ borderTop: "1px solid #e8e6dc", maxWidth: "560px" }}
                >
                  {trust.map((t, i) => (
                    <div
                      key={t.value}
                      style={{
                        borderLeft: i > 0 ? "1px solid #e8e6dc" : "none",
                        paddingLeft: i > 0 ? "16px" : 0,
                      }}
                    >
                      <p
                        style={{
                          color: "#141413",
                          fontFamily: "var(--font-display)",
                          fontSize: "22px",
                          fontWeight: 500,
                          lineHeight: 1.05,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {t.value}
                      </p>
                      <p
                        style={{
                          color: "#87867f",
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          lineHeight: 1.4,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          fontWeight: 500,
                          marginTop: "4px",
                        }}
                      >
                        {t.label}
                      </p>
                    </div>
                  ))}
                </div>
              </Reveal>
            ) : null}

            {caption ? (
              <Reveal delay={360}>
                <p
                  className="mt-4"
                  style={{
                    color: "#87867f",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                  }}
                >
                  {caption}
                </p>
              </Reveal>
            ) : null}
          </div>

          <div className="lg:col-span-6">
            <Reveal delay={180} y={24}>
              {artifact}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SplitSection({
  eyebrow,
  headline,
  body,
  bullets,
  artifact,
  side = "right",
  background,
}: {
  eyebrow: string;
  headline: string;
  body?: string;
  bullets?: string[];
  artifact: React.ReactNode;
  side?: "left" | "right";
  background?: string;
}) {
  const textOnLeft = side === "right";
  return (
    <section style={{ backgroundColor: background ?? "#faf9f5" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className={`lg:col-span-6 ${textOnLeft ? "lg:order-1" : "lg:order-2"}`}>
            <Reveal>
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
                {eyebrow}
              </p>
            </Reveal>

            <Reveal delay={60}>
              <h2
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.6vw, 42px)",
                  fontWeight: 500,
                  lineHeight: 1.1,
                  letterSpacing: "-0.005em",
                }}
              >
                {headline}
              </h2>
            </Reveal>

            {body ? (
              <Reveal delay={140}>
                <p
                  className="mt-5"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "17px",
                    lineHeight: 1.65,
                    color: "#5e5d59",
                    maxWidth: "540px",
                  }}
                >
                  {body}
                </p>
              </Reveal>
            ) : null}

            {bullets && bullets.length > 0 ? (
              <ul className="mt-6 space-y-3">
                {bullets.map((b, i) => (
                  <Reveal key={b} delay={200 + i * 60}>
                    <li
                      className="flex items-start gap-3"
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "15.5px",
                        color: "#141413",
                        lineHeight: 1.55,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="inline-flex items-center justify-center flex-shrink-0 mt-1"
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(47,111,229,0.12)",
                          color: "#2F6FE5",
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{b}</span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={`lg:col-span-6 ${textOnLeft ? "lg:order-2" : "lg:order-1"}`}>
            <Reveal delay={180} y={24}>
              {artifact}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
