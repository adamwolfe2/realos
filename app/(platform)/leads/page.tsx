import type { Metadata } from "next";
import Link from "next/link";
import { SplitHero } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { OverflowInbox } from "@/components/platform/artifacts/overflow-inbox";
import { LeadEnrichmentCard } from "@/components/platform/artifacts/lead-enrichment-card";
import { LeadMarketplace } from "@/components/platform/artifacts/lead-marketplace";
import { VisitorStream } from "@/components/platform/artifacts/visitor-stream";

export const metadata: Metadata = {
  title: "Real estate leads, captured, scored, and routed",
  description:
    "Every listing inquiry, DM, form fill, and voicemail in one inbox. Every lead enriched with verified contact data and intent. Browse a live marketplace of ready-to-route buyer and rental leads with full filter control.",
};

// ---------------------------------------------------------------------------
// /leads — Lead capture, enrichment, and marketplace marketing page.
//
// Three interactive demos anchor the page:
//   1. OverflowInbox       — unified multi-source inquiry feed (hero)
//   2. LeadEnrichmentCard  — raw → identity → intent animation
//   3. LeadMarketplace     — filter + buy interface with live ticker
//
// Plus the existing VisitorStream pixel demo to show the de-anonymization
// half of the supply pipeline.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const SUBTLE = "#8d8d8d";
const BORDER = "#e0e0e0";
const ACCENT = "#0f62fe";

const PAINS = [
  {
    title: "Ninety-nine inquiries die per closed lead",
    body: "Every listing generates dozens of inbound contacts. Only one signs. The rest, actively-searching, ready-to-move buyers and renters, go cold inside an inbox no one is monitoring.",
  },
  {
    title: "Your inquiries arrive across seven sources",
    body: "Listing portals. Site forms. Instagram DMs. Voicemail transcripts. Email replies. Cross-posted aggregators. There is no unified inbox today, so leads slip through the seams.",
  },
  {
    title: "Bought leads are stale by the time you call",
    body: "Traditional lead vendors resell aged contact lists with no intent context. By the time the call lands, the prospect closed elsewhere, or never wanted what you sold them in the first place.",
  },
];

const MODULES = [
  {
    title: "Unified overflow inbox",
    body: "Connect every listing source once: portals, DMs, forms, voicemail, email. Every inquiry lands in one inbox with property, market, and source attached. Nothing slips.",
  },
  {
    title: "Identity matched on every lead",
    body: "Each new lead is matched against a 280M-record identity layer. Verified phone, full name, postal address, household band, and household composition appear automatically within seconds of capture.",
  },
  {
    title: "Intent overlay and scoring",
    body: "Behavioural intent overlays every lead: active home buyer status, buying timeline, listings viewed in the last seven days, budget signal, search radius. Each lead lands with a composite intent score from 0-100.",
  },
  {
    title: "Smart routing by market and rules",
    body: "Route hot leads to your top closer. Route by zip, by price band, by intent floor, by property type. Round-robin or weighted. Push to your CRM by webhook in under a second.",
  },
  {
    title: "Two-sided marketplace",
    body: "Leads you can't work yourself can be listed in the marketplace. Other agents, brokerages, and investors buy them per-lead or subscribe to a filtered stream. Your overflow becomes recurring revenue.",
  },
  {
    title: "Stream subscriptions for buyers",
    body: "Buyers save a filter set as a stream. Every new lead that matches gets auto-purchased and delivered to their CRM. No browsing, no manual buys, just inventory flowing into their pipeline.",
  },
];

