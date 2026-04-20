import Link from "next/link";
import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { ProductTour } from "@/components/product-tour";
import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";

// ---------------------------------------------------------------------------
// Claude-inspired homepage.
//
// Editorial pacing, warm parchment canvas, Fraunces serif headlines, Inter
// sans for body/UI. Blue accent reserved for the primary CTA and a single
// hero emphasis span. Metadata and labels run on warm grays, not blue.
// No stock photos. No named competitors. No named reference customers.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <Hero />
      <WhatYouGet />
      <Comparison />
      <Weekly />
      <LiveExample />
      <ProductTourSection />
      <Numbers />
      <Modules />
      <Verticals />
      <Proof />
      <Faq />
      <FinalCta />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HERO — split layout. Left: message. Right: auto-advancing config artifact
// that walks through Intake → Build → Launch → Weekly.
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <SplitHero
      eyebrow="For multifamily and student-housing operators"
      headline="Eight vendors out."
      headlineAccent="One platform in."
      subhead="Your marketing site, ads, AI chatbot, CRM, and the Monday owner report — live on your domain in fourteen days. One login. One bill. Month-to-month."
      ctas={[
        { label: "Book a demo", href: "/onboarding" },
        { label: "See it live", href: "/#live", variant: "secondary" },
      ]}
      trust={[
        { value: "14 days", label: "First call to live" },
        { value: "One",     label: "Platform, one login" },
        { value: "Zero",    label: "Long-term contracts" },
      ]}
      artifact={<ConfigTabs />}
    />
  );
}

// ---------------------------------------------------------------------------
// WHAT YOU GET — deliverables checklist + 3-step timeline. Sets expectations
// before any interactive preview; answers "what am I actually buying?"
// ---------------------------------------------------------------------------

