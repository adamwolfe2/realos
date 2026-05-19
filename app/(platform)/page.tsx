import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { LandingHero } from "@/components/landing/hero";
import { LandingPain } from "@/components/landing/pain";
import { LandingSolution } from "@/components/landing/solution";
import { LandingModules } from "@/components/landing/modules";
import { LandingPricingTeaser } from "@/components/landing/pricing-teaser";
import { LandingFinalCta } from "@/components/landing/final-cta";

// ---------------------------------------------------------------------------
// Homepage — Apple-clean composition.
//
// Structure (intentionally tight):
//
//   1. HERO            single bold value prop + one CTA
//   2. PAIN            three problems operators feel
//   3. SOLUTION        three pillars of the platform
//   4. MODULES         visual grid of every module
//   5. PRICING TEASER  three tier cards + link to /pricing
//   6. FINAL CTA       single action
//
// We deliberately dropped the live-example, weekly, numbers, verticals,
// proof, and faq sections. They're still available at /features, /demo
// and /pricing. The homepage's job is to land the value prop and route
// people to the right next page.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Every leasing channel. One source of truth.`,
  description:
    "The marketing stack for real estate operators. Site, chatbot, ads, attribution, and reputation — built to work together, priced to replace your retainer.",
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#0B1220" }}>
      <LandingHero />
      <LandingPain />
      <LandingSolution />
      <LandingModules />
      <LandingPricingTeaser />
      <LandingFinalCta />
    </div>
  );
}
