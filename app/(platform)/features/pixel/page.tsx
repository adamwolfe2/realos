import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SplitHero, SplitSection } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { VisitorStream } from "@/components/platform/artifacts/visitor-stream";

export const metadata: Metadata = {
  title: "Know who visited your website, not just how many",
  description:
    "Names and emails on a meaningful share of your anonymous site traffic. Fed straight into your CRM and ad audiences.",
};

export default function PixelFeaturePage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Visitor identification"
        headline="Know who visited your website,"
        headlineAccent="not just how many."
        subhead="We give you the name and email behind a meaningful share of your sessions before they fill out a form."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Book a demo", href: "/onboarding", variant: "secondary" },
        ]}
        caption="Live on your site, consented identity graph, fully compliant"
        artifact={<VisitorStream />}
      />

      <SplitSection
        eyebrow="What you see"
        headline="Real names on the visits that matter."
        body="Every time a prospect loads a floor plan, you find out who they are. Not 'someone from California', but a name, an email, often a phone and a LinkedIn. Your leasing team follows up with a prospect you would have lost otherwise."
        bullets={[
          "Live feed of identified visitors, where they came from, and what they looked at.",
          "Each visitor enriched with role, organization, and contact info.",
          "High-intent visits flagged and emailed to your team within minutes.",
          "Captured with consent. Audit-friendly, compliant, yours to keep.",
        ]}
        side="right"
        artifact={<VisitorProfile />}
      />

      <FullBand
        headline="Anonymous to named, with no work on your side."
        body="We install it, we run it, and we feed the results into your team's workflow. You read the Monday report and the named leads that drop into your CRM throughout the week."
        artifact={<PixelPipeline />}
      />

      <FullBand
        background="#f4f4f4"
        headline="A steady stream of named visitors, not session counts."
        bullets={[
          "Monday report: who visited, who was high intent, who converted last week.",
          "Named leads flow into your team's inbox and your leasing software automatically.",
          "Meta, Google, and TikTok audiences rebuilt weekly from the prospects who actually showed up.",
          "Attribution from ad to tour to lease. You stop guessing which channel drove the signing.",
        ]}
        artifact={<PixelResults />}
      />

      <FinalBand />
    </div>
  );
}

function FullBand({
  headline,
  body,
  bullets,
  artifact,
  background = "#FFFFFF",
}: {
  headline: string;
  body?: string;
  bullets?: string[];
  artifact: ReactNode;
  background?: string;
}) {
  return (
    <section style={{ backgroundColor: background }}>
      <div className="max-w-[860px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <Reveal>
          <h2
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 3.2vw, 38px)",
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            {headline}
          </h2>
        </Reveal>
        {body ? (
          <Reveal delay={60}>
            <p
              className="mx-auto mt-4 max-w-[620px]"
              style={{
                color: "#6f6f6f",
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                lineHeight: 1.6,
              }}
            >
              {body}
            </p>
          </Reveal>
        ) : null}
        {bullets ? (
          <ul className="mx-auto mt-6 max-w-[560px] text-left space-y-3">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3"
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  lineHeight: 1.55,
                }}
              >
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center flex-shrink-0 mt-1 w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: "rgba(15,98,254,0.14)",
                    color: "#0f62fe",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M1.5 5L4 7.5L8.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Reveal delay={120} y={24}>
          <div className="mt-10">{artifact}</div>
        </Reveal>
      </div>
    </section>
  );
}

