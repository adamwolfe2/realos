import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { CapabilitiesRail } from "@/components/home/capabilities-rail";
import { SanityCheckSection } from "@/components/home/sanity-check-section";
import { Comparison } from "@/components/home/comparison";
import { Weekly } from "@/components/home/weekly";
import { LaunchJourney } from "@/components/home/launch-journey";
import { LiveExample } from "@/components/home/live-example";
import { ProductTourSection } from "@/components/home/product-tour-section";
import { Verticals } from "@/components/home/verticals";
import { Proof } from "@/components/home/proof";
import { Faq } from "@/components/home/faq";

// Homepage structure (post-CapabilitiesRail rewrite):
//   Hero
//   CapabilitiesRail          ← scrollytelling, 6 surfaces, sticky artifact
//   Comparison                ← the shift / current stack vs. LeaseStack
//   Weekly                    ← operating rhythm
//   LaunchJourney             ← scroll-pinned 90-day unlock animation
//   LiveExample               ← links to /demo + #product-tour
//   ProductTourSection        ← interactive operator portal embed
//   Verticals                 ← markets we cover
//   Faq
//   Proof                     ← final CTA
//
// Replaced sections: WhatYouGet, LandingModules, Numbers. The Capabilities
// Rail subsumes all three — six live product surfaces in a sticky-artifact
// scrollytelling layout, each with a "see it live" link to the matching
// /features page. See components/home/capabilities-rail.tsx for the design
// note explaining why this replaces three grids in a row.

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <Hero />
      <CapabilitiesRail />
      {/* Norman's 2026-05-21 inspiration brief: judgmentlabs.ai-style
          sticky-text + scrolling-artifact section as the "cleanliness
          anchor" on the home page. Sits between the dense capabilities
          rail and the wordy comparison so the reader hits a calm,
          spacious moment before the next dense scroll. */}
      <SanityCheckSection />
      <Comparison />
      <Weekly />
      <LaunchJourney />
      <LiveExample />
      <ProductTourSection />
      <Verticals />
      <Faq />
      <Proof />
    </div>
  );
}