function WhatYouGet() {
  const { whatYouGet } = MARKETING.home;
  return (
    <section
      style={{
        backgroundColor: "#faf9f5",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{whatYouGet.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {whatYouGet.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {whatYouGet.body}
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-16">
          {whatYouGet.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                color: "#141413",
                lineHeight: 1.55,
                paddingTop: "6px",
                paddingBottom: "6px",
                borderBottom: "1px solid #f0eee6",
              }}
            >
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(47,111,229,0.10)",
                  color: "#2F6FE5",
                  marginTop: "2px",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M2 5.5L4.5 8L9 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <Timeline />
      </div>
    </section>
  );
}

function Timeline() {
  const { timeline } = MARKETING.home.whatYouGet;
  return (
    <div>
      <p
        className="eyebrow mb-6"
        style={{ color: "#87867f" }}
      >
        Timeline
      </p>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {timeline.map((step, i) => (
          <li
            key={step.day}
            className="relative p-6 md:p-7"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <p
              style={{
                color: "#87867f",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              {step.day}
            </p>
            <h3
              className="mt-2"
              style={{
                color: "#141413",
                fontFamily: "var(--font-display)",
                fontSize: "22px",
                fontWeight: 500,
                lineHeight: 1.25,
              }}
            >
              {step.title}
            </h3>
            <p
              className="mt-2"
              style={{
                color: "#5e5d59",
                fontFamily: "var(--font-sans)",
                fontSize: "14.5px",
                lineHeight: 1.55,
              }}
            >
              {step.body}
            </p>
            {i < timeline.length - 1 ? (
              <span
                aria-hidden="true"
                className="hidden md:block absolute top-1/2 -right-2"
                style={{
                  transform: "translateY(-50%)",
                  color: "#c2c0b6",
                  fontSize: "14px",
                }}
              >
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPARISON — side-by-side contrast: the vendor-stack status quo vs. a single
// managed product. Left column is muted (current pain), right column is the
// highlighted side with a subtle blue accent on check icons. No pricing rows.
// ---------------------------------------------------------------------------

function Comparison() {
  const { comparison } = MARKETING.home;
  return (
    <section
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{comparison.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {comparison.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {comparison.body}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="p-7 md:p-8"
            style={{
              backgroundColor: "#faf9f5",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <p
              className="mb-6 inline-flex items-center gap-2"
              style={{
                color: "#87867f",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#c2c0b6",
                }}
              />
              {comparison.leftLabel}
            </p>
            <ul className="space-y-0">
              {comparison.rows.map((row, i) => (
                <li
                  key={row.old}
                  className="flex items-start gap-3"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    color: "#5e5d59",
                    lineHeight: 1.55,
                    paddingTop: "14px",
                    paddingBottom: "14px",
                    borderTop: i > 0 ? "1px solid #f0eee6" : "none",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "#f0eee6",
                      color: "#87867f",
                      marginTop: "2px",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 2l6 6M8 2l-6 6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span>{row.old}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="p-7 md:p-8"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <p
              className="mb-6 inline-flex items-center gap-2"
              style={{
                color: "#2F6FE5",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#2F6FE5",
                }}
              />
              {comparison.rightLabel}
            </p>
            <ul className="space-y-0">
              {comparison.rows.map((row, i) => (
                <li
                  key={row.new}
                  className="flex items-start gap-3"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    color: "#141413",
                    lineHeight: 1.55,
                    paddingTop: "14px",
                    paddingBottom: "14px",
                    borderTop: i > 0 ? "1px solid #f0eee6" : "none",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(47,111,229,0.10)",
                      color: "#2F6FE5",
                      marginTop: "2px",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M2 5.5L4.5 8L9 3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{row.new}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// WEEKLY — a week-in-the-life scene. Four cards map to Monday / Tuesday /
// Thursday / Ongoing moments so the buyer can picture the rhythm of operating
// on the platform without a status meeting.
// ---------------------------------------------------------------------------

function Weekly() {
  const { weekly } = MARKETING.home;
  return (
    <section
      style={{
        backgroundColor: "#faf9f5",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{weekly.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {weekly.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {weekly.body}
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {weekly.items.map((item) => (
            <li
              key={item.title}
              className="p-6 md:p-7 flex flex-col"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 0 0 1px #f0eee6",
              }}
            >
              <p
                className="flex items-center justify-between gap-2"
                style={{
                  color: "#87867f",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                <span style={{ color: "#141413" }}>{item.day}</span>
                <span>{item.time}</span>
              </p>
              <h3
                className="mt-3"
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "19px",
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {item.title}
              </h3>
              <p
                className="mt-3"
                style={{
                  color: "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14.5px",
                  lineHeight: 1.6,
                }}
              >
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// LIVE EXAMPLE — abstract production proof. Two cards, two live surfaces.
// No customer names, no hostnames, no PMS brands. Let prospects click in and
// see the deployment; keep the marketing surface enterprise-generic.
// ---------------------------------------------------------------------------

function LiveExample() {
  const { liveExample } = MARKETING.home;
  return (
    <section
      id="live"
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{liveExample.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {liveExample.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {liveExample.body}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LiveCard
            href={liveExample.siteHref}
            label={liveExample.siteLabel}
            caption={liveExample.siteCaption}
            badge="Live deployment"
            external
          />
          <LiveCard
            href={liveExample.portalHref}
            label={liveExample.portalLabel}
            caption={liveExample.portalCaption}
            badge="Operator portal"
          />
        </div>
      </div>
    </section>
  );
}

function LiveCard({
  href,
  label,
  caption,
  badge,
  external = false,
}: {
  href: string;
  label: string;
  caption: string;
  badge: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="group block p-7"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #f0eee6",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="mb-2 inline-flex items-center gap-2"
            style={{
              color: "#87867f",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#3a7d44",
              }}
            />
            {badge}
          </p>
          <h3 className="heading-sub" style={{ color: "#141413" }}>
            {label}
          </h3>
          <p
            className="mt-3 max-w-md"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              lineHeight: 1.6,
            }}
          >
            {caption}
          </p>
        </div>
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            color: "#5e5d59",
            boxShadow: "0 0 0 1px #e8e6dc",
          }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d={
                external
                  ? "M5 9L9 5M9 5H5.5M9 5V8.5"
                  : "M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
              }
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// PRODUCT TOUR SECTION - the interactive CRM preview
// ---------------------------------------------------------------------------

function ProductTourSection() {
  return (
    <section id="product-tour" style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-20 pb-20 md:pb-28 md:pt-24">
        <div className="text-center mb-8 md:mb-10 max-w-[720px] mx-auto">
          <p className="eyebrow mb-4">Interactive preview</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Click through the actual portal.
          </h2>
          <p
            className="mt-3 mx-auto"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#5e5d59",
            }}
          >
            Every tab in the sidebar below is a real surface in the platform.
            Open a lead. Read a chatbot conversation. Filter the creative
            queue. This is what ships on day one.
          </p>
        </div>
        <ProductTour />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// NUMBERS - four big stats, Claude editorial treatment
// ---------------------------------------------------------------------------

const METRICS = [
  {
    value: "One",
    label: "Platform replaces five-plus vendors: site, chatbot, ads, CRM, creative.",
  },
  {
    value: "24/7",
    label: "AI chatbot that answers, qualifies, and captures leads after hours.",
  },
  {
    value: "48h",
    label: "Turnaround on every managed creative asset: ads, landing blocks, emails.",
  },
  {
    value: "14 days",
    label: "From intake call to a custom site live on your domain with full stack.",
  },
];

function Numbers() {
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <p className="eyebrow mb-10 text-center">The numbers we hit</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-4">
          {METRICS.map((m, i) => (
            <div
              key={m.value}
              className="px-0 lg:px-6 text-center lg:text-left"
              style={{
                borderLeft: i > 0 ? "1px solid #e8e6dc" : "none",
              }}
            >
              <p
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(40px, 5.2vw, 56px)",
                  fontWeight: 500,
                  lineHeight: 1.05,
                  letterSpacing: "-0.005em",
                }}
              >
                {m.value}
              </p>
              <p
                className="mt-4 mx-auto lg:mx-0 max-w-[280px]"
                style={{
                  color: "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.55,
                }}
              >
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// MODULES - warm card grid, no photos
// ---------------------------------------------------------------------------

function Modules() {
  return (
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-14">
          <p className="eyebrow mb-4">Inside the platform</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Every module the operator stack needs, in one login.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            Nothing to wire up. Nothing to learn. We run it. You review the
            weekly report.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MARKETING.home.modules.map((m) => (
            <div
              key={m.title}
              className="p-6"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 0 0 1px #f0eee6",
              }}
            >
              <h3 className="heading-card" style={{ color: "#141413" }}>
                {m.title}
              </h3>
              <p
                className="mt-3"
                style={{
                  color: "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                }}
              >
                {m.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// VERTICALS - text-only cards, no photos
// ---------------------------------------------------------------------------

const VERTICALS = [
  {
    href: "/student-housing",
    label: "Student housing",
    tag: "Pre-lease cycles, parent decision-makers, campus-proximity plays.",
  },
  {
    href: "/multifamily",
    label: "Multifamily",
    tag: "Portfolio rollups, per-property retargeting, fair-housing-safe creative.",
  },
  {
    href: "/senior-living",
    label: "Senior living",
    tag: "Family-first nurture, patient conversion, compliance-aware forms.",
  },
  {
    href: "/commercial",
    label: "Commercial",
    tag: "Office, industrial, retail. Broker-aware, spec-sheet driven. Coming soon.",
  },
];

function Verticals() {
  return (
    <section style={{ backgroundColor: "#f5f4ed", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-14">
          <p className="eyebrow mb-4">Same platform, tailored</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Built for the way your vertical actually operates.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VERTICALS.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className="group block p-7"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 0 0 1px #f0eee6",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="heading-sub" style={{ color: "#141413" }}>
                    {v.label}
                  </h3>
                  <p
                    className="mt-3 max-w-md"
                    style={{
                      color: "#5e5d59",
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      lineHeight: 1.6,
                    }}
                  >
                    {v.tag}
                  </p>
                </div>
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    color: "#5e5d59",
                    boxShadow: "0 0 0 1px #e8e6dc",
                  }}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PROOF - dark section, product-positioning (no named customer)
// ---------------------------------------------------------------------------

function Proof() {
  const { proof } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#141413" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32 text-center">
        <p
          className="mb-6"
          style={{
            color: "#87867f",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          The platform
        </p>
        <h2
          className="mx-auto max-w-[860px]"
          style={{
            color: "#faf9f5",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px, 4vw, 48px)",
            fontWeight: 500,
            lineHeight: 1.15,
          }}
        >
          {proof.heading}
        </h2>
        <p
          className="mx-auto mt-5 max-w-[620px]"
          style={{
            color: "#b0aea5",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
          }}
        >
          {proof.body}
        </p>

        <div className="mt-14 flex flex-wrap items-start justify-center gap-x-16 gap-y-8">
          <BigStat value="One" label="Platform, one login" />
          <BigStat value="Two" label="Weeks from intake to live" />
          <BigStat value="Zero" label="Long-term contracts" />
        </div>

        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/onboarding" className="btn-primary">
            Book a demo
          </Link>
          <Link href="/#live" className="btn-secondary-dark">
            See it live
          </Link>
        </div>
      </div>
    </section>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p
        style={{
          color: "#faf9f5",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 4.8vw, 56px)",
          fontWeight: 500,
          lineHeight: 1.05,
        }}
      >
        {value}
      </p>
      <p
        className="mt-2 mx-auto max-w-[180px]"
        style={{
          color: "#87867f",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ — answers the questions that stall every first-call deal
// ---------------------------------------------------------------------------

function Faq() {
  const { faq } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="text-center mb-12 md:mb-14">
          <p className="eyebrow mb-4">{faq.eyebrow}</p>
          <h2
            className="mx-auto max-w-[640px]"
            style={{
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 3.4vw, 42px)",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.005em",
            }}
          >
            {faq.headline}
          </h2>
        </div>

        <ul
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 0 0 1px #f0eee6",
            overflow: "hidden",
          }}
        >
          {faq.items.map((item, i) => (
            <li
              key={item.q}
              style={{
                borderTop: i > 0 ? "1px solid #f0eee6" : "none",
              }}
            >
              <details className="group">
                <summary
                  className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "17px",
                    fontWeight: 500,
                    color: "#141413",
                    lineHeight: 1.35,
                  }}
                >
                  <span>{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="flex-shrink-0 inline-flex items-center justify-center transition-transform group-open:rotate-45"
                    style={{
                      width: "24px",
                      height: "24px",
                      color: "#87867f",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 2v10M2 7h10"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </summary>
                <div
                  className="px-6 pb-5 -mt-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    lineHeight: 1.65,
                    color: "#5e5d59",
                    maxWidth: "680px",
                  }}
                >
                  {item.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FINAL CTA
// ---------------------------------------------------------------------------

function FinalCta() {
  const { final } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32 text-center">
        <h2
          className="mx-auto max-w-[780px]"
          style={{
            color: "#141413",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 4.4vw, 52px)",
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.005em",
          }}
        >
          {final.heading}
        </h2>
        <p
          className="mx-auto mt-5 max-w-[560px]"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
          }}
        >
          {final.body}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={final.primaryHref} className="btn-primary">
            {final.primaryCta}
          </Link>
          <Link href="/#live" className="btn-secondary">
            See it live
          </Link>
        </div>
      </div>
    </section>
  );
}
