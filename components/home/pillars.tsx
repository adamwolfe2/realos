import React from "react";
import Link from "next/link";
import { AttributionBreakdown } from "@/components/platform/artifacts/attribution-breakdown";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";
import { ReputationFeed } from "@/components/platform/artifacts/reputation-feed";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import { Reveal } from "@/components/platform/reveal";

// ---------------------------------------------------------------------------
// Pillars — the whole leasing funnel, told in three (2026-07-21 blueprint,
// section 4). One intro block, then three pillar rows built from the real
// artifact components.
//
//   Row 1  Attribution        text 5 / artifact 7, text left
//   Row 2  After-hours AI      text 5 / artifact 7, text right (one flip)
//   Row 3  Reputation + AEO    full-width stacked, breaks the zigzag
//
// The weekly-report artifact is intentionally NOT one of the pillars: it
// gets its own centerpiece treatment in section 5, so it isn't rendered
// twice within one scroll. All three pillar artifacts are visually
// distinct (chart / chat / feed).
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const ACCENT = "#0f62fe";

function PillarText({
  headline,
  body,
  linkLabel,
  href,
  center,
}: {
  headline: string;
  body: string;
  linkLabel: string;
  href: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "max-w-[620px] mx-auto text-center" : ""}>
      <h3
        style={{
          color: INK,
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(28px, 3vw, 34px)",
          fontWeight: 500,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
        }}
      >
        {headline}
      </h3>
      <p
        className={center ? "mt-4 mx-auto" : "mt-4"}
        style={{
          color: MUTED,
          fontFamily: "var(--font-sans)",
          fontSize: "17px",
          lineHeight: 1.6,
          maxWidth: "480px",
        }}
      >
        {body}
      </p>
      <Link
        href={href}
        className={`mt-5 inline-flex items-center gap-1.5 group ${center ? "justify-center" : ""}`}
        style={{
          color: ACCENT,
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          fontWeight: 500,
        }}
      >
        {linkLabel}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="transition-transform group-hover:translate-x-1"
          aria-hidden
        >
          <path
            d="M3 7h7m0 0L7 4m3 3L7 10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}

export function Pillars() {
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24 md:py-28">
        {/* Intro */}
        <Reveal>
          <div className="max-w-[720px]">
            <h2
              style={{
                color: INK,
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(30px, 3.8vw, 46px)",
                fontWeight: 500,
                lineHeight: 1.08,
                letterSpacing: "-0.025em",
              }}
            >
              The whole leasing funnel, accounted for.
            </h2>
            <p
              className="mt-5"
              style={{
                color: MUTED,
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                lineHeight: 1.6,
                maxWidth: "560px",
              }}
            >
              Marketing spend, after-hours leads, and public reputation, each
              tracked on the same platform your team already logs into.
            </p>
          </div>
        </Reveal>

        {/* Row 1 — Attribution. Text left, artifact right. */}
        <div className="mt-16 md:mt-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <PillarText
                headline="Every dollar of ad spend, tracked to a signed lease."
                body="Google and Meta spend mapped to leases, not impressions. Blended cost per lease and campaign ROI, continuously."
                linkLabel="See it live"
                href="/features/ads"
              />
            </Reveal>
          </div>
          <div className="lg:col-span-7">
            <Reveal delay={120} y={24}>
              <SoftFramedArtifact tone="sky" padding="md" bare>
                <AttributionBreakdown />
              </SoftFramedArtifact>
            </Reveal>
          </div>
        </div>

        {/* Row 2 — After-hours AI. Text right, artifact left (one flip). */}
        <div className="mt-16 md:mt-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-7 lg:order-1 order-2">
            <Reveal delay={120} y={24}>
              <SoftFramedArtifact tone="sky" padding="md" bare>
                <ChatDemo />
              </SoftFramedArtifact>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:order-2 order-1">
            <Reveal>
              <PillarText
                headline="An AI assistant that books tours at 2am."
                body="Trained on your property, brand, and units. Books tours, sends floor plans, captures contacts. Hot leads reach your team by morning."
                linkLabel="Try a conversation"
                href="/features/chatbot"
              />
            </Reveal>
          </div>
        </div>

        {/* Row 3 — Reputation + AI search. Full-width stacked, breaks zigzag. */}
        <div className="mt-20 md:mt-28">
          <Reveal>
            <PillarText
              headline="Your reputation, watched across every site that matters."
              body="Google, Reddit, Yelp, and the open web in one feed, sentiment-classified, with one-click reply. Reputation and AI-search visibility in one place."
              linkLabel="See a live audit"
              href="/audit"
              center
            />
          </Reveal>
          <Reveal delay={120} y={24}>
            <div className="mt-10 md:mt-12 max-w-[1000px] mx-auto">
              <SoftFramedArtifact tone="sky" padding="md" bare>
                <ReputationFeed />
              </SoftFramedArtifact>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
