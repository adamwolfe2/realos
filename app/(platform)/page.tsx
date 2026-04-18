import Link from "next/link";
import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { HeroDemo } from "@/components/platform/hero-demo";

// ---------------------------------------------------------------------------
// Claude-inspired homepage.
//
// Editorial pacing, warm parchment canvas, Fraunces serif headlines, Inter
// sans for body/UI. Terracotta reserved for primary CTAs and brand accents.
// No stock photos. No named competitors. No named reference customers.
// The interactive product demo is the hero centerpiece.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <Hero />
      <Numbers />
      <Modules />
      <Verticals />
      <Proof />
      <FinalCta />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HERO - editorial layout with the interactive product demo on the right
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: "#f5f4ed",
        borderBottom: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-20 md:pt-28 pb-16 md:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-5">
          <p className="eyebrow mb-6">For real estate operators</p>
          <h1 className="display-hero" style={{ color: "#141413" }}>
            Marketing infrastructure{" "}
            <span style={{ color: "#c96442" }}>that fills units.</span>
          </h1>
          <p
            className="mt-6 max-w-xl"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
              color: "#5e5d59",
              fontWeight: 400,
            }}
          >
            One managed platform replaces the five tools you&apos;re stitching
            together today. A custom site on your domain, live listings, an
            identity pixel, an AI chatbot, and a CRM that actually closes the
            loop.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/onboarding" className="btn-primary">
              Book a demo
            </Link>
            <Link href="/pricing" className="btn-secondary">
              See pricing
            </Link>
          </div>
          <div
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "#87867f",
            }}
          >
            <ProofLine value="14 days" label="From first call to live" />
            <span
              className="hidden sm:inline-block w-px h-4"
              style={{ backgroundColor: "#e8e6dc" }}
              aria-hidden="true"
            />
            <ProofLine value="$1,497" label="From, monthly retainer" />
            <span
              className="hidden sm:inline-block w-px h-4"
              style={{ backgroundColor: "#e8e6dc" }}
              aria-hidden="true"
            />
            <ProofLine value="Zero" label="Setup fees, zero contracts" />
          </div>
        </div>

        <aside className="lg:col-span-7">
          <HeroDemo />
        </aside>
      </div>
    </section>
  );
}

function ProofLine({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        style={{
          color: "#141413",
          fontFamily: "var(--font-display)",
          fontSize: "18px",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
      <span style={{ color: "#87867f", fontSize: "12px" }}>{label}</span>
    </div>
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
    value: "95%",
    label: "Of site visitors named and routed to nurture, not just form-fillers.",
  },
  {
    value: "48h",
    label: "Turnaround on every managed creative asset: ads, landing blocks, emails.",
  },
  {
    value: "2 wks",
    label: "From intake call to a custom site live on your domain with full stack.",
  },
];

function Numbers() {
  return (
    <section style={{ backgroundColor: "#faf9f5" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <p className="eyebrow mb-10 text-center">The numbers we hit</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-4">
          {METRICS.map((m, i) => (
            <div
              key={m.value}
              className="px-0 lg:px-6 text-center lg:text-left"
              style={{
                borderLeft: i > 0 ? "1px solid #f0eee6" : "none",
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
    <section style={{ backgroundColor: "#f5f4ed" }}>
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
                backgroundColor: "#faf9f5",
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
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
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
                    color: "#c96442",
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
          <Link href="/pricing" className="btn-secondary-dark">
            See pricing
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
// FINAL CTA
// ---------------------------------------------------------------------------

function FinalCta() {
  const { final } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
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
          <Link href="/pricing" className="btn-secondary">
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
