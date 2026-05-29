import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
// Above-the-fold artifact (row 01) is imported eagerly so the first
// paint of /features carries the WeeklyReport without waiting for an
// extra chunk fetch.
import { WeeklyReport } from "@/components/platform/artifacts/weekly-report";

// Below-the-fold artifacts (rows 02-07) are split into their own chunks
// via `next/dynamic`. Without this, the index page was bundling six
// 200-500 line client components — each with `useEffect` animation
// loops — into one synchronous payload. Lazy-loading still ships each
// artifact as a separate chunk, downloaded on demand as the row enters
// the viewport.
//
// Note: `ssr: false` is forbidden in server components in Next 16, so
// the artifacts SSR alongside the page shell. The useEffect animation
// loops are no-ops on the server and only kick in after hydration,
// which is the desired behavior anyway.
const ArtifactSkeleton = ({ minHeight = 360 }: { minHeight?: number }) => (
  <div
    className="w-full rounded-2xl bg-white"
    aria-hidden
    style={{
      minHeight,
      boxShadow:
        "0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)",
    }}
  />
);

const AttributionBreakdown = dynamic(
  () =>
    import("@/components/platform/artifacts/attribution-breakdown").then(
      (m) => m.AttributionBreakdown,
    ),
  { loading: () => <ArtifactSkeleton /> },
);

const VisitorStream = dynamic(
  () =>
    import("@/components/platform/artifacts/visitor-stream").then(
      (m) => m.VisitorStream,
    ),
  { loading: () => <ArtifactSkeleton /> },
);

const ChatDemo = dynamic(
  () =>
    import("@/components/platform/artifacts/chat-demo").then((m) => m.ChatDemo),
  { loading: () => <ArtifactSkeleton /> },
);

const ReputationFeed = dynamic(
  () =>
    import("@/components/platform/artifacts/reputation-feed").then(
      (m) => m.ReputationFeed,
    ),
  { loading: () => <ArtifactSkeleton /> },
);

const SeoAnswer = dynamic(
  () =>
    import("@/components/platform/artifacts/seo-answer").then(
      (m) => m.SeoAnswer,
    ),
  { loading: () => <ArtifactSkeleton /> },
);

const ConfigTabs = dynamic(
  () =>
    import("@/components/platform/artifacts/config-tabs").then(
      (m) => m.ConfigTabs,
    ),
  { loading: () => <ArtifactSkeleton /> },
);

// ---------------------------------------------------------------------------
// /features — index page that previously 404'd (2026-05-29 fix).
//
// Each of the eight features has a dedicated sub-page already (most under
// /features/*; reputation lives at /audit because the same surface doubles
// as the public lead magnet). This index renders the live artifact for
// each feature inline so a prospect can interact with every product
// surface in a single scroll, then click into the dedicated page for the
// full pitch.
//
// Layout: alternating left/right rhythm so the eye moves diagonally down
// the page instead of getting stuck in a single column of identical cards.
// Each feature row is a full <Link> wrapper so click anywhere on the row
// navigates to the sub-page. Internal anchors (the "Open the full feature
// →" CTA) are styled as part of that same card surface.
// ---------------------------------------------------------------------------

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const BORDER = "#E2E8F0";
const MUTED = "#64748B";
const SOFT_BG = "#F8FAFC";

export const metadata: Metadata = {
  title: `Features · ${BRAND_NAME}`,
  description:
    "Every feature in the LeaseStack platform — weekly report, managed ads, visitor identification, AI chatbot, reputation, SEO/AEO, conversion popups, and website build — with a live interactive demo of each.",
};

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  href: string;
  linkLabel: string;
  artifact: ReactNode;
  /** "sky" reads cooler / brand blue; "lavender" leans cluely-style.
   *  Alternated per row so the page rhythm doesn't feel mono-tonal. */
  tone: "sky" | "lavender" | "mint";
};

