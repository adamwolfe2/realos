import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { HeroDemo } from "@/components/platform/hero-demo";

// ---------------------------------------------------------------------------
// Tesla-inspired homepage.
//
// Composition principles per the DESIGN.md:
//   - Full-viewport sections. One message per screen.
//   - Photography carries the emotion. UI chrome is almost zero.
//   - One blue (#3E6AE1). Two type weights (400/500). No shadows.
//   - 4px radii, 0.33s transitions, no gradients on UI elements.
//   - Gallery of full-bleed category cards (the Tesla "Sport Sedan" pattern)
//     repurposed as the vertical showcase.
//
// The interactive demo card still exists, but it now lives in its own
// white-canvas showcase section below the hero, framed like a product
// showroom piece rather than buried in the hero layout.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#393C41" }}>
      <Hero />
      <VerticalGallery />
      <Numbers />
      <PlatformShowcase />
      <Proof />
      <FinalCta />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HERO - full-viewport cinematic
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section
      className="relative w-full"
      style={{
        height: "100vh",
        minHeight: "640px",
        marginTop: "-56px",
      }}
    >
      <Image
        src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=2400&q=85"
        alt=""
        fill
        priority
        sizes="100vw"
        style={{ objectFit: "cover", objectPosition: "center" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(23,26,32,0.35) 0%, rgba(23,26,32,0.15) 40%, rgba(23,26,32,0.55) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 h-full flex flex-col">
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 text-center pt-16">
            <h1
              style={{
                color: "#FFFFFF",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(36px, 5.2vw, 56px)",
                fontWeight: 500,
                lineHeight: 1.14,
                letterSpacing: "normal",
              }}
            >
              Marketing infrastructure
              <br />
              for real estate operators
            </h1>
            <p
              className="mx-auto mt-5 max-w-[560px]"
              style={{
                color: "rgba(255,255,255,0.88)",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 400,
                lineHeight: 1.5,
              }}
            >
              One managed platform. Custom site, live listings, identity pixel,
              AI chatbot, managed ads. Launched in under 14 days.
            </p>
          </div>
        </div>

        <div className="pb-16 md:pb-20">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/onboarding" className="btn-primary">
                Book a demo
              </Link>
              <Link href="/pricing" className="btn-secondary-dark">
                See pricing
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
              <HeroStat value="<14 days" label="First call to live site" />
              <HeroStat value="$1,497" label="From, per month, one retainer" />
              <HeroStat value="0" label="Setup fees" />
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 bottom-6 flex items-center justify-center"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            color: "#FFFFFF",
            backdropFilter: "blur(6px)",
          }}
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p
        style={{
          color: "#FFFFFF",
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 500,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      <p
        className="mt-1"
        style={{
          color: "rgba(255,255,255,0.75)",
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          fontWeight: 400,
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VERTICAL GALLERY - Tesla "Sport Sedan / Midsize SUV" cards
// ---------------------------------------------------------------------------

const VERTICALS: Array<{
  href: string;
  label: string;
  tag: string;
  image: string;
  span: "lg" | "sm";
}> = [
  {
    href: "/student-housing",
    label: "Student housing",
    tag: "Live today, our wedge vertical",
    image:
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=2000&q=85",
    span: "lg",
  },
  {
    href: "/multifamily",
    label: "Multifamily",
    tag: "Portfolio rollups, per-property pools",
    image:
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=2000&q=85",
    span: "lg",
  },
  {
    href: "/senior-living",
    label: "Senior living",
    tag: "Family-first, patient nurture",
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=2000&q=85",
    span: "sm",
  },
  {
    href: "/commercial",
    label: "Commercial",
    tag: "Office, industrial, retail. Q3 2026",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=85",
    span: "sm",
  },
];

function VerticalGallery() {
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-20 md:py-28">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="heading-section" style={{ color: "#171A20" }}>
            Same platform, tailored by vertical.
          </h2>
          <p
            className="mt-3 mx-auto max-w-[520px] body-default"
            style={{ color: "#393C41" }}
          >
            Four verticals, same modules. Different onboarding playbook,
            different ad creative library, different compliance guardrails.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VERTICALS.map((v) => (
            <VerticalCard key={v.href} {...v} />
          ))}
        </div>
      </div>
    </section>
  );
}

function VerticalCard({
  href,
  label,
  tag,
  image,
}: {
  href: string;
  label: string;
  tag: string;
  image: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden"
      style={{
        borderRadius: "12px",
        aspectRatio: "16 / 10",
        backgroundColor: "#171A20",
      }}
    >
      <Image
        src={image}
        alt=""
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        style={{
          objectFit: "cover",
          objectPosition: "center",
          transition: "transform 0.6s cubic-bezier(0.5, 0, 0, 0.75)",
        }}
        className="group-hover:scale-[1.03]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(23,26,32,0.2) 0%, rgba(23,26,32,0.05) 40%, rgba(23,26,32,0.7) 100%)",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between">
        <div>
          <p
            style={{
              color: "#FFFFFF",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.8vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.15,
            }}
          >
            {label}
          </p>
          <p
            className="mt-2"
            style={{
              color: "rgba(255,255,255,0.8)",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 400,
            }}
          >
            {tag}
          </p>
        </div>
        <div className="flex items-center justify-end gap-4">
          <span
            className="inline-flex items-center justify-center rounded-[4px]"
            style={{
              minHeight: "32px",
              padding: "0 14px",
              background: "rgba(255,255,255,0.9)",
              color: "#171A20",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            Learn
          </span>
          <span
            className="inline-flex items-center justify-center rounded-[4px]"
            style={{
              minHeight: "32px",
              padding: "0 14px",
              background: "rgba(23,26,32,0.6)",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            Book a demo
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// NUMBERS - minimal, centered, single row
// ---------------------------------------------------------------------------

const METRICS = [
  { value: "<14d",  label: "First call to live site" },
  { value: "95%",   label: "Visitors named, not just form-fillers" },
  { value: "$1,100",label: "Retainer delta vs Conversion Logix" },
  { value: "48h",   label: "Creative turnaround on every asset" },
];

function Numbers() {
  return (
    <section style={{ backgroundColor: "#F4F4F4" }}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {METRICS.map((m) => (
            <div key={m.value} className="text-center">
              <p
                style={{
                  color: "#171A20",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(40px, 5.2vw, 64px)",
                  fontWeight: 500,
                  lineHeight: 1.04,
                  letterSpacing: "normal",
                }}
              >
                {m.value}
              </p>
              <p
                className="mt-3 mx-auto max-w-[220px]"
                style={{
                  color: "#393C41",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 400,
                  lineHeight: 1.45,
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
// PLATFORM SHOWCASE - centered demo card, white room, gallery framing
// ---------------------------------------------------------------------------

function PlatformShowcase() {
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="heading-section" style={{ color: "#171A20" }}>
            The platform, not the pitch deck.
          </h2>
          <p
            className="mt-3 mx-auto max-w-[540px] body-default"
            style={{ color: "#393C41" }}
          >
            Four steps from intake to launch. Import inventory from AppFolio.
            Build the site. Attach the identity pixel. Launch managed ads.
          </p>
        </div>

        <div className="mx-auto max-w-[1080px]">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PROOF - cinematic dark hero style, single case study
// ---------------------------------------------------------------------------

function Proof() {
  const { proof } = MARKETING.home;
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "#171A20" }}
    >
      <Image
        src="https://images.unsplash.com/photo-1551038247-3d9af20df552?auto=format&fit=crop&w=2400&q=85"
        alt=""
        fill
        sizes="100vw"
        style={{
          objectFit: "cover",
          objectPosition: "center",
          opacity: 0.28,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(23,26,32,0.75) 0%, rgba(23,26,32,0.95) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 py-24 md:py-32 text-center">
        <p
          className="mb-6"
          style={{
            color: "rgba(255,255,255,0.7)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Case study
        </p>
        <h2
          className="mx-auto max-w-[860px]"
          style={{
            color: "#FFFFFF",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px, 4vw, 48px)",
            fontWeight: 500,
            lineHeight: 1.12,
          }}
        >
          {proof.heading}
        </h2>
        <p
          className="mx-auto mt-5 max-w-[560px]"
          style={{
            color: "rgba(255,255,255,0.8)",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 400,
            lineHeight: 1.55,
          }}
        >
          {proof.body}
        </p>

        <div className="mt-12 flex flex-wrap items-start justify-center gap-x-16 gap-y-8">
          <ProofBigStat value={proof.caseStudy.stat} label={proof.caseStudy.window} />
          <ProofBigStat value="31" label="Tours booked, week 1" />
          <ProofBigStat value="$0" label="Design fees charged" />
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/onboarding" className="btn-primary">
            Book a demo
          </Link>
          <Link href="/compare/conversion-logix" className="btn-secondary-dark">
            Read the comparison
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProofBigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p
        style={{
          color: "#FFFFFF",
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
          color: "rgba(255,255,255,0.7)",
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          fontWeight: 400,
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FINAL CTA - white canvas, centered headline, two buttons
// ---------------------------------------------------------------------------

function FinalCta() {
  const { final } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-24 md:py-32 text-center">
        <h2
          className="mx-auto max-w-[860px]"
          style={{
            color: "#171A20",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px, 4vw, 48px)",
            fontWeight: 500,
            lineHeight: 1.1,
          }}
        >
          {final.heading}
        </h2>
        <p
          className="mx-auto mt-5 max-w-[540px]"
          style={{
            color: "#393C41",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            fontWeight: 400,
            lineHeight: 1.55,
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
