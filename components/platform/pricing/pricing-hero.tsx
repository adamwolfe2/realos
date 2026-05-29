import { Check } from "lucide-react";
import { SplitHero } from "@/components/platform/split-hero";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";

// ---------------------------------------------------------------------------
// PricingHero — rebuilt on the homepage SplitHero pattern so the pricing
// page opens with the same rhythm as the rest of the site.
//
// What changed (CEO brief 2026-05-28):
//   - Switched from the standalone left-aligned hero to SplitHero so the
//     right column gets a calm artifact (faux Growth tier card preview)
//     instead of empty white space.
//   - Subhead collapsed from three sentences to one.
//   - Stat tiles cut. Trust strip is now 3 chips matching the homepage.
//   - Eyebrow handled by SplitHero so it matches every other section
//     across the site (line + mono blue label).
// ---------------------------------------------------------------------------

export function PricingHero() {
  return (
    <SplitHero
      eyebrow="Pricing"
      headline="One platform."
      headlineAccent="Less than your retainer."
      subhead="Site, ads, AI chatbot, visitor pixel, reputation, and weekly report — flat per-property monthly, no retainer."
      ctas={[
        { label: "Start the free trial", href: "/onboarding" },
        { label: "Book a demo", href: "/demo", variant: "secondary" },
      ]}
      trust={[
        { value: "14 days", label: "Live on your domain" },
        { value: "100%", label: "Ad spend tracked" },
        { value: "$0", label: "Pilot. Cancel anytime." },
      ]}
      artifact={
        <SoftFramedArtifact tone="lavender" padding="md" bare>
          <PricingHeroArtifact />
        </SoftFramedArtifact>
      }
    />
  );
}

// Calm, static preview of a single Growth-tier card. Visually mirrors the
// real tier cards in PricingTiers so the hero artifact reads as "this is
// what you're about to see" instead of an unrelated mockup.
function PricingHeroArtifact() {
  return (
    <div
      className="relative rounded-2xl p-6 md:p-7 flex flex-col bg-white"
      style={{
        border: "1px solid #2563EB",
        boxShadow:
          "0 0 0 4px rgba(37,99,235,0.08), 0 8px 24px rgba(37,99,235,0.10)",
      }}
    >
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full px-2.5 py-1"
        style={{
          backgroundColor: "#2563EB",
          color: "#ffffff",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Most popular
      </div>

      <div className="mb-4">
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#88867f",
            fontWeight: 600,
          }}
        >
          Growth
        </div>
        <p
          className="mt-1"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.45,
          }}
        >
          Replace your retainer. Flexible, month-to-month.
        </p>
      </div>

      <div className="mb-3">
        <div className="flex items-baseline gap-1">
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "44px",
              fontWeight: 700,
              letterSpacing: "-0.026em",
              lineHeight: 1,
              color: "#1E2A3A",
            }}
          >
            $899
          </span>
          <span
            style={{
              color: "#88867f",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            /mo · per property
          </span>
        </div>
        <p
          className="mt-1"
          style={{
            color: "#88867f",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          1 property
        </p>
      </div>

      <ul className="space-y-2">
        {[
          "Visitor pixel · 5,000 identified visitors / mo",
          "AI chatbot · 5,000 conversations / mo",
          "Source-to-lease attribution",
          "Operator-written weekly read",
        ].map((label) => (
          <li
            key={label}
            className="flex items-start gap-2"
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            <Check
              className="shrink-0 mt-[3px]"
              size={14}
              strokeWidth={2.5}
              style={{ color: "#2563EB" }}
              aria-hidden="true"
            />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