const FEATURES: Feature[] = [
  {
    eyebrow: "Weekly report · Core platform",
    title: "The report writes itself every Monday at 7am.",
    body: "Leases attributed by source, channel ROI, anomalies surfaced, three concrete actions for the week. One page, read over coffee — every operator on the platform gets it.",
    bullets: [
      "Leases mapped to source from the pixel + UTM + PMS join",
      "Channel mix bar walks the brand blue ramp, not a rainbow",
      "Three actions, ranked by dollar impact, ready to approve",
    ],
    href: "/sample-report",
    linkLabel: "See a sample report",
    artifact: <WeeklyReport />,
    tone: "sky",
  },
  {
    eyebrow: "Managed ads · Add-on",
    title: "Every dollar mapped to a signed lease, not an impression.",
    body: "Google, Meta, LinkedIn, TikTok — campaigns optimized against lease velocity, audited every week. Identity-pixel retargeting warms each audience at ID rates platform audiences never reach.",
    bullets: [
      "Geo-fenced campaigns per property with weekly creative refresh",
      "Cost per lease defended on a weekly review call",
      "Pause or kill any campaign directly from the portal",
    ],
    href: "/features/ads",
    linkLabel: "See it live",
    artifact: <AttributionBreakdown />,
    tone: "lavender",
  },
  {
    eyebrow: "Visitor identification · Add-on",
    title: "Names and emails on a meaningful share of anonymous traffic.",
    body: "Identity pixel resolves anonymous visitors in real time and routes the captured contact into your CRM and your ad audiences. The pipeline never sleeps.",
    bullets: [
      "Resolution typically lands 25-40% of unidentified traffic",
      "Identities pushed to Google + Meta audiences for retargeting",
      "Every visit, including pre-resolution hits, tracked for funnel math",
    ],
    href: "/features/pixel",
    linkLabel: "See the pixel firing",
    // Compact stream on the index card — sub-page renders the full
    // 5-row default. Adam (2026-05-29): the card was reading as the
    // tallest row in the scroll.
    artifact: <VisitorStream visibleRows={1} />,
    tone: "sky",
  },
  {
    eyebrow: "AI chatbot · Add-on",
    title: "An assistant that books tours at 2am.",
    body: "Trained on your property, your brand voice, your unit mix, your workflow. Captures contact info, qualifies intent, books tours, and emails floor plans — so hot leads hit your team by morning.",
    bullets: [
      "Property-specific knowledge base built during onboarding",
      "Tour booking writes directly into your scheduling system",
      "Conversations forward to a human handoff when intent spikes",
    ],
    href: "/features/chatbot",
    linkLabel: "Try a conversation",
    artifact: <ChatDemo />,
    tone: "mint",
  },
  {
    eyebrow: "Reputation · Add-on",
    title: "Every public mention, every 90 days, in one feed.",
    body: "Reddit, Yelp, Google, BBB, ApartmentRatings, Facebook, and the open web — sentiment-classified, theme-tagged, one click to reply. The reputation score above your dashboard is calculated directly from these.",
    bullets: [
      "Six sources scanned daily, deduped by canonical URL",
      "Sentiment + theme classification via Claude",
      "Doubles as the public audit lead magnet at /audit",
    ],
    href: "/audit",
    linkLabel: "See a live audit",
    artifact: <ReputationFeed />,
    tone: "lavender",
  },
  {
    eyebrow: "SEO + AEO · Add-on",
    title: "Pages that rank on Google and get cited by ChatGPT.",
    body: "Property pages written to rank in classic search and to be quoted by ChatGPT, Perplexity, Claude, and Gemini. Per-location coverage, refreshed weekly, scored continuously.",
    bullets: [
      "AEO coverage scored across 4 engines (Claude, ChatGPT, Gemini, Perplexity)",
      "Per-property keyword tracking via DataForSEO",
      "Content briefs refresh weekly based on citation gaps",
    ],
    href: "/features/seo-aeo",
    linkLabel: "Watch a citation",
    artifact: <SeoAnswer />,
    tone: "sky",
  },
  {
    eyebrow: "Conversion popups · Add-on",
    title: "Promo, referral, and reminder popups — one script tag.",
    body: "Design popups visually in 90 seconds. Paste one line of code on any site. Every conversion attributes back to the same lead pipeline that powers the weekly report.",
    bullets: [
      "Works on Wix, WordPress, Webflow, Squarespace, custom — anywhere",
      "Once-per-session smart frequency; never popup fatigue",
      "Every email captured lands as a lead with source tagged",
    ],
    href: "/features/popups",
    linkLabel: "Try the editor",
    // Popups has a full editor demo on its sub-page — keep this index
    // card visually consistent by rendering a script-tag illustration
    // instead of mounting the editor inline.
    artifact: <PopupsCallout />,
    tone: "lavender",
  },
  {
    eyebrow: "Website build · Add-on",
    title: "A property website that ships in 14 days.",
    body: "We design, build, and launch your property site under your domain — fully wired to your weekly report, identity pixel, AI chatbot, and ad audiences from day one. No web agency, no 90-day discovery phase, no broken handoff.",
    bullets: [
      "Designed and shipped on your domain in 14 days, not 14 weeks",
      "Pixel, chatbot, conversion tracking pre-wired the day the site goes live",
      "Editable inside the portal — copy, photos, unit details without an agency invoice",
    ],
    href: "/features/website-build",
    linkLabel: "See the build flow",
    // ConfigTabs is the same artifact the /features/website-build hero
    // uses — keeps the index card and the sub-page visually linked, so
    // the prospect lands on a familiar surface after clicking through.
    artifact: <ConfigTabs />,
    tone: "mint",
  },
];

