"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { MARKETING } from "@/lib/copy/marketing";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { Mark } from "./mark";

// ---------------------------------------------------------------------------
// Proof — final CTA section.
//
// Light #f4f4f4 band closing the page. Headline keyword carries a marker
// sweep (cool pass M1) and the primary button gets a single sheen sweep when
// the section enters view (motion pass sec 9). Reduced-motion: static.
// ---------------------------------------------------------------------------

export function Proof() {
  const { final } = MARKETING.home;
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();

  return (
    <section
      ref={ref}
      style={{
        backgroundColor: "#f4f4f4",
        color: "#161616",
      }}
    >
      {/* Norman v2 (2026-06-01): was a two-column "offer left / CTAs
          right" layout. Adam asked to stack both vertically and center
          horizontally so the final CTA reads as a single focused
          moment instead of a split scan. Headline -> body -> CTAs, all
          centered. Deslop pass (2026-07-21): dropped the "Pilot cohort
          . open now" eyebrow (decorative dot + fake-urgency framing);
          the headline carries the offer on its own. */}
      <div className="max-w-[820px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        {/* Headline + body, centered */}
        <h2
          style={{
            color: "#161616",
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(36px, 5.4vw, 64px)",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
          }}
        >
          Free pilot.
          <br />
          <Mark>No commitment.</Mark>
        </h2>
        <p
          className="mt-5 mx-auto max-w-[560px]"
          style={{
            color: "#6f6f6f",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.55,
          }}
        >
          {final.body}
        </p>

        {/* Thread terminus: the story ends at the action. */}
        <div className="mt-10 flex justify-center" aria-hidden>
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
              border: "1.5px solid rgba(15,98,254,0.35)",
              boxShadow: "0 0 0 5px rgba(15,98,254,0.06)",
            }}
          >
            <span className="grid grid-cols-3 gap-[2px]">
              {[1, 1, 1, 1, 0, 1, 0, 1, 0].map((on, i) => (
                <span
                  key={i}
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 1,
                    backgroundColor: on ? "#0f62fe" : "transparent",
                  }}
                />
              ))}
            </span>
          </span>
        </div>

        {/* CTAs — stacked-then-inline, centered as a group */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <span
            className="relative inline-flex overflow-hidden"
            style={{ borderRadius: "2px" }}
          >
          <Link
            href={final.primaryHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "50px",
              padding: "14px 28px",
              backgroundColor: "#0f62fe",
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)",
              fontSize: "15.5px",
              fontWeight: 600,
              borderRadius: "2px",
              textDecoration: "none",
              letterSpacing: "-0.005em",
              transition: "background-color 0.2s ease",
            }}
          >
            {final.primaryCta}
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{ marginLeft: 8 }}
            >
              <path
                d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          {!reduce ? (
            <motion.span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              initial={{ x: "-120%" }}
              animate={{ x: inView ? "120%" : "-120%" }}
              transition={{ duration: 0.9, ease: "easeInOut", delay: 0.25 }}
              style={{
                background:
                  "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
              }}
            />
          ) : null}
          </span>
          <BookDemoLink
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "50px",
              padding: "14px 28px",
              backgroundColor: "#FFFFFF",
              color: "#161616",
              fontFamily: "var(--font-sans)",
              fontSize: "15.5px",
              fontWeight: 600,
              borderRadius: "2px",
              textDecoration: "none",
              letterSpacing: "-0.005em",
              border: "1px solid #c6c6c6",
              transition: "background-color 0.2s ease",
            }}
          >
            Book a demo
          </BookDemoLink>
        </div>

        {/* Trust strip, inline horizontal proof points, not a giant grid */}
        <div
          className="mt-12 md:mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0"
          style={{
            borderTop: "1px solid #e0e0e0",
            paddingTop: 28,
          }}
        >
          <TrustPoint
            label="Time to live"
            value="14 days"
            body="From intake call to your domain firing."
            divider
          />
          <TrustPoint
            label="What you log into"
            value="1 portal"
            body="Not six vendors, six invoices, six dashboards."
            divider
          />
          <TrustPoint
            label="Lock-in"
            value="Month-to-month"
            body="No long-term contracts. Leave anytime."
          />
        </div>
      </div>
    </section>
  );
}

function TrustPoint({
  label,
  value,
  body,
  divider,
}: {
  label: string;
  value: string;
  body: string;
  divider?: boolean;
}) {
  return (
    // text-center on mobile (stacked); the md 3-col row keeps it too so all
    // three stats read as one centered system (Adam 2026-07-23 phone QA).
    <div
      className="text-center md:px-8 md:first:pl-0 md:last:pr-0"
      style={{
        borderRight: divider ? "1px solid #e0e0e0" : "none",
      }}
    >
      <p
        style={{
          color: "#8d8d8d",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        className="mt-2"
        style={{
          color: "#161616",
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(24px, 2.4vw, 28px)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      <p
        className="mt-2 max-w-[260px] mx-auto"
        style={{
          color: "#6f6f6f",
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
    </div>
  );
}
