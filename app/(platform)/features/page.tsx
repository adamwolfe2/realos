import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Eye,
  MessageCircle,
  Star,
  Search,
  Layers,
  Globe,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import { SectionEyebrow } from "@/components/platform/section-eyebrow";
// Above-the-fold artifact (Weekly report) is imported eagerly so the
// first paint of /features carries it without waiting for an extra
// chunk fetch.
import { WeeklyReport } from "@/components/platform/artifacts/weekly-report";

// Below-the-fold artifact is split into its own chunk via `next/dynamic`
// so the index page isn't bundling every product demo synchronously.
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

// ---------------------------------------------------------------------------
// /features — index page.
//
// Two feature spotlights (Weekly report, Managed ads) get a full artifact
// split section each, the same rhythm they'd get on their own sub-pages.
// The remaining six features compress into a card grid, each linking to
// its dedicated sub-page for the full pitch and live demo.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const BORDER = "#e0e0e0";

export const metadata: Metadata = {
  title: `Features · ${BRAND_NAME}`,
  description:
    "Every feature in the LeaseStack platform, weekly report, managed ads, visitor identification, AI chatbot, reputation, SEO/AEO, conversion popups, and website build, with a live interactive demo of each.",
};

type GridFeature = {
  icon: ReactNode;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
};

const GRID_FEATURES: GridFeature[] = [
  {
    icon: <Eye className="h-5 w-5" aria-hidden="true" />,
    title: "Visitor identification",
    body: "Identity pixel resolves a meaningful share of anonymous traffic and routes the contact into your CRM and ad audiences.",
    href: "/features/pixel",
    linkLabel: "See the pixel firing",
  },
  {
    icon: <MessageCircle className="h-5 w-5" aria-hidden="true" />,
    title: "AI chatbot",
    body: "Trained on your property and unit mix. Captures contact info, qualifies intent, books tours, and emails floor plans overnight.",
    href: "/features/chatbot",
    linkLabel: "Try a conversation",
  },
  {
    icon: <Star className="h-5 w-5" aria-hidden="true" />,
    title: "Reputation",
    body: "Every public mention across Reddit, Yelp, Google, and the open web, sentiment-classified and one click to reply.",
    href: "/audit",
    linkLabel: "See a live audit",
  },
  {
    icon: <Search className="h-5 w-5" aria-hidden="true" />,
    title: "SEO + AEO",
    body: "Property pages written to rank on Google and get cited by ChatGPT, Perplexity, and Gemini. Refreshed weekly.",
    href: "/features/seo-aeo",
    linkLabel: "Watch a citation",
  },
  {
    icon: <Layers className="h-5 w-5" aria-hidden="true" />,
    title: "Conversion popups",
    body: "Design promo, referral, and reminder popups in 90 seconds. One script tag, attributed back to the lead pipeline.",
    href: "/features/popups",
    linkLabel: "Try the editor",
  },
  {
    icon: <Globe className="h-5 w-5" aria-hidden="true" />,
    title: "Website build",
    body: "A property site designed and shipped on your domain in 14 days, wired to the pixel, chatbot, and weekly report.",
    href: "/features/website-build",
    linkLabel: "See the build flow",
  },
];

export default function FeaturesIndexPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK }}>
      {/* Hero */}
      <section>
        <div className="max-w-[900px] mx-auto px-4 md:px-8 pt-20 md:pt-24 pb-16 text-center">
          <SectionEyebrow align="center" className="justify-center mb-5">
            Platform features
          </SectionEyebrow>
          <h1
            className="mx-auto max-w-3xl"
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(36px, 5.4vw, 60px)",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
            }}
          >
            Everything {BRAND_NAME} does, in one place.
          </h1>
          <p
            className="mt-6 mx-auto max-w-xl"
            style={{
              color: MUTED,
              fontFamily: "var(--font-sans)",
              fontSize: 18,
              lineHeight: 1.55,
            }}
          >
            Eight product surfaces on your existing PMS, domain, and team.
            Click any feature for the full pitch.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-primary">
              Request pilot
            </Link>
            <BookDemoLink className="btn-secondary">
              Book a demo
            </BookDemoLink>
          </div>
        </div>
      </section>

      {/* Spotlight 1: Weekly report */}
      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="max-w-xl">
              <h2
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                }}
              >
                The report writes itself every Monday at 7am.
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
                Leases attributed by source, channel ROI, anomalies surfaced,
                three concrete actions for the week. One page, read over
                coffee.
              </p>
              <FeatureBullets
                items={[
                  "Leases mapped to source from the pixel, UTM, and PMS join",
                  "Channel mix bar walks the brand blue ramp, not a rainbow",
                  "Three actions, ranked by dollar impact, ready to approve",
                ]}
              />
              <FeatureLink href="/sample-report" label="See a sample report" />
            </div>
            <div className="min-w-0">
              <SoftFramedArtifact tone="sky" padding="md" bare>
                <WeeklyReport />
              </SoftFramedArtifact>
            </div>
          </div>
        </div>
      </section>

      {/* Spotlight 2: Managed ads */}
      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center lg:[&>*:first-child]:order-2">
            <div className="max-w-xl">
              <h2
                style={{
                  color: INK,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                }}
              >
                Every dollar mapped to a signed lease, not an impression.
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
                Google, Meta, LinkedIn, and TikTok campaigns optimized against
                lease velocity, audited every week. Identity-pixel
                retargeting warms each audience at ID rates platform
                audiences never reach.
              </p>
              <FeatureBullets
                items={[
                  "Geo-fenced campaigns per property with weekly creative refresh",
                  "Cost per lease defended on a weekly review call",
                  "Pause or kill any campaign directly from the portal",
                ]}
              />
              <FeatureLink href="/features/ads" label="See it live" />
            </div>
            <div className="min-w-0">
              <SoftFramedArtifact tone="lavender" padding="md" bare>
                <AttributionBreakdown />
              </SoftFramedArtifact>
            </div>
          </div>
        </div>
      </section>

      {/* Grid: the rest of the platform */}
      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="text-center mb-14">
            <SectionEyebrow align="center" className="justify-center mb-5">
              More features
            </SectionEyebrow>
            <h2
              className="mx-auto max-w-2xl"
              style={{
                color: INK,
                fontFamily: "var(--font-display)",
                fontSize: "clamp(26px, 3vw, 36px)",
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
              The rest of the platform, live on every property.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GRID_FEATURES.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="group block p-6 h-full"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "2px",
                  boxShadow: `0 0 0 1px ${BORDER}`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "2px",
                    backgroundColor: "rgba(15,98,254,0.10)",
                    color: "#0f62fe",
                  }}
                >
                  {f.icon}
                </span>
                <h3
                  className="mt-4"
                  style={{
                    color: INK,
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    fontWeight: 500,
                    lineHeight: 1.25,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  className="mt-2"
                  style={{
                    color: MUTED,
                    fontFamily: "var(--font-sans)",
                    fontSize: 14.5,
                    lineHeight: 1.55,
                  }}
                >
                  {f.body}
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-2 group-hover:gap-3 transition-all"
                  style={{
                    color: "#0f62fe",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {f.linkLabel}
                  <svg
                    width="12"
                    height="12"
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
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[900px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <h2
            style={{
              color: INK,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
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
            Start with a free audit against your live domain. See what we
            find inside an hour, no call required.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-primary">
              Request pilot
            </Link>
            <BookDemoLink className="btn-secondary">
              Book a demo
            </BookDemoLink>
          </div>
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
  );
}

function FeatureLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-8 inline-flex items-center gap-2 group"
      style={{
        color: "#0f62fe",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {label}
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
    </Link>
  );
}
