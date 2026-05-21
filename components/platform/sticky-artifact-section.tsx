"use client";

import React from "react";
import { Reveal } from "./reveal";

// ---------------------------------------------------------------------------
// StickyArtifactSection — the "Sanity check before you ship" pattern
// borrowed from Judgment Labs' marketing site (Norman feedback 2026-05-21).
//
// Layout:
//   ┌───────────────────────────┬──────────────────────────────────────┐
//   │  TEXT COLUMN              │  ARTIFACT COLUMN                     │
//   │  (left, narrow, sticks)   │  (right, wider, scrolls past)        │
//   │  - mono eyebrow           │  - whatever product mockup the       │
//   │  - section title          │    section is selling                │
//   │  - body paragraph         │                                       │
//   │  - optional CTA           │                                       │
//   └───────────────────────────┴──────────────────────────────────────┘
//
// Behaviour:
//   - On desktop (md+), the text column uses `position: sticky` so it
//     hangs in the viewport while the operator scrolls past the artifact.
//     This is what makes the Judgment surface feel calm — the reader's
//     eye doesn't have to chase the heading.
//   - On mobile, both columns stack and the sticky behaviour disengages
//     so the reading flow stays linear. Tightened mobile gap matches the
//     fix we shipped for SplitHero (Norman 2026-05-21 mobile screenshot).
//
// Typography uses the new Judgment-style classes from globals.css:
//   - eyebrow-mono   (DM-Mono-ish: 11px, 0.06em tracking, uppercase)
//   - heading-clean  (28-32px, weight 400, -0.84/-1.12px tracking)
//   - body-clean     (16-18px, weight 400, generous line-height)
// ---------------------------------------------------------------------------

export type StickyArtifactSectionProps = {
  /** Mono uppercase tag above the section title. */
  eyebrow?: string;
  /** Plain string OR JSX (so callers can embed an accent span / animated reveal). */
  title: React.ReactNode;
  /** Optional sub-paragraph under the title, same calm tone as Judgment. */
  body?: React.ReactNode;
  /** Optional list of bullet points beneath the body, rendered as a small mono list. */
  bullets?: string[];
  /** Optional call-to-action rendered below the bullets. */
  cta?: { label: string; href: string };
  /**
   * The right-side artifact. Anything — a product mockup card, a chart,
   * a list of recent items, an iframe. The component just gives it the
   * scrolling column.
   */
  artifact: React.ReactNode;
  /** Surface tone, "light" (default, white) or "muted" (#FAFBFF wash). */
  surface?: "light" | "muted";
  /**
   * Side to place the text column on. Default "left" matches the Judgment
   * surface; "right" mirrors the layout for visual rhythm across a page.
   */
  textSide?: "left" | "right";
};

export function StickyArtifactSection({
  eyebrow,
  title,
  body,
  bullets,
  cta,
  artifact,
  surface = "light",
  textSide = "left",
}: StickyArtifactSectionProps) {
  const bg = surface === "muted" ? "#FAFBFF" : "#FFFFFF";

  const TextColumn = (
    <div className="lg:sticky lg:top-24 self-start">
      <Reveal>
        {eyebrow ? (
          <p className="eyebrow-mono mb-5" style={{ color: "#2563EB" }}>
            {eyebrow}
          </p>
        ) : null}
      </Reveal>
      <Reveal delay={60}>
        <h2 className="heading-clean text-[#1E2A3A]">{title}</h2>
      </Reveal>
      {body ? (
        <Reveal delay={140}>
          <p className="body-clean mt-5 text-[#64748B] max-w-[44ch]">{body}</p>
        </Reveal>
      ) : null}
      {bullets && bullets.length > 0 ? (
        <Reveal delay={200}>
          <ul className="mt-6 space-y-2.5">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2.5 text-[14px] leading-[1.55] text-[#1E2A3A]"
              >
                <span
                  aria-hidden="true"
                  className="inline-block mt-[7px] h-[5px] w-[5px] rounded-sm shrink-0"
                  style={{ backgroundColor: "#2563EB" }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}
      {cta ? (
        <Reveal delay={260}>
          <a
            href={cta.href}
            className="mt-7 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#2563EB] hover:underline"
            style={{ letterSpacing: "-0.005em" }}
          >
            {cta.label}
            <span aria-hidden="true">→</span>
          </a>
        </Reveal>
      ) : null}
    </div>
  );

  const ArtifactColumn = (
    <div className="min-w-0">
      <Reveal delay={180} y={24}>
        {artifact}
      </Reveal>
    </div>
  );

  return (
    <section
      style={{ backgroundColor: bg }}
      className="border-t border-[#F1F5F9]"
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-16 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-8 lg:gap-16 items-start">
          {textSide === "left" ? (
            <>
              {TextColumn}
              {ArtifactColumn}
            </>
          ) : (
            <>
              <div className="lg:order-2">{TextColumn}</div>
              <div className="lg:order-1">{ArtifactColumn}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
