import Link from "next/link";
import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { HeroDemo } from "@/components/platform/hero-demo";
import { MetricsRow } from "@/components/platform/metrics-row";
import { PortalPreview } from "@/components/platform/portal-preview";
import { ModuleShowcase } from "@/components/platform/module-showcase";

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <Hero />
      <MetricsRow />
      <PortalPreview />
      <ModuleShowcase />
      <Proof />
      <FinalCta />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HERO
// Left column: tight headline, one-sentence subhead, two CTAs, two proof lines.
// Right column: interactive HeroDemo card (auto-advancing tabs).
// DECISION: subhead trimmed to a single claim. All expanded reasoning moved
// into the demo panes themselves; the product does the selling.
// ---------------------------------------------------------------------------

function Hero() {
  const { hero } = MARKETING.home;
  return (
    <section
      className="relative overflow-hidden"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-20 md:pt-24 pb-20 md:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-6">
          <p
            className="font-mono text-[11px] uppercase mb-5"
            style={{ color: "var(--text-muted)", letterSpacing: "0.18em" }}
          >
            {hero.eyebrow}
          </p>
          <h1
            className="font-serif font-normal leading-[1.04]"
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(38px, 5.5vw, 64px)",
              letterSpacing: "-0.015em",
            }}
          >
            Marketing infrastructure
            <br />
            that <span style={{ color: "var(--blue)" }}>actually fills units.</span>
          </h1>
          <p
            className="mt-6 text-[16px] leading-relaxed max-w-xl"
            style={{ color: "var(--text-body)" }}
          >
            One managed platform replaces Conversion Logix, your site builder,
            chatbot vendor, and three freelance designers. We run all of it.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={hero.primaryHref}
              className="font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                backgroundColor: "var(--blue)",
                color: "white",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {hero.primaryCta}
            </Link>
            <Link
              href={hero.secondaryHref}
              className="font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                border: "1px solid var(--border-strong)",
                color: "var(--text-headline)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {hero.secondaryCta}
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            <ProofLine
              value="14 days"
              label="first call to live site"
            />
            <ProofLine
              value="$1,497/mo"
              label="from, one retainer, no setup fee"
            />
          </div>
        </div>

        <aside className="lg:col-span-6">
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
        className="font-serif text-[18px]"
        style={{ color: "var(--text-headline)", fontWeight: 500 }}
      >
        {value}
      </span>
      <span
        className="font-mono text-[10px]"
        style={{
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROOF, case study block on navy
// ---------------------------------------------------------------------------

function Proof() {
  const { proof } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "var(--bg-blue-dark)", color: "white" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <p
            className="font-mono text-[11px] uppercase mb-4"
            style={{ opacity: 0.6, letterSpacing: "0.18em" }}
          >
            Proof
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-normal leading-[1.1]">
            {proof.heading}
          </h2>
          <p
            className="font-mono text-sm mt-5 leading-relaxed max-w-xl"
            style={{ opacity: 0.85 }}
          >
            {proof.body}
          </p>
          <div
            className="mt-8 inline-flex items-center gap-3 px-4 py-2 rounded-full"
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "#FACC15" }}
            />
            <span className="font-mono text-[11px]" style={{ opacity: 0.8, letterSpacing: "0.08em" }}>
              Shipped &middot; Telegraph Commons live on our stack
            </span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            className="p-8 md:p-10"
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "14px",
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            <p
              className="font-mono text-[10px] mb-2"
              style={{ opacity: 0.6, letterSpacing: "0.14em" }}
            >
              CASE STUDY
            </p>
            <p className="font-serif text-[26px] font-normal leading-tight">
              {proof.caseStudy.client}
            </p>
            <p className="font-mono text-xs mt-1" style={{ opacity: 0.7 }}>
              {proof.caseStudy.city}
            </p>
            <div className="mt-8">
              <p
                className="font-serif font-normal leading-none"
                style={{ color: "#FACC15", fontSize: "clamp(48px, 7vw, 68px)" }}
              >
                {proof.caseStudy.stat}
              </p>
              <p className="font-mono text-[11px] mt-3" style={{ opacity: 0.7 }}>
                {proof.caseStudy.window}
              </p>
            </div>
            <div
              className="mt-8 pt-6 grid grid-cols-2 gap-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
            >
              <div>
                <p className="font-serif text-xl">31</p>
                <p className="font-mono text-[10px]" style={{ opacity: 0.7 }}>
                  Tours booked week 1
                </p>
              </div>
              <div>
                <p className="font-serif text-xl">$0</p>
                <p className="font-mono text-[10px]" style={{ opacity: 0.7 }}>
                  Design fees charged
                </p>
              </div>
            </div>
          </div>
        </div>
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
    <section>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24">
        <div
          className="p-10 md:p-16 relative overflow-hidden"
          style={{
            backgroundColor: "var(--bg-blue-dark)",
            borderRadius: "16px",
            color: "white",
          }}
        >
          <p
            className="font-mono text-[11px] uppercase mb-5"
            style={{ opacity: 0.65, letterSpacing: "0.18em" }}
          >
            Let's talk
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-normal max-w-3xl leading-[1.08]">
            {final.heading}
          </h2>
          <p
            className="font-mono text-sm leading-relaxed mt-5 max-w-xl"
            style={{ opacity: 0.85 }}
          >
            {final.body}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={final.primaryHref}
              className="font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                backgroundColor: "white",
                color: "var(--bg-blue-dark)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {final.primaryCta}
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                border: "1px solid rgba(255,255,255,0.35)",
                color: "white",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
