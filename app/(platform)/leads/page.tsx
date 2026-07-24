import type { Metadata } from "next";
import Link from "next/link";
import { SplitHero } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { OverflowInbox } from "@/components/platform/artifacts/overflow-inbox";
import { VisitorStream } from "@/components/platform/artifacts/visitor-stream";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";
import { AttributionBreakdown } from "@/components/platform/artifacts/attribution-breakdown";
import { DashboardFrame } from "@/components/home/walkthrough/dashboard-frame";

export const metadata: Metadata = {
  title: "Every inquiry, scored, in one inbox",
  description:
    "Every listing inquiry, DM, form fill, and voicemail lands in one inbox with property and source attached, scored so your team calls the right one first. Plus a pixel that names anonymous visitors and a chatbot that catches leads at 2am.",
};

// ---------------------------------------------------------------------------
// /leads — Lead capture, scoring, and attribution marketing page.
//
// Rewritten 2026-07-24 to drop the earlier lead-marketplace / 280M-record
// household-identity-graph pivot. LeaseStack does not buy or sell leads —
// see .agents/product-marketing.md. This page now covers only what the
// leads surface actually does:
//   1. OverflowInbox        — every inquiry, every source, one inbox (hero)
//   2. VisitorStream         — pixel names anonymous site traffic
//   3. DashboardFrame(beat=2) — leads scored and ranked (the real /leads screen)
//   4. ChatDemo               — after-hours chatbot captures the lead + transcript
//   5. AttributionBreakdown   — every lead traces to the campaign, through
//                               tour, to signed lease
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const BORDER = "#e0e0e0";
const ACCENT = "#0f62fe";

const PAINS = [
  {
    title: "Inquiries arrive from everywhere, and nothing ties them together",
    body: "Listing portals, site forms, DMs, voicemail, chatbot conversations — each one lands in a different inbox or vendor dashboard. There's no single place your team looks first.",
  },
  {
    title: "About one in four leads arrive after hours",
    body: "A prospect asks if the two-bed is still available at 2am. Nobody answers until morning, and by then they've toured a property that did.",
  },
  {
    title: "Ad spend and signed leases live in different systems",
    body: "Google Ads shows clicks. Meta shows reach. Neither tells you which dollar produced which signed lease, so budget decisions are guesses.",
  },
];

