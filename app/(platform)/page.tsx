import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { ProductTourSection } from "@/components/home/product-tour-section";
import { PilotCta } from "@/components/home/pilot-cta";
import { CapabilitiesRail } from "@/components/home/capabilities-rail";
import { Comparison } from "@/components/home/comparison";
import { LaunchJourney } from "@/components/home/launch-journey";
import { Faq } from "@/components/home/faq";
import { Proof } from "@/components/home/proof";

// Homepage structure — Norman brief (2026-05-28). 9 sections:
//
//   1. Hero                 value prop + primary CTA + trust strip
//   2. ProductTour          interactive operator dashboard embed
//   3. PilotCta             dedicated pilot offer card
//   4. PlatformWalkthrough  ConfigTabs (extracted from hero)
//   5. CapabilitiesRail     six features, scrollytelling
//   6. Comparison           current setup vs. full visibility
//   7. LaunchJourney        your first 90 days
//   8. Faq                  deal-breaker objections
//   9. Proof                final CTA
//
// Sections kept in the codebase but cut from the homepage:
//   - SanityCheck  (live insights / reputation) — covered in CapabilitiesRail
//   - Verticals    (markets we serve) — covered on per-vertical pages
//   - LiveExample  (resident site + portal links) — covered by ProductTour
//   - Weekly       (operating rhythm) — visually too close to LaunchJourney's
//                  day-by-day timeline; the back-to-back read as redundant.
//                  Kept on disk for future re-mount if structure changes.

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <Hero />
      <ProductTourSection />
      <PilotCta />
      <CapabilitiesRail />
      <Comparison />
      <LaunchJourney />
      <Faq />
      <Proof />
    </div>
  );
}
