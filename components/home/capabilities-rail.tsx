"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WeeklyReport } from "@/components/platform/artifacts/weekly-report";
import { AttributionBreakdown } from "@/components/platform/artifacts/attribution-breakdown";
import { VisitorStream } from "@/components/platform/artifacts/visitor-stream";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";
import { PacingAlert } from "@/components/platform/artifacts/pacing-alert";
import { SeoAnswer } from "@/components/platform/artifacts/seo-answer";
import { MaskRevealUp } from "@/components/ui/animate-text";

// ---------------------------------------------------------------------------
// CapabilitiesRail — the homepage's product story, told as scrollytelling.
//
// Pattern: left column scrolls a numbered list of six capabilities, right
// column is position: sticky and crossfades between six live artifacts as
// the active capability changes. Replaces WhatYouGet + LandingModules +
// Numbers on the homepage — those three sections all wanted to show "what
// the platform does" without ever showing the product. This shows it.
//
// Activation: IntersectionObserver on each list item. When an item's
// midpoint crosses the viewport's upper third, it becomes active. Smooth
// 240ms opacity + translateY crossfade on artifact swap. Respects
// prefers-reduced-motion (instant swap, no fade).
//
// Mobile: sticky pattern doesn't work below 1024px. Below that breakpoint
// the rail collapses to a vertical sequence — capability + artifact pair
// stacked, no sticky positioning. Reads as a normal scrollable list of
// six feature blocks.
// ---------------------------------------------------------------------------

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";

type Capability = {
  num: string;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  artifact: React.ComponentType;
  /** Pixel-icon glyph rendered next to the title. Matches the reference
   *  inspiration: small clustered squares that fill in on the active row. */
  glyph: "report" | "attribution" | "pixel" | "chat" | "alert" | "search";
};

const CAPABILITIES: Capability[] = [
  {
    num: "01",
    title: "Your weekly report writes itself",
    body: "Every Monday at 7am: leases attributed to source, pacing vs. last cycle, anomalies flagged, and the three actions to take this week. One page, readable over coffee.",
    href: "/features/seo-aeo",
    linkLabel: "See a sample report",
    artifact: WeeklyReport,
    glyph: "report",
  },
  {
    num: "02",
    title: "Spend tracked all the way to the lease",
    body: "Every dollar of Google, Meta, and TikTok spend mapped to a signed lease, not an impression. Blended CAC and per-channel ROI calculated continuously.",
    href: "/features/ads",
    linkLabel: "See it live",
    artifact: AttributionBreakdown,
    glyph: "attribution",
  },
  {
    num: "03",
    title: "Know who visited your site",
    body: "Not just how many. Names and emails on a meaningful share of your anonymous traffic, resolved in real time, routed to your CRM and your ad audiences.",
    href: "/features/pixel",
    linkLabel: "See the pixel firing",
    artifact: VisitorStream,
    glyph: "pixel",
  },
  {
    num: "04",
    title: "An assistant that captures leads at 2am",
    body: "Trained on your units, pricing rules, and application process. Books tours, emails floor plans, captures contact info. Hot leads land with your team the next morning, thread attached.",
    href: "/features/chatbot",
    linkLabel: "Try a conversation",
    artifact: ChatDemo,
    glyph: "chat",
  },
  {
    num: "05",
    title: "Pacing alerts before occupancy slips",
    body: "Lease-up cadence compared continuously against last cycle. Anomalies surface four to eight weeks before the gap shows up in physical occupancy. Time to fix it, not explain it.",
    href: "/features/seo-aeo",
    linkLabel: "See an alert",
    artifact: PacingAlert,
    glyph: "alert",
  },
  {
    num: "06",
    title: "Pages quoted by AI search",
    body: "Property pages written to rank in Google and to be cited by ChatGPT, Perplexity, Claude, and Gemini. Per-location coverage, refreshed weekly.",
    href: "/features/seo-aeo",
    linkLabel: "Watch a citation",
    artifact: SeoAnswer,
    glyph: "search",
  },
];