export default function FeaturesIndexPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK }}>
      {/* Hero — single column, centered, mirrors /audit + /pricing rhythm. */}
      <section style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
          <p
            style={{
              color: ACCENT,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            All features
          </p>
          <h1
            className="mt-5 mx-auto max-w-4xl"
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(36px, 5.4vw, 68px)",
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-0.028em",
            }}
          >
            Everything {BRAND_NAME} does, in one place.
          </h1>
          <p
            className="mt-6 mx-auto max-w-2xl"
            style={{
              color: MUTED,
              fontFamily: "var(--font-sans)",
              fontSize: 18,
              lineHeight: 1.55,
            }}
          >
            Eight product surfaces, all running on your existing PMS, domain,
            and team. Scroll through the live demos below — click any feature
            for the full pitch.
          </p>
          <p
            className="mt-8"
            style={{
              color: MUTED,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {FEATURES.length} features · {FEATURES.length} live demos
          </p>
        </div>
      </section>

      {/* Feature rows — alternating layout */}
      <div>
        {FEATURES.map((f, i) => (
          <FeatureRow key={f.href + f.title} feature={f} index={i} />
        ))}
      </div>

      {/* Bottom CTA */}
      <section
        style={{
          borderTop: `1px solid ${BORDER}`,
          backgroundColor: SOFT_BG,
        }}
      >
        <div className="max-w-[900px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <h2
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.024em",
            }}
          >
            Want all of this for your property?
          </h2>
          <p
            className="mt-5 mx-auto max-w-xl"
            style={{
              color: MUTED,
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              lineHeight: 1.55,
            }}
          >
            Start with a free audit — runs against your live domain and comes
            back with real intelligence inside an hour. No call required.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/audit"
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Run a free audit
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold border"
              style={{
                borderColor: BORDER,
                color: INK,
                backgroundColor: "#FFFFFF",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FeatureRow — one section per feature.
//
// Alternates left/right based on the row index. The entire surface is a
// <Link> so clicking anywhere (the copy, the artifact frame, the CTA)
// routes to the sub-page. Keyboard users land on the same link via the
// "Open the full feature →" focusable affordance at the bottom of the
// copy column.
// ---------------------------------------------------------------------------

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const flipped = index % 2 === 1;
  const wrapperBg = index % 2 === 0 ? "#FFFFFF" : SOFT_BG;
  const numLabel = `0${index + 1}`;

  return (
    <section
      style={{
        backgroundColor: wrapperBg,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <Link
        href={feature.href}
        aria-label={`${feature.title} — ${feature.linkLabel}`}
        className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          // Subtle focus ring color — uses the accent so it reads as
          // "this whole block is a link" without overriding visual hierarchy.
          outlineColor: ACCENT,
        }}
      >
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
          <div
            className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
              flipped ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            {/* Copy column */}
            <div className="max-w-xl">
              <div className="flex items-center gap-3 mb-5">
                <span
                  style={{
                    color: ACCENT,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    fontWeight: 700,
                  }}
                >
                  {numLabel}
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 24,
                    height: 1,
                    backgroundColor: BORDER,
                  }}
                />
                <span
                  style={{
                    color: MUTED,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {feature.eyebrow}
                </span>
              </div>

              <h2
                style={{
                  color: INK,
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(28px, 3.6vw, 44px)",
                  fontWeight: 700,
                  lineHeight: 1.1,
                  letterSpacing: "-0.024em",
                }}
              >
                {feature.title}
              </h2>

              <p
                className="mt-5"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: 17,
                  lineHeight: 1.6,
                }}
              >
                {feature.body}
              </p>

              <ul className="mt-6 space-y-3">
                {feature.bullets.map((b) => (
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
                        backgroundColor: "rgba(37,99,235,0.14)",
                        color: ACCENT,
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
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

              <div
                className="mt-8 inline-flex items-center gap-2 group-hover:gap-3 transition-all"
                style={{
                  color: ACCENT,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {feature.linkLabel}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden
                >
                  <path
                    d="M2 7h9m0 0L7.5 3.5M11 7l-3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Artifact column */}
            <div className="min-w-0">
              <SoftFramedArtifact tone={feature.tone} padding="md" bare>
                {feature.artifact}
              </SoftFramedArtifact>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PopupsCallout — visual mockup of an actual popup as it would appear on
// a tenant property site. The full editor lives on /features/popups; this
// index card shows the artifact the operator is actually pitching to the
// owner — a promo modal floating over the live property page, with the
// LeaseStack conversion-attribution chip underneath showing the leads
// already flowing into the pipeline.
// ---------------------------------------------------------------------------

function PopupsCallout() {
  return (
    <div
      className="rounded-2xl bg-white overflow-hidden"
      style={{
        boxShadow:
          "0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)",
      }}
    >
      {/* Header chip — connects this artifact to the LeaseStack pipeline */}
      <div
        className="px-6 py-5 flex items-center justify-between gap-3"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: ACCENT,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: "#16A34A",
              boxShadow: "0 0 0 3px rgba(22,163,74,0.18)",
            }}
          />
          Live on site
        </span>
        <span
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Promo · Move-in
        </span>
      </div>

      {/* Faux property-site stage with the popup floating over it. */}
      <div
        className="relative"
        style={{
          backgroundColor: "#F1F5F9",
          minHeight: 380,
          overflow: "hidden",
        }}
      >
        {/* Browser URL bar */}
        <div
          className="px-4 py-2.5 flex items-center gap-2"
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <span
            aria-hidden
            className="flex items-center gap-1.5"
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#E2E8F0",
              }}
            />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#E2E8F0",
              }}
            />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#E2E8F0",
              }}
            />
          </span>
          <span
            className="ml-3 px-3 py-1 rounded-md inline-flex items-center gap-2"
            style={{
              backgroundColor: "#F1F5F9",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: MUTED,
              fontWeight: 500,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M3 5V3.5a3 3 0 016 0V5m-7 0h8v5H2V5z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            telegraph-commons.com
          </span>
        </div>

        {/* Faux page content underneath — softened so the popup pops. */}
        <div className="px-6 pt-6 pb-10" aria-hidden>
          {/* Hero strip on the property site */}
          <div
            className="rounded-lg"
            style={{
              height: 88,
              background:
                "linear-gradient(135deg, #CBD5E1 0%, #94A3B8 100%)",
              opacity: 0.55,
            }}
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-md"
                style={{
                  height: 56,
                  backgroundColor: "#FFFFFF",
                  border: `1px solid ${BORDER}`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        </div>

        {/* Dim overlay so the popup reads as foreground modal. */}
        <div
          aria-hidden
          className="absolute inset-x-0"
          style={{
            top: 41, // height of the browser bar
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.18)",
          }}
        />

        {/* The actual popup — what an operator's prospect sees. */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: 80,
            width: "min(86%, 320px)",
          }}
        >
          <div
            className="rounded-2xl bg-white relative"
            style={{
              boxShadow:
                "0 24px 48px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.08)",
              border: `1px solid ${BORDER}`,
              padding: 22,
            }}
          >
            {/* Close X — top right */}
            <button
              type="button"
              aria-label="Close popup"
              tabIndex={-1}
              className="absolute top-3 right-3 inline-flex items-center justify-center"
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                color: MUTED,
                background: "transparent",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1.5 1.5l7 7m0-7l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <p
              style={{
                color: ACCENT,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Promo · Move-in offer
            </p>
            <h3
              className="mt-3"
              style={{
                color: INK,
                fontFamily: "var(--font-sans)",
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              Save $500 on your first month.
            </h3>
            <p
              className="mt-2"
              style={{
                color: MUTED,
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Tour Telegraph Commons this week and move in by June 1 —
              we&apos;ll knock $500 off month one, no application fee.
            </p>

            <div
              className="mt-4 flex items-center rounded-md overflow-hidden"
              style={{
                border: `1px solid ${BORDER}`,
                backgroundColor: "#FFFFFF",
              }}
            >
              <span
                className="px-3"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  flex: 1,
                  paddingTop: 10,
                  paddingBottom: 10,
                }}
              >
                you@email.com
              </span>
              <span
                aria-hidden
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  backgroundColor: BORDER,
                }}
              />
              <span
                className="px-4 inline-flex items-center"
                style={{
                  backgroundColor: ACCENT,
                  color: "#FFFFFF",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 600,
                  paddingTop: 10,
                  paddingBottom: 10,
                  letterSpacing: "-0.01em",
                }}
              >
                Claim
              </span>
            </div>

            <p
              className="mt-3"
              style={{
                color: MUTED,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              One email · no spam
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline attribution strip — the LeaseStack-specific payoff. */}
      <div
        className="px-6 py-4 flex items-center justify-between gap-3"
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <span
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          This week
        </span>
        <span
          style={{
            color: INK,
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          41 conversions →{" "}
          <span style={{ color: ACCENT }}>/portal/leads</span>
        </span>
      </div>
    </div>
  );
}
