import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { TrustStrip } from "@/components/home/trust-strip";
import { ProductTourSection } from "@/components/home/product-tour-section";
import { PilotCta } from "@/components/home/pilot-cta";
import { CapabilitiesRail } from "@/components/home/capabilities-rail";
import { Comparison } from "@/components/home/comparison";
import { LaunchJourney } from "@/components/home/launch-journey";
import { Faq } from "@/components/home/faq";
import { Proof } from "@/components/home/proof";

// Homepage structure — Norman brief (2026-05-28), Carbon deslop pass
// (2026-07-21). Sections, alternating white / #f4f4f4 bands:
//
//   1. Hero            value prop + primary CTA (white)
//   2. TrustStrip       stat band, extracted out of the hero (white)
//   3. ProductTour      interactive operator dashboard embed (#f4f4f4)
//   4. PilotCta         dedicated pilot offer card (white)
//   5. CapabilitiesRail six features, scrollytelling (#f4f4f4)
//   6. Comparison       current setup vs. full visibility (white)
//   7. LaunchJourney    your first 90 days (#f4f4f4)
//   8. Faq              deal-breaker objections (white)
//   9. Proof            final CTA (#f4f4f4)
//
// Eyebrows are rationed to 3 total, page-wide: Hero, CapabilitiesRail,
// Faq. Every other section's headline stands alone.
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
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <Hero />
      <TrustStrip />
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
