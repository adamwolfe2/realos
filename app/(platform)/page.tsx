import Link from "next/link";
import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <Hero />
      <Pains />
      <HowItWorks />
      <Modules />
      <Verticals />
      <Proof />
      <Comparison />
      <FinalCta />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HERO
// Cream background, serif headline, mono microcopy label, blue accent CTA.
// Pulls the stack graphic (mocked as a small module grid on the right column).
// ---------------------------------------------------------------------------

function Hero() {
  const { hero } = MARKETING.home;
  return (
    <section
      className="relative overflow-hidden"
      style={{
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
        <div className="lg:col-span-3">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            {hero.eyebrow}
          </p>
          <h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-normal leading-[1.04]"
            style={{ color: "var(--text-headline)" }}
          >
            {hero.headline.split(".")[0]}.
            <br />
            <span style={{ color: "var(--blue)" }}>
              {hero.headline.split(".")[1]?.trim() || ""}
            </span>
          </h1>
          <p
            className="mt-6 text-base md:text-lg leading-relaxed max-w-xl"
            style={{ color: "var(--text-body)" }}
          >
            {hero.subhead}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
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
          <p
            className="mt-10 font-mono text-[11px] uppercase tracking-[0.15em] max-w-md"
            style={{ color: "var(--text-muted)" }}
          >
            {hero.microProof}
          </p>
        </div>

        <aside className="lg:col-span-2">
          <HeroStack />
        </aside>
      </div>
    </section>
  );
}

function HeroStack() {
  const tiles = [
    { title: "Site + listings", body: "Live AppFolio sync" },
    { title: "Identity pixel", body: "Name the 95%" },
    { title: "AI chatbot", body: "2 a.m. lead capture" },
    { title: "Managed ads", body: "Creative in 48 hrs" },
    { title: "Nurture + CRM", body: "Day 1 through year 1" },
    { title: "SEO + AEO", body: "Google and ChatGPT" },
  ];
  return (
    <div
      className="p-6 bg-white"
      style={{
        border: "1px solid var(--border-strong)",
        borderRadius: "14px",
      }}
    >
      <p
        className="font-mono text-[10px] uppercase tracking-[0.18em] mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        One platform, nine modules
      </p>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div
            key={t.title}
            className="p-4"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "8px",
              backgroundColor: "var(--bg-primary)",
            }}
          >
            <p
              className="font-serif text-sm font-semibold"
              style={{ color: "var(--text-headline)" }}
            >
              {t.title}
            </p>
            <p
              className="font-mono text-[10px] mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              {t.body}
            </p>
          </div>
        ))}
      </div>
      <div
        className="mt-5 flex items-center justify-between text-xs"
        style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}
      >
        <span className="font-mono" style={{ color: "var(--text-muted)" }}>
          One retainer
        </span>
        <span
          className="font-serif font-semibold"
          style={{ color: "var(--text-headline)" }}
        >
          From $1,497/mo
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAIN STRIP, three columns, Wholesail's heavy navy treatment
// ---------------------------------------------------------------------------

