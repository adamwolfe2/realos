"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SectionShell, LabelChip } from "./section-shell";

// ---------------------------------------------------------------------------
// LaunchSteps — [05] Rollout. Four-step implementation. A connecting hairline
// draws left-to-right across the columns and each column fades up as the line
// reaches it (motion pass sec 7). Reduced-motion renders the line drawn and
// the columns in place.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const ACCENT = "#0f62fe";

type Step = { marker: string; title: string; body: string };

const STEPS: Step[] = [
  {
    marker: "Day 1",
    title: "Connect your PMS and ad accounts",
    body: "A 30-minute intake call, no card required. We connect to your existing PMS, domain, and ad accounts, then lock the build plan.",
  },
  {
    marker: "Days 2-13",
    title: "We build",
    body: "We build your leasing site, ad campaigns, after-hours chatbot, visitor pixel, and dashboard. You review the site preview and sign off before anything goes live.",
  },
  {
    marker: "Day 14",
    title: "You're live",
    body: "Site live on your domain. Ads running, chatbot answering, pixel firing. Your dashboard starts filling with real visitors and leads.",
  },
  {
    marker: "Every week after",
    title: "Reports and terms",
    body: "Your first weekly report lands after your first full week live, leases attributed to source. No long contract, cancel anytime, and if you ever leave, you keep the site and every lead.",
  },
];

export function LaunchSteps() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  return (
    <SectionShell bg="#FFFFFF">
      <div className="py-24 md:py-28">
        <div className="max-w-[720px]">
          <LabelChip>Implementation</LabelChip>
          <h2
            className="mt-4"
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

        <div ref={ref} className="relative mt-16">
          {/* Drawing connector line (desktop). */}
          <div
            className="hidden md:block absolute"
            style={{ top: 5, left: 0, right: 0, height: 2 }}
            aria-hidden
          >
            <div
              className="absolute inset-0"
              style={{ backgroundColor: "#e0e0e0" }}
            />
            <motion.div
              className="absolute inset-y-0 left-0 right-0"
              style={{ backgroundColor: ACCENT, transformOrigin: "left center" }}
              initial={false}
              animate={{ scaleX: on ? 1 : 0 }}
              transition={
                reduce ? { duration: 0 } : { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={false}
                animate={{ opacity: on ? 1 : 0, y: on ? 0 : reduce ? 0 : 14 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: 0.5, delay: 0.15 + i * 0.26, ease: [0.2, 0.7, 0.2, 1] }
                }
                className={
                  i === 0
                    ? "md:pr-10"
                    : "mt-10 pt-10 md:mt-0 md:pt-0 md:pl-10 border-t md:border-t-0 md:border-l border-[#e0e0e0]"
                }
              >
                <span
                  aria-hidden
                  className="hidden md:block"
                  // The connector line sits at top:5 height:2 (center y=6). A
                  // 12px dot at marginTop:0 has center y=6 too, so it lands
                  // exactly ON the line (punch-list item 4).
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: "#FFFFFF",
                    border: `2px solid ${ACCENT}`,
                    marginBottom: 20,
                    marginTop: 0,
                  }}
                />
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
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