export default function LeadsPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK }}>
      {/* Hero ----------------------------------------------------------- */}
      <SplitHero
        eyebrow="Leads"
        headline="Every inquiry, every market."
        headlineAccent="One inbox, fully scored."
        subhead="Every inquiry lands in one inbox, enriched with verified contact data and intent, ready to route or sell."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "See the marketplace", href: "#marketplace", variant: "secondary" },
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
                You don't have a lead problem. You have a capture problem.
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
                Drop a one-line pixel on your listings, neighborhood pages,
                and tour-request flow. Anonymous browsers de-anonymize at
                industry-leading match rates and stream into the same inbox
                as your form fills, DMs, and inbound calls.
              </p>
              <FeatureBullets
                items={[
                  "One pixel, every listing surface, every device",
                  "40-60% match rate on US residential traffic",
                  "Resolved visitors land in the same inbox as form fills",
                  "Push to ad audiences and CRM the moment they resolve",
                ]}
              />
            </div>
            <div className="min-w-0">
              <VisitorStream />
            </div>
          </div>
        </div>
      </section>

      {/* Enrich + score ---------------------------------------------------- */}
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
                Every raw lead becomes a scored, deliverable record in
                seconds.
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
                A form fill comes in with just an email and a first name.
                Five seconds later, that record carries a verified phone,
                full address, household band, behavioural intent overlay,
                and a composite score you can route on.
              </p>
              <FeatureBullets
                items={[
                  "Identity match against a 280M-record household graph",
                  "Verified phone, address, household band, composition",
                  "Behavioural intent: active buyer status, listings viewed",
                  "0-100 composite score for routing and pricing rules",
                ]}
              />
            </div>
            <div className="min-w-0">
              <LeadEnrichmentCard />
            </div>
          </div>
        </div>
      </section>

      {/* The marketplace --------------------------------------------------- */}
      <section id="marketplace" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="text-center mb-12 md:mb-14">
            <Reveal>
              <h2
                className="mx-auto max-w-[820px]"
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.6vw, 42px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: "-0.008em",
                }}
              >
                Browse, filter, and buy real-time leads. Or list your
                overflow.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p
                className="mx-auto mt-5 max-w-[680px]"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: "16px",
                  lineHeight: 1.6,
                }}
              >
                Filter by market, property type, intent floor, and price
                band. Subscribe to a saved filter and every matching lead
                auto-routes to your CRM. Try it below, no signup required.
              </p>
            </Reveal>
          </div>

          <Reveal delay={140} y={24}>
            <LeadMarketplace />
          </Reveal>

          <Reveal delay={220}>
            <div className="mt-12">
              <div className="mb-3 flex justify-end">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: SUBTLE,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "2px",
                    backgroundColor: "#f4f4f4",
                  }}
                >
                  Example data
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MarketplaceStat
                  value="2,400+"
                  label="leads scored in the last 24 hours"
                />
                <MarketplaceStat
                  value="40-60%"
                  label="anonymous-visitor identification rate"
                />
                <MarketplaceStat
                  value="<1s"
                  label="from score to webhook delivery"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Modules grid --------------------------------------------------- */}
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
                Six modules. One platform. Capture, score, route, monetize.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODULES.map((m, i) => (
              <Reveal key={m.title} delay={i * 60}>
                <div
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
                      fontSize: "19px",
                      fontWeight: 500,
                      lineHeight: 1.25,
                    }}
                  >
                    {m.title}
                  </h3>
                  <p
                    className="mt-2"
                    style={{
                      color: MUTED,
                      fontFamily: "var(--font-sans)",
                      fontSize: "14.5px",
                      lineHeight: 1.6,
                    }}
                  >
                    {m.body}
                  </p>
                </div>
              </Reveal>
            ))}
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
              Stop throwing away ninety-nine leads to close one.
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
              Bring one of your listings to a 20-minute walkthrough. We'll
              connect a source, capture the next inquiry live, and show you
              what enrichment looks like on a real lead.
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

function MarketplaceStat({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="p-6 text-center"
      style={{
        backgroundColor: "#f4f4f4",
        borderRadius: "2px",
        boxShadow: `0 0 0 1px ${BORDER}`,
      }}
    >
      <p
        style={{
          color: ACCENT,
          fontFamily: "var(--font-display)",
          fontSize: "clamp(26px, 3vw, 34px)",
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </p>
      <p
        className="mt-2"
        style={{
          color: MUTED,
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          lineHeight: 1.5,
        }}
      >
        {label}
      </p>
    </div>
  );
}
