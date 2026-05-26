import type { Metadata } from "next";
import Link from "next/link";
import { SplitHero } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { StickyArtifactSection } from "@/components/platform/sticky-artifact-section";
import { OverflowInbox } from "@/components/platform/artifacts/overflow-inbox";
import { LeadEnrichmentCard } from "@/components/platform/artifacts/lead-enrichment-card";
import { LeadMarketplace } from "@/components/platform/artifacts/lead-marketplace";
import { VisitorStream } from "@/components/platform/artifacts/visitor-stream";

export const metadata: Metadata = {
  title: "Real estate leads — captured, scored, and routed",
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
//
// Page is fully self-contained and uses no underlying-vendor copy. If this
// converts on the marketing side we promote the demo flow into the
// portal as a real product line (see LEAD_MARKETPLACE in the roadmap).
// ---------------------------------------------------------------------------

const PAINS = [
  {
    title: "Ninety-nine inquiries die per closed lead",
    body: "Every listing generates dozens of inbound contacts. Only one signs. The rest — actively-searching, ready-to-move buyers and renters — go cold inside an inbox no one is monitoring.",
  },
  {
    title: "Your inquiries arrive across seven sources",
    body: "Listing portals. Site forms. Instagram DMs. Voicemail transcripts. Email replies. Cross-posted aggregators. There is no unified inbox today, so leads slip through the seams.",
  },
  {
    title: "Bought leads are stale by the time you call",
    body: "Traditional lead vendors resell aged contact lists with no intent context. By the time the call lands, the prospect closed elsewhere — or never wanted what you sold them in the first place.",
  },
];

const MODULES = [
  {
    title: "Unified overflow inbox",
    body: "Connect every listing source once — portals, DMs, forms, voicemail, email. Every inquiry lands in one inbox with property, market, and source attached. Nothing slips.",
  },
  {
    title: "Identity matched on every lead",
    body: "Each new lead is matched against a 280M-record identity layer. Verified phone, full name, postal address, household band, and household composition appear automatically — within seconds of capture.",
  },
  {
    title: "Intent overlay and scoring",
    body: "Behavioural intent overlays every lead: active home buyer status, buying timeline, listings viewed in the last seven days, budget signal, search radius. Each lead lands with a composite intent score from 0–100.",
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
    body: "Buyers save a filter set as a stream. Every new lead that matches gets auto-purchased and delivered to their CRM. No browsing, no manual buys — just inventory flowing into their pipeline.",
  },
];

export default function LeadsPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      {/* Hero ----------------------------------------------------------- */}
      <SplitHero
        eyebrow="Leads"
        headline="Every inquiry, every market."
        headlineAccent="One inbox, fully scored."
        subhead="Capture every inquiry across listing portals, DMs, forms, and voicemail. Enrich each lead with verified contact data and intent. Work them yourself, route them to your team, or list the overflow in the marketplace. One platform, end to end."
        ctas={[
          { label: "Book a demo", href: "/onboarding" },
          { label: "See the marketplace", href: "#marketplace", variant: "secondary" },
        ]}
        caption="Live demo on this page. No signup required."
        artifact={<OverflowInbox />}
      />

      {/* Problem -------------------------------------------------------- */}
      <section style={{ backgroundColor: "#F1F5F9" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p
                className="mb-4"
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                The leak in every operator's funnel
              </p>
              <h2
                className="mx-auto max-w-[760px]"
                style={{
                  color: "#1E2A3A",
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
                    borderRadius: "16px",
                    boxShadow: "0 0 0 1px #E2E8F0",
                  }}
                >
                  <span
                    style={{
                      color: "#2563EB",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      letterSpacing: "0.14em",
                      fontWeight: 600,
                    }}
                  >
                    0{i + 1}
                  </span>
                  <h3
                    className="mt-4"
                    style={{
                      color: "#1E2A3A",
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
                      color: "#64748B",
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

      {/* Step 1b — pixel / visitor identification (more capture) -------- */}
      <StickyArtifactSection
        eyebrow="Step 1 · Capture · the silent half"
        title={
          <>
            Most visitors leave without a form fill.{" "}
            <span style={{ color: "#2563EB" }}>We name them anyway.</span>
          </>
        }
        body="Drop a one-line pixel on your listings, neighbourhood pages, and tour-request flow. Anonymous browsers de-anonymize at industry-leading match rates and stream straight into the same inbox as your form fills, DMs, and inbound calls. No cookie banner gymnastics. No double-tracking."
        bullets={[
          "One pixel, every listing surface, every device",
          "Match rates between 40 and 60 percent on US residential traffic",
          "Resolved visitors land in the same inbox as form fills",
          "Push to ad audiences and CRM as soon as they resolve",
        ]}
        artifact={<VisitorStream />}
        surface="muted"
        textSide="right"
      />

      {/* Step 2: Enrich + Score (sticky text, animated card) ------------ */}
      <StickyArtifactSection
        eyebrow="Step 2 · Enrich and score"
        title={
          <>
            Every raw lead becomes a{" "}
            <span style={{ color: "#2563EB" }}>scored, deliverable record</span>{" "}
            in seconds.
          </>
        }
        body="A form fill comes in with just an email and a first name. Five seconds later, that record carries a verified phone, full address, household band, behavioural intent overlay, and a composite score you can route on. Watch a single lead enrich in real time."
        bullets={[
          "Identity match against a 280M-record household graph",
          "Verified phone, address, household band, household composition",
          "Behavioural intent: active buyer status, listings viewed, timeline",
          "0–100 composite score gated for routing and pricing rules",
        ]}
        cta={{ label: "See the marketplace", href: "#marketplace" }}
        artifact={<LeadEnrichmentCard />}
        surface="light"
      />

      {/* The marketplace ----------------------------------------------- */}
      <section
        id="marketplace"
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid #F1F5F9",
        }}
      >
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="text-center mb-12 md:mb-14">
            <Reveal>
              <p
                className="mb-4"
                style={{
                  color: "#2563EB",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Step 3 · Route, sell, or stream
              </p>
            </Reveal>
            <Reveal delay={60}>
              <h2
                className="mx-auto max-w-[820px]"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(30px, 3.8vw, 44px)",
                  fontWeight: 500,
                  lineHeight: 1.12,
                  letterSpacing: "-0.008em",
                }}
              >
                Browse, filter, and buy real-time leads. Or list your overflow.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p
                className="mx-auto mt-5 max-w-[680px]"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "16px",
                  lineHeight: 1.6,
                }}
              >
                Filter by market, property type, intent floor, and price band.
                Subscribe to a saved filter as a stream and the platform
                auto-routes every matching lead to your CRM the moment it
                scores. Try it below — it's live.
              </p>
            </Reveal>
          </div>

          <Reveal delay={180} y={24}>
            <LeadMarketplace />
          </Reveal>

          <Reveal delay={260}>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
              <MarketplaceStat
                value="2,400+"
                label="leads scored in the last 24 hours"
              />
              <MarketplaceStat
                value="40–60%"
                label="anonymous-visitor identification rate"
              />
              <MarketplaceStat
                value="<1s"
                label="from score to webhook delivery"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Modules grid --------------------------------------------------- */}
      <section style={{ backgroundColor: "#F1F5F9" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p
                className="mb-4"
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                What you get on day one
              </p>
              <h2
                className="mx-auto max-w-[760px]"
                style={{
                  color: "#1E2A3A",
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
                  className="p-7 h-full flex gap-4"
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "16px",
                    boxShadow: "0 0 0 1px #E2E8F0",
                  }}
                >
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(37,99,235,0.12)",
                      color: "#2563EB",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    0{i + 1}
                  </span>
                  <div className="flex-1">
                    <h3
                      style={{
                        color: "#1E2A3A",
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
                        color: "#64748B",
                        fontFamily: "var(--font-sans)",
                        fontSize: "14.5px",
                        lineHeight: 1.6,
                      }}
                    >
                      {m.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA ----------------------------------------------------- */}
      <section style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #F1F5F9" }}>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-24 md:py-28 text-center">
          <Reveal>
            <p
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: "16px",
              }}
            >
              One platform
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h2
              className="mx-auto max-w-[760px]"
              style={{
                color: "#1E2A3A",
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
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                lineHeight: 1.6,
              }}
            >
              Book a 20-minute walkthrough. Bring one of your listings. We'll
              connect a source, capture the next inquiry live, and show you
              what enrichment looks like on a real lead.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/onboarding" className="btn-primary">
                Book a demo
              </Link>
              <Link href="#marketplace" className="btn-secondary">
                Replay the marketplace
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function MarketplaceStat({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="p-6 text-center"
      style={{
        backgroundColor: "#F1F5F9",
        borderRadius: "12px",
        boxShadow: "0 0 0 1px #E2E8F0",
      }}
    >
      <p
        style={{
          color: "#2563EB",
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
          color: "#64748B",
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
