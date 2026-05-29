import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { CapabilitiesRail } from "@/components/home/capabilities-rail";
import { SanityCheckSection } from "@/components/home/sanity-check-section";
import { Comparison } from "@/components/home/comparison";
import { ProductTourSection } from "@/components/home/product-tour-section";
import { Verticals } from "@/components/home/verticals";
import { Proof } from "@/components/home/proof";
import { Faq } from "@/components/home/faq";

// Homepage structure — post 2026-05-28 copy audit (CEO ask: clarity first,
// cut fluff, 5-7 sections). Final 8 sections, down from 11:
//
//   1. Hero                 value prop + primary CTA + trust strip
//   2. CapabilitiesRail     six product surfaces, scrollytelling
//   3. SanityCheckSection   reputation surface (the seventh capability)
//   4. Comparison           current stack vs. LeaseStack, 5 rows
//   5. ProductTourSection   interactive operator portal embed
//   6. Verticals            which markets we serve
//   7. Faq                  8 deal-breaker objections
//   8. Proof                final CTA
//
// Sections cut from the homepage (component files preserved per CEO
// direction, in case we bring them back):
//   - Weekly        Operating rhythm — overlapped CapabilitiesRail #1
//                   (weekly report) and Comparison rows 1-2. Reader sees
//                   the same beat three times in a row.
//   - LaunchJourney 90-day scroll-pinned timeline — overlapped Hero
//                   ("live in 14 days"), Comparison, and Proof trust strip
//                   ("Time to live: 14 days"). 280vh of pinned scroll
//                   for a beat the page already makes twice.
//   - LiveExample   Two destination link cards — duplicated ProductTour
//                   (which IS the live example, interactive).

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <Hero />
      <CapabilitiesRail />
      <SanityCheckSection />
      <Comparison />
      <ProductTourSection />
      <Verticals />
      <Faq />
      <Proof />
    </div>
  );
}