export default function LeadsPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK }}>
      {/* Hero ----------------------------------------------------------- */}
      <SplitHero
        eyebrow="Leads"
        headline="Every inquiry,"
        headlineAccent="one inbox, fully scored."
        subhead="Every listing inquiry, DM, form fill, and voicemail lands in one inbox with property and source attached, then gets scored so your team calls the right one first."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "See how it's scored", href: "#scoring", variant: "secondary" },
        ]}
        caption="Interactive demo on this page. No signup required."
        artifact={<OverflowInbox />}
      />

      {/* Problem ---------------------------------------------------------- */}
      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <h2
                className="mx-auto max-w-[760px]"
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                }}
              >
                You don't have a lead problem. You have a visibility problem.
              </h2>
            </div>
          </Reveal>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PAINS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <li
                  className="p-7 h-full"
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "2px",
                    boxShadow: `0 0 0 1px ${BORDER}`,
                  }}
                >
                  <h3
                    style={{
                      color: INK,
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
                      color: MUTED,
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

      {/* Capture: pixel / visitor identification ------------------------ */}
      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="max-w-xl">
              <h2
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px, 3.2vw, 38px)",
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                Most visitors leave without a form fill. We name them anyway.
              </h2>
              <p
                className="mt-5"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  lineHeight: 1.6,
                }}
              >
                Drop a one-line pixel on your listings and tour-request pages.
                Anonymous visitors resolve to a name and email, and stream
                into the same inbox as your form fills, DMs, and calls.
              </p>
              <FeatureBullets
                items={[
                  "One pixel across every listing page and device",
                  "On the demo property, about 41% of site traffic resolves to a name",
                  "Resolved visitors land in the same inbox as your other inquiries",
                  "Pushed to your CRM and ad audiences the moment they resolve",
                ]}
              />
            </div>
            <div className="min-w-0">
              <VisitorStream />
            </div>
          </div>
        </div>
      </section>

      {/* Score + rank ---------------------------------------------------- */}
      <section id="scoring" style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center lg:[&>*:first-child]:order-2">
            <div className="max-w-xl">
              <h2
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px, 3.2vw, 38px)",
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                Every inquiry lands with a score, so your team calls the
                right one first.
              </h2>
              <p
                className="mt-5"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  lineHeight: 1.6,
                }}
              >
                The moment an inquiry hits the inbox, it's scored and ranked.
                Source, budget signal, and suggested next step are visible at
                a glance, so your team works the hottest lead first instead
                of guessing.
              </p>
              <FeatureBullets
                items={[
                  "Composite score on every lead, updated as it moves through the pipeline",
                  "Sorted by score, not by arrival time",
                  "Source and suggested next step shown inline",
                  "The same pipeline your team works from in the real portal",
                ]}
              />
            </div>
            <div className="min-w-0">
              <DashboardFrame beat={2} />
            </div>
          </div>
        </div>
      </section>

      {/* After-hours chatbot ---------------------------------------------- */}
      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="max-w-xl">
              <h2
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px, 3.2vw, 38px)",
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                Leads don't stop coming in at 2am. Neither does the chatbot.
              </h2>
              <p
                className="mt-5"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  lineHeight: 1.6,
                }}
              >
                Trained on your live units, pricing, and availability, it
                answers renters after hours, captures the lead, and hands the
                full conversation to your team by morning.
              </p>
              <FeatureBullets
                items={[
                  "Trained on your real unit data: floor plans, pricing, availability",
                  "Captures name and email, adds the lead to the same inbox",
                  "Full conversation transcript attached, no context lost",
                  "Catches the roughly one in four leads that arrive after hours",
                ]}
              />
            </div>
            <div className="min-w-0">
              <ChatDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Attribution -------------------------------------------------------- */}
      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center lg:[&>*:first-child]:order-2">
            <div className="max-w-xl">
              <h2
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px, 3.2vw, 38px)",
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                Every lead traces back to the campaign that produced it.
              </h2>
              <p
                className="mt-5"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  lineHeight: 1.6,
                }}
              >
                From the first visit through the tour to the signed lease,
                each lead keeps its source attached. See which channel, and
                which dollar, actually closed.
              </p>
              <FeatureBullets
                items={[
                  "One funnel: visitors → leads → tours → applications → signed leases",
                  "Cost per lead and cost per signed lease, by channel",
                  "No more grading each vendor's own homework",
                ]}
              />
            </div>
            <div className="min-w-0">
              <AttributionBreakdown />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA -------------------------------------------------------- */}
      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-24 md:py-28 text-center">
          <Reveal delay={60}>
            <h2
              className="mx-auto max-w-[760px]"
              style={{
                color: INK,
                fontFamily: "var(--font-display)",
                fontSize: "clamp(30px, 3.8vw, 44px)",
                fontWeight: 500,
                lineHeight: 1.12,
                letterSpacing: "-0.008em",
              }}
            >
              See your own leads in one inbox, scored, before you pay a cent.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p
              className="mx-auto mt-5 max-w-[620px]"
              style={{
                color: MUTED,
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                lineHeight: 1.6,
              }}
            >
              Bring one of your properties to a free 14-day pilot. We'll
              connect a source, capture the next inquiry live, and show you
              what it looks like scored in the inbox. No card, no contract.
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

function FeatureBullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((b) => (
        <li
          key={b}
          className="flex items-start gap-3"
          style={{
            color: INK,
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
              color: ACCENT,
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
  );
}
