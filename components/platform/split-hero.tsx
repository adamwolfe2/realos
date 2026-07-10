import React from "react";
import Link from "next/link";
import { Reveal } from "./reveal";
import { PixelSwirl } from "./pixel-swirl";
import { GlyphSwirl } from "./glyph-swirl";

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
  // When the consumer is rendering its own per-character / per-word
  // reveal (e.g. SoftBlurIn from components/ui/animate-text), skip the
  // outer Reveal wrapper for the headline so the two animations do not
  // multiply against each other.
  headlineSelfAnimated = false,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  headlineAccent?: React.ReactNode;
  subhead: React.ReactNode;
  ctas: CTA[];
  trust?: TrustItem[];
  artifact: React.ReactNode;
  caption?: string;
  headlineSelfAnimated?: boolean;
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      {/* Ambient brand-pixel background. PixelSwirl renders a gradient
          base + a faint 28px brand-blue grid + an animated field of
          ~72 pixel motes that orbit slow elliptical paths around the
          centre of the hero. Sits behind everything (pointer-events
          none, aria-hidden) so CTAs and copy remain fully interactive.
          See components/platform/pixel-swirl.tsx for the rendering
          model + reduced-motion treatment. */}
      <PixelSwirl />
      {/* GlyphSwirl (Adam 2026-05-20): scatters the same 3x3 dot-grid
          glyphs from CapabilitiesRail across the hero in a faint
          spiral. Echoes the iconography users see later in the page
          without competing with the artifact or copy. ≤6% brand-blue
          opacity, static, aria-hidden. */}
      <GlyphSwirl />
      {/* Norman feedback (2026-05-21 mobile screenshot): the previous
          pt-20 / pb-16 + gap-10 between the text column and the artifact
          left ~80px of empty white between "PILOT. NO COMMITMENT." and
          the ConfigTabs artifact on mobile. Tightened the mobile
          spacing — pt-12 / pb-10 / gap-5 — without touching the desktop
          values (md: + lg: breakpoints unchanged so the desktop layout
          keeps its breathing room). */}
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-10 pt-12 md:pt-24 pb-10 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-14 items-center">
          <div className="lg:col-span-6 text-left">
            <Reveal>
              <div className="flex items-center justify-start gap-3 mb-5">
                <span
                  aria-hidden
                  className="hidden sm:inline-block"
                  style={{
                    width: "28px",
                    height: "1px",
                    backgroundColor: "#0f62fe",
                  }}
                />
                <p
                  style={{
                    color: "#0f62fe",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {eyebrow}
                </p>
              </div>
            </Reveal>

            {(() => {
              // Norman feedback (2026-05-21, third pass): bigger H1, same
              // width + boldness. Bumped the clamp ceiling 48 → 68px and
              // the floor 32 → 38px so the headline reads with the
              // confidence of the Judgment Labs / Linear reference set
              // while keeping weight 400 and the existing tight tracking
              // (-0.035em). The vw multiplier holds the same wrap point
              // on the lg breakpoint so the line break before the blue
              // accent stays intact at typical viewports.
              const h1 = (
                <h1
                  style={{
                    color: "#161616",
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(38px, 6.4vw, 68px)",
                    fontWeight: 400,
                    lineHeight: 1.04,
                    letterSpacing: "-0.035em",
                  }}
                >
                  {headline}
                  {headlineAccent ? (
                    <>
                      {" "}
                      <span style={{ color: "#0f62fe" }}>{headlineAccent}</span>
                    </>
                  ) : null}
                </h1>
              );
              return headlineSelfAnimated ? h1 : <Reveal delay={60}>{h1}</Reveal>;
            })()}

            <Reveal delay={140}>
              <p
                className="mt-5 md:mt-7"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(15px, 4vw, 19px)",
                  lineHeight: 1.65,
                  color: "#6f6f6f",
                  fontWeight: 400,
                  maxWidth: "580px",
                }}
              >
                {subhead}
              </p>
            </Reveal>

            <Reveal delay={220}>
              <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center gap-3">
                {ctas.map((c) => (
                  <Link
                    key={c.label}
                    href={c.href}
                    className={`${c.variant === "secondary" ? "btn-secondary" : "btn-primary"} sm:w-auto`}
                    style={{ display: "flex", justifyContent: "center" }}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </Reveal>

            {trust && trust.length > 0 ? (
              <Reveal delay={300}>
                <div
                  className="mt-10 pt-6 grid grid-cols-3 sm:grid-cols-3 gap-4"
                  style={{ borderTop: "1px solid #e0e0e0", maxWidth: "560px" }}
                >
                  {trust.map((t, i) => (
                    <div
                      key={t.value}
                      className={i > 0 ? "pl-4 border-l" : ""}
                      style={i > 0 ? { borderColor: "#e0e0e0" } : undefined}
                    >
                      <p
                        style={{
                          color: "#161616",
                          fontFamily: "var(--font-display)",
                          fontSize: "clamp(17px, 4vw, 22px)",
                          fontWeight: 500,
                          lineHeight: 1.05,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {t.value}
                      </p>
                      <p
                        style={{
                          color: "#8d8d8d",
                          fontFamily: "var(--font-mono)",
                          fontSize: "clamp(8px, 2vw, 10px)",
                          lineHeight: 1.35,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
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
                  // mb-20 sm:mb-0 — keeps the caption clear of the Crisp
                  // chat launcher safe-zone on mobile (the launcher
                  // anchors bottom-right at ~50×50). Desktop spacing
                  // unchanged.
                  className="mt-4 mb-20 sm:mb-0"
                  style={{
                    color: "#8d8d8d",
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
    <section style={{ backgroundColor: background ?? "#f4f4f4" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className={`lg:col-span-6 ${textOnLeft ? "lg:order-1" : "lg:order-2"}`}>
            <Reveal>
              <p
                className="mb-4"
                style={{
                  color: "#8d8d8d",
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
                  color: "#161616",
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
                    color: "#6f6f6f",
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
                        color: "#161616",
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
                          backgroundColor: "rgba(15,98,254,0.12)",
                          color: "#0f62fe",
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