function Pains() {
  return (
    <section style={{ backgroundColor: "var(--bg-blue-dark)", color: "white" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
          style={{ opacity: 0.6 }}
        >
          Why operators come looking
        </p>
        <h2 className="font-serif text-3xl md:text-4xl font-normal max-w-3xl">
          The three complaints we hear every single demo call.
        </h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {MARKETING.home.pains.map((p, i) => (
            <div
              key={p.title}
              className="p-6"
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "10px",
                backgroundColor: "rgba(255,255,255,0.02)",
              }}
            >
              <span
                className="font-mono text-[10px]"
                style={{ opacity: 0.5 }}
              >
                0{i + 1}
              </span>
              <h3 className="font-serif text-lg md:text-xl font-normal mt-3 leading-snug">
                {p.title}
              </h3>
              <p
                className="font-mono text-xs mt-4 leading-relaxed"
                style={{ opacity: 0.8 }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// HOW IT WORKS, numbered steps in a shell border grid
// ---------------------------------------------------------------------------

function HowItWorks() {
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          How it works
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-end">
          <h2
            className="font-serif text-3xl md:text-4xl font-normal leading-tight lg:col-span-2"
            style={{ color: "var(--text-headline)" }}
          >
            From first call to live site in two weeks.
          </h2>
          <p
            className="font-mono text-xs leading-relaxed"
            style={{ color: "var(--text-body)" }}
          >
            Typical onboarding is nine to fourteen days. No sign-up form. Every
            engagement starts with a 30 minute demo.
          </p>
        </div>
        <ol
          className="mt-12 grid grid-cols-1 md:grid-cols-4"
          style={{ border: "1px solid var(--border-strong)", borderRadius: "10px" }}
        >
          {MARKETING.home.howItWorks.map((s, i) => (
            <li
              key={s.step}
              className="p-6"
              style={{
                borderBottom:
                  i < 3 ? "1px solid var(--border)" : "none",
                borderRight:
                  i < 3 ? "1px solid var(--border)" : "none",
                backgroundColor: "var(--bg-white)",
              }}
            >
              <p
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--blue)" }}
              >
                {s.step}
              </p>
              <h3
                className="font-serif text-lg font-semibold mt-2"
                style={{ color: "var(--text-headline)" }}
              >
                {s.title}
              </h3>
              <p
                className="font-mono text-xs mt-3 leading-relaxed"
                style={{ color: "var(--text-body)" }}
              >
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// MODULES GRID, 9 tiles on blue-light background
// ---------------------------------------------------------------------------

function Modules() {
  return (
    <section
      style={{
        backgroundColor: "var(--blue-light)",
        borderTop: "1px solid var(--blue-border)",
        borderBottom: "1px solid var(--blue-border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--blue)" }}
        >
          Platform at a glance
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl font-normal max-w-3xl"
          style={{ color: "var(--text-headline)" }}
        >
          One platform replaces the five tools you were stitching together.
        </h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {MARKETING.home.modules.map((m) => (
            <div
              key={m.title}
              className="p-5 bg-white transition-colors"
              style={{
                border: "1px solid var(--border-strong)",
                borderRadius: "10px",
              }}
            >
              <h3
                className="font-serif text-base font-semibold"
                style={{ color: "var(--text-headline)" }}
              >
                {m.title}
              </h3>
              <p
                className="font-mono text-xs leading-relaxed mt-3"
                style={{ color: "var(--text-body)" }}
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
// VERTICALS, link cards to each vertical page
// ---------------------------------------------------------------------------

function Verticals() {
  const items = [
    {
      href: "/student-housing",
      label: "Student housing",
      body: "Sprint pricing cycles. International applicants. Turn-heavy calendars. Our wedge vertical, live today.",
    },
    {
      href: "/multifamily",
      label: "Multifamily",
      body: "Portfolio rollups, fair-housing-safe creative, per-property retargeting pools.",
    },
    {
      href: "/senior-living",
      label: "Senior living",
      body: "Patient nurture. Family-first copy. Compliance-aware forms.",
    },
    {
      href: "/commercial",
      label: "Commercial",
      body: "Office, retail, industrial. Coming Q3 with five design partners.",
    },
  ];
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          Who we work with
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl font-normal max-w-3xl"
          style={{ color: "var(--text-headline)" }}
        >
          Same modules. Different vertical. Tailored onboarding.
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="group p-6 bg-white transition-all"
              style={{
                border: "1px solid var(--border-strong)",
                borderRadius: "10px",
              }}
            >
              <div className="flex items-center justify-between">
                <h3
                  className="font-serif text-xl font-semibold"
                  style={{ color: "var(--text-headline)" }}
                >
                  {i.label}
                </h3>
                <span
                  className="font-mono text-lg"
                  style={{ color: "var(--blue)" }}
                >
                  →
                </span>
              </div>
              <p
                className="font-mono text-xs leading-relaxed mt-3"
                style={{ color: "var(--text-body)" }}
              >
                {i.body}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PROOF, case study block on navy
// ---------------------------------------------------------------------------

function Proof() {
  const { proof } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "var(--bg-blue-dark)", color: "white" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
            style={{ opacity: 0.6 }}
          >
            Proof
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-normal leading-tight">
            {proof.heading}
          </h2>
          <p
            className="font-mono text-sm mt-5 leading-relaxed max-w-xl"
            style={{ opacity: 0.85 }}
          >
            {proof.body}
          </p>
        </div>
        <div
          className="p-8"
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "12px",
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        >
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ opacity: 0.6 }}
          >
            Case study
          </p>
          <p className="font-serif text-3xl font-normal">
            {proof.caseStudy.client}
          </p>
          <p className="font-mono text-xs" style={{ opacity: 0.7 }}>
            {proof.caseStudy.city}
          </p>
          <div className="mt-8">
            <p
              className="font-serif text-5xl md:text-6xl font-normal"
              style={{ color: "#FACC15" }}
            >
              {proof.caseStudy.stat}
            </p>
            <p className="font-mono text-xs mt-2" style={{ opacity: 0.7 }}>
              {proof.caseStudy.window}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// COMPARISON, two-up row pointing to the full compare page
// ---------------------------------------------------------------------------

function Comparison() {
  const { comparison } = MARKETING.home;
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          vs Conversion Logix
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl font-normal max-w-3xl"
          style={{ color: "var(--text-headline)" }}
        >
          {comparison.heading}
        </h2>
        <p
          className="font-mono text-sm leading-relaxed mt-5 max-w-2xl"
          style={{ color: "var(--text-body)" }}
        >
          {comparison.body}
        </p>
        <Link
          href={comparison.href}
          className="mt-8 inline-flex items-center gap-2 font-mono text-xs font-semibold"
          style={{
            color: "var(--blue)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {comparison.cta}
          <span aria-hidden="true">→</span>
        </Link>
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
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ opacity: 0.65 }}
          >
            Let's talk
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-normal max-w-3xl leading-tight">
            {final.heading}
          </h2>
          <p
            className="font-mono text-sm leading-relaxed mt-5 max-w-xl"
            style={{ opacity: 0.85 }}
          >
            {final.body}
          </p>
          <Link
            href={final.primaryHref}
            className="mt-10 inline-block font-mono text-xs font-semibold px-6 py-4 rounded"
            style={{
              backgroundColor: "white",
              color: "var(--bg-blue-dark)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {final.primaryCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