function VisitorProfile() {
  const facts = [
    { label: "Name",          value: "Marisol Reyes" },
    { label: "Email",         value: "marisol.reyes@example.edu" },
    { label: "Who she is",    value: "University student · sophomore" },
    { label: "Where she's from", value: "Sacramento, CA" },
    { label: "What she looked at", value: "2-bed floor plan, pricing, tours" },
    { label: "Time on site",  value: "4m 38s across 3 visits" },
    { label: "Intent",        value: "High. Viewed tours twice" },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "2px",
        boxShadow: "0 0 0 1px #e0e0e0, 0 20px 60px rgba(15, 23, 42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#0f62fe",
            color: "#ffffff",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          MR
        </span>
        <div className="flex-1 min-w-0">
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: "#161616",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            Marisol Reyes · identified visitor
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#8d8d8d",
              marginTop: "3px",
              fontWeight: 500,
            }}
          >
            What we know before she filled anything out
          </p>
        </div>
      </div>
      <ul>
        {facts.map((f, i) => (
          <li
            key={f.label}
            className="grid grid-cols-[150px_1fr] gap-3 items-center px-5 py-3"
            style={{ borderBottom: i < facts.length - 1 ? "1px solid #e0e0e0" : "none" }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8d8d8d",
                fontWeight: 500,
              }}
            >
              {f.label}
            </span>
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#161616",
                fontWeight: 500,
              }}
            >
              {f.value}
            </span>
          </li>
        ))}
      </ul>
      <div
        className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8d8d8d",
            fontWeight: 500,
          }}
        >
          Sent to your team, added to your ad audiences
        </span>
      </div>
    </div>
  );
}

function PixelPipeline() {
  const stages = [
    { title: "A prospect visits your site",   body: "Every pageview is captured. Which units they looked at, how long they stayed, how they got there." },
    { title: "We match the visit to a person", body: "A consented identity graph returns a real name and email for a meaningful share of those visits." },
    { title: "We attach the rest of the profile",      body: "Role, organization, phone, and LinkedIn, attached to the visitor record so your team has context before they reach out." },
    { title: "It lands where your team works", body: "Your leasing inbox, your CRM, your ad audiences, and your Monday owner report. Nothing for you to wire up." },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "2px",
        boxShadow: "0 0 0 1px #e0e0e0, 0 20px 60px rgba(15, 23, 42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3"
        style={{ borderBottom: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8d8d8d",
            fontWeight: 600,
          }}
        >
          How a single visit becomes a named lead
        </span>
      </div>
      <ol className="p-5 space-y-3">
        {stages.map((s, i) => (
          <Reveal key={s.title} delay={i * 80}>
            <li className="flex gap-4">
              <div
                aria-hidden="true"
                className="flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "2px",
                  backgroundColor: "rgba(15, 98, 254,0.12)",
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
              </div>
              <div className="flex-1">
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14.5px",
                    color: "#161616",
                    fontWeight: 600,
                  }}
                >
                  {s.title}
                </p>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13.5px",
                    color: "#6f6f6f",
                    lineHeight: 1.55,
                  }}
                >
                  {s.body}
                </p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

function PixelResults() {
  const deltas = [
    { label: "Identified visitors",   value: "312",   delta: "last 7 days" },
    { label: "Named leads to CRM",    value: "48",    delta: "+23 vs. forms" },
    { label: "High-intent flagged",   value: "19",    delta: "emailed Mon 7am" },
    { label: "Retargeting audience",  value: "2,847", delta: "hashed emails" },
  ];
  return (
    <div className="w-full">
      <div className="mb-3 flex justify-end">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-muted-foreground)",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: "var(--color-secondary)",
          }}
        >
          Example data
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
      {deltas.map((d, i) => (
        <Reveal key={d.label} delay={i * 70}>
          <div
            className="p-5"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "2px",
              boxShadow: "0 0 0 1px #e0e0e0",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#8d8d8d",
                fontWeight: 500,
              }}
            >
              {d.label}
            </p>
            <p
              className="mt-1.5"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "32px",
                color: "#161616",
                fontWeight: 500,
                lineHeight: 1.05,
              }}
            >
              {d.value}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#0f62fe",
                fontWeight: 600,
              }}
            >
              {d.delta}
            </p>
          </div>
        </Reveal>
      ))}
      </div>
    </div>
  );
}

function FinalBand() {
  return (
    <section style={{ backgroundColor: "#f4f4f4" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <Reveal delay={60}>
          <p
            className="mx-auto max-w-[720px]"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.35,
            }}
          >
            Best for operators with a few hundred monthly site visitors and no visibility into who's behind the anonymous traffic. Student housing, multifamily, and senior living see the biggest lift.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-primary">
              Request pilot
            </Link>
            <Link href="/onboarding" className="btn-secondary">
              Book a demo
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
