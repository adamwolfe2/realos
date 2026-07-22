import React from "react";
import { Reveal } from "@/components/platform/reveal";

// ---------------------------------------------------------------------------
// LaunchSteps — implementation, compacted (2026-07-21 blueprint, section
// 6). Enterprise buyers want to know how it goes live. Three hairline-ruled
// columns (connect / first report / decide), real substance per column, no
// day-by-day pinned timeline. The bottom hairline separates this white
// section from the white FAQ below it.
//
// Step markers are sentence-case blue (not mono-caps) to preserve the
// page's single mono-caps moment in the trust band.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const ACCENT = "#0f62fe";

type Step = { marker: string; title: string; body: string };

const STEPS: Step[] = [
  {
    marker: "Day 1",
    title: "Connect your stack",
    body: "A 30-minute intake call. We connect to your existing PMS, domain, and ad accounts, then lock the build plan.",
  },
  {
    marker: "By day 30",
    title: "Read your first report",
    body: "Live on your domain by day 14. Your first weekly report lands by day 30, with leases attributed to source.",
  },
  {
    marker: "Month to month",
    title: "Decide on your terms",
    body: "No long contract. Watch the cost per lease drop, read the reports, and keep going only if it earns its place.",
  },
];

export function LaunchSteps() {
  return (
    <section
      style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #e0e0e0" }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24">
        <Reveal>
          <div className="max-w-[720px]">
            <h2
              style={{
                color: INK,
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(28px, 3.4vw, 40px)",
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
              }}
            >
              Live in fourteen days.
            </h2>
            <p
              className="mt-4"
              style={{
                color: MUTED,
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                lineHeight: 1.6,
                maxWidth: "520px",
              }}
            >
              A short, predictable path from intake call to a domain that is
              firing on its own.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal
              key={step.title}
              delay={i * 80}
              className={
                i === 0
                  ? "md:pr-10"
                  : "mt-8 pt-8 md:mt-0 md:pt-0 md:pl-10 border-t md:border-t-0 md:border-l border-[#e0e0e0]"
              }
            >
              <p
                style={{
                  color: ACCENT,
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
              >
                {step.marker}
              </p>
              <p
                className="mt-3"
                style={{
                  color: INK,
                  fontFamily: "var(--font-sans)",
                  fontSize: "19px",
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.25,
                }}
              >
                {step.title}
              </p>
              <p
                className="mt-2.5"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  maxWidth: "320px",
                }}
              >
                {step.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