export function CapabilitiesRail() {
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  // Respect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // IntersectionObserver to sync the active capability to scroll position.
  // Anchor: upper-third of the viewport. When an item's midpoint enters
  // that zone, it becomes active.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry closest to the activation line that's intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            const aDist = Math.abs(a.boundingClientRect.top);
            const bDist = Math.abs(b.boundingClientRect.top);
            return aDist - bDist;
          });
        if (visible.length === 0) return;
        const idx = itemRefs.current.findIndex((el) => el === visible[0].target);
        if (idx >= 0) setActive(idx);
      },
      {
        // Activation band: top 10% → top 50% of viewport.
        rootMargin: "-10% 0% -50% 0%",
        threshold: 0,
      },
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-16 md:py-24">
        {/* Section header */}
        <div className="max-w-3xl mb-12 md:mb-20">
          <p
            style={{
              color: ACCENT,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
            className="mb-4"
          >
            Capabilities
          </p>
          <h2
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(32px, 4.4vw, 56px)",
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-0.028em",
            }}
          >
            {/* Per-line "Mask Reveal Up" — pixel-point/animate-text spec
                `mask-reveal-up.json`. 760ms, 90ms line stagger, y 30→0,
                blur 6→0, ease 0.22,1,0.36,1. */}
            <MaskRevealUp lines={["Six surfaces.", "One platform."]} />
          </h2>
          <p
            className="mt-5 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              lineHeight: 1.55,
            }}
          >
            Each one targets a specific failure mode of the current marketing stack. All six run on your existing PMS, your existing domain, and your existing team.
          </p>
        </div>

        {/* Desktop: scrollytelling layout. Mobile: stacked. */}
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-10 lg:gap-16 items-start">
          {/* Left rail — capability list */}
          <ol className="lg:pt-2">
            {CAPABILITIES.map((cap, i) => (
              <li
                key={cap.num}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="py-8 md:py-12 first:pt-0"
                style={{
                  borderBottom: i < CAPABILITIES.length - 1 ? `1px solid ${BORDER}` : "none",
                }}
              >
                {/* Mobile: artifact stacked above text */}
                <div className="lg:hidden mb-6">
                  <cap.artifact />
                </div>

                <div className="flex items-start gap-4">
                  <CapabilityGlyph
                    type={cap.glyph}
                    active={i === active}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11.5,
                          color: i === active ? ACCENT : MUTED,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          transition: "color 240ms ease",
                        }}
                      >
                        {cap.num}
                      </span>
                      <h3
                        style={{
                          color: INK,
                          fontFamily: "var(--font-sans)",
                          fontSize: "clamp(18px, 2vw, 22px)",
                          fontWeight: 700,
                          letterSpacing: "-0.015em",
                          lineHeight: 1.25,
                        }}
                      >
                        {cap.title}
                      </h3>
                    </div>
                    <p
                      className="mt-3 max-w-[560px]"
                      style={{
                        color: "#64748B",
                        fontFamily: "var(--font-sans)",
                        fontSize: 15,
                        lineHeight: 1.6,
                      }}
                    >
                      {cap.body}
                    </p>
                    <Link
                      href={cap.href}
                      className="mt-4 inline-flex items-center gap-1.5 group"
                      style={{
                        color: ACCENT,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      {cap.linkLabel}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="transition-transform group-hover:translate-x-1"
                      >
                        <path
                          d="M2 6h7m0 0L6 3m3 3L6 9"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Right rail — sticky artifact slot (desktop only).
              `lg:self-stretch` overrides the grid container's `items-start`
              alignment for this cell only, so the wrapper fills the full
              row track height. Without it, this column shrinks to ~480px
              (its content height) and `position: sticky` has no room to
              stick — the artifact scrolls off the top with its parent.
              The left <ol> keeps its natural top-aligned layout because
              its first <li> renders at the top of the cell either way. */}
          <div className="hidden lg:block lg:self-stretch lg:h-full">
            <div
              className="sticky"
              style={{ top: 96 }}
            >
              <div className="relative" style={{ minHeight: 480 }}>
                {CAPABILITIES.map((cap, i) => {
                  const Artifact = cap.artifact;
                  const isActive = i === active;
                  return (
                    <div
                      key={cap.num}
                      aria-hidden={!isActive}
                      style={{
                        position: i === 0 ? "relative" : "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        opacity: isActive ? 1 : 0,
                        transform: reducedMotion
                          ? "none"
                          : `translateY(${isActive ? 0 : 12}px)`,
                        transition: reducedMotion
                          ? "opacity 0ms"
                          : "opacity 320ms cubic-bezier(.2,.7,.2,1), transform 320ms cubic-bezier(.2,.7,.2,1)",
                        pointerEvents: isActive ? "auto" : "none",
                      }}
                    >
                      <Artifact />
                    </div>
                  );
                })}
              </div>

              {/* Progress dots — small ambient indicator that you're moving
                  through six surfaces, not one infinite scroll. */}
              <div className="mt-6 flex items-center justify-center gap-2">
                {CAPABILITIES.map((cap, i) => (
                  <span
                    key={cap.num}
                    aria-hidden
                    style={{
                      width: i === active ? 18 : 6,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: i === active ? ACCENT : BORDER,
                      transition: "all 240ms ease",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CapabilityGlyph — small pixel-grid icon next to each capability title.
//
// Inspired by the reference image's clustered-square glyphs. Six distinct
// 3x3 patterns, one per capability. Each glyph is muted (#E2E8F0) by
// default and fills to cobalt when its capability is active. The shape
// hints at the capability without being a literal icon — patterns of dots
// that read as "data", "channels", "stream", "messages", "alert",
// "search".
// ---------------------------------------------------------------------------

const GLYPHS: Record<Capability["glyph"], number[][]> = {
  // 3x3 grids — 1 = filled, 0 = empty. Each shape has a "weight" that
  // visually echoes the capability.
  report: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  attribution: [
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
  pixel: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
  ],
  chat: [
    [1, 1, 1],
    [1, 1, 0],
    [0, 1, 0],
  ],
  alert: [
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
  ],
  search: [
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
  ],
};

function CapabilityGlyph({
  type,
  active,
}: {
  type: Capability["glyph"];
  active: boolean;
}) {
  const grid = GLYPHS[type];
  const cell = 4;
  const gap = 2;
  return (
    <div
      aria-hidden
      className="flex-shrink-0 grid grid-cols-3 gap-[2px] mt-1.5"
      style={{
        width: cell * 3 + gap * 2,
        height: cell * 3 + gap * 2,
      }}
    >
      {grid.flat().map((on, i) => (
        <span
          key={i}
          style={{
            width: cell,
            height: cell,
            backgroundColor: on
              ? active
                ? ACCENT
                : "#CBD5E1"
              : "transparent",
            transition: "background-color 240ms ease",
          }}
        />
      ))}
    </div>
  );
}
