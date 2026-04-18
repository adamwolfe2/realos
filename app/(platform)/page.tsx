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
    <div
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-body)",
      }}
    >
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
// Linear-style: near-black canvas, display type at weight 510 with aggressive
// negative letter-spacing, indigo radial glow behind the demo card, subtle
// grid fade pattern.
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section
      className="relative overflow-hidden hero-glow"
      style={{
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="absolute inset-0 grid-fade pointer-events-none" aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-20 md:pt-28 pb-20 md:pb-28 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center relative z-10">
        <div className="lg:col-span-6">
          <div className="inline-flex items-center gap-2 mb-7">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
              style={{
                backgroundColor: "rgba(94,106,210,0.12)",
                color: "var(--accent-bright)",
                border: "1px solid rgba(94,106,210,0.3)",
                fontWeight: 510,
                letterSpacing: "-0.01em",
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: "var(--accent-bright)",
                  boxShadow: "0 0 8px var(--accent-glow)",
                }}
              />
              Live today on Telegraph Commons
            </span>
          </div>
          <h1
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(44px, 6.2vw, 72px)",
              fontWeight: 510,
              letterSpacing: "-0.028em",
              lineHeight: 1.02,
            }}
          >
            Marketing infrastructure
            <br />
            that{" "}
            <span
              style={{
                background:
                  "linear-gradient(90deg, var(--accent-bright) 0%, var(--accent-hover) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              fills units.
            </span>
          </h1>
          <p
            className="mt-6 text-[17px] leading-[1.55] max-w-xl"
            style={{
              color: "var(--text-muted)",
              letterSpacing: "-0.011em",
            }}
          >
            One managed platform replaces Conversion Logix, your site builder,
            chatbot vendor, and three freelance designers. We run all of it.
          </p>
          <div className="mt-9 flex flex-wrap gap-2.5">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md btn-accent text-[14px]"
              style={{ fontWeight: 510 }}
            >
              Book a demo
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 6h8m0 0L7 3m3 3L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md btn-ghost text-[14px]"
              style={{ fontWeight: 510 }}
            >
              See pricing
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            <ProofLine value="<14 days" label="first call to live site" />
            <span
              className="hidden sm:inline-block w-px h-4"
              style={{ backgroundColor: "var(--border-standard)" }}
              aria-hidden="true"
            />
            <ProofLine value="$1,497 / mo" label="from, one retainer" />
            <span
              className="hidden sm:inline-block w-px h-4"
              style={{ backgroundColor: "var(--border-standard)" }}
              aria-hidden="true"
            />
            <ProofLine value="0" label="setup fees" />
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
        className="text-[16px]"
        style={{
          color: "var(--text-headline)",
          fontWeight: 590,
          letterSpacing: "-0.015em",
        }}
      >
        {value}
      </span>
      <span
        className="font-mono text-[10px]"
        style={{
          color: "var(--text-subtle)",
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
// PROOF - dark translucent, indigo radial behind case-study card
// ---------------------------------------------------------------------------

function Proof() {
  const { proof } = MARKETING.home;
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 80% 50%, rgba(94,106,210,0.15) 0%, transparent 55%)",
        }}
      />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative">
        <div className="lg:col-span-7">
          <p className="eyebrow">Proof</p>
          <h2
            className="mt-4"
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(30px, 3.8vw, 44px)",
              fontWeight: 510,
              letterSpacing: "-0.022em",
              lineHeight: 1.08,
            }}
          >
            {proof.heading}
          </h2>
          <p
            className="text-[15px] mt-5 leading-relaxed max-w-xl"
            style={{ color: "var(--text-muted)", letterSpacing: "-0.011em" }}
          >
            {proof.body}
          </p>
          <div
            className="mt-8 inline-flex items-center gap-3 px-4 py-2 rounded-full"
            style={{
              border: "1px solid var(--border-standard)",
              backgroundColor: "rgba(255,255,255,0.03)",
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                backgroundColor: "var(--success)",
                boxShadow: "0 0 10px rgba(16,185,129,0.5)",
              }}
            />
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--text-body)", letterSpacing: "0.06em" }}
            >
              Shipped &middot; Telegraph Commons live on our stack
            </span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            className="p-8 md:p-10 relative overflow-hidden"
            style={{
              border: "1px solid var(--border-standard)",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.02)",
              boxShadow:
                "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset",
            }}
          >
            <span
              className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(circle at center, var(--accent-glow) 0%, transparent 70%)",
              }}
            />
            <p className="eyebrow">Case study</p>
            <p
              className="mt-4"
              style={{
                color: "var(--text-headline)",
                fontSize: "26px",
                fontWeight: 510,
                letterSpacing: "-0.015em",
                lineHeight: 1.15,
              }}
            >
              {proof.caseStudy.client}
            </p>
            <p
              className="text-[12px] mt-1"
              style={{ color: "var(--text-subtle)" }}
            >
              {proof.caseStudy.city}
            </p>
            <div className="mt-8">
              <p
                className="leading-none"
                style={{
                  color: "var(--accent-bright)",
                  fontSize: "clamp(48px, 7vw, 72px)",
                  fontWeight: 510,
                  letterSpacing: "-0.03em",
                }}
              >
                {proof.caseStudy.stat}
              </p>
              <p
                className="font-mono text-[11px] mt-3"
                style={{ color: "var(--text-subtle)", letterSpacing: "0.06em" }}
              >
                {proof.caseStudy.window}
              </p>
            </div>
            <div
              className="mt-8 pt-6 grid grid-cols-2 gap-4"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              <div>
                <p
                  className="text-[20px]"
                  style={{
                    color: "var(--text-headline)",
                    fontWeight: 510,
                    letterSpacing: "-0.015em",
                  }}
                >
                  31
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--text-subtle)" }}>
                  Tours booked, week 1
                </p>
              </div>
              <div>
                <p
                  className="text-[20px]"
                  style={{
                    color: "var(--text-headline)",
                    fontWeight: 510,
                    letterSpacing: "-0.015em",
                  }}
                >
                  $0
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--text-subtle)" }}>
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
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <div
          className="p-10 md:p-16 relative overflow-hidden"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-standard)",
            borderRadius: "20px",
            boxShadow:
              "0 20px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
          }}
        >
          <span
            className="absolute -top-40 -left-40 w-80 h-80 rounded-full pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle at center, var(--accent-glow) 0%, transparent 70%)",
            }}
          />
          <span
            className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle at center, rgba(113,112,255,0.12) 0%, transparent 70%)",
            }}
          />
          <p className="eyebrow relative">Let's talk</p>
          <h2
            className="mt-4 relative max-w-3xl"
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(36px, 5vw, 56px)",
              fontWeight: 510,
              letterSpacing: "-0.028em",
              lineHeight: 1.05,
            }}
          >
            {final.heading}
          </h2>
          <p
            className="text-[16px] mt-5 leading-relaxed max-w-xl relative"
            style={{ color: "var(--text-muted)", letterSpacing: "-0.011em" }}
          >
            {final.body}
          </p>
          <div className="mt-10 flex flex-wrap gap-2.5 relative">
            <Link
              href={final.primaryHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md btn-accent text-[14px]"
              style={{ fontWeight: 510 }}
            >
              {final.primaryCta}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md btn-ghost text-[14px]"
              style={{ fontWeight: 510 }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
