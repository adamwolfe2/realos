import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { ProductHeroShot } from "@/components/home/product-hero-shot";
import { TrustBand } from "@/components/home/trust-band";
import { Pillars } from "@/components/home/pillars";
import { ReportFeature } from "@/components/home/report-feature";
import { LaunchSteps } from "@/components/home/launch-steps";
import { Faq } from "@/components/home/faq";
import { Proof } from "@/components/home/proof";

// Homepage — product-forward rebuild (2026-07-21 blueprint). Confident
// typography, then the REAL product shown large, then a sober, ruled,
// generous story. White / #f4f4f4 alternation:
//
//   1. Hero             typographic value prop, no artifact         (white)
//   2. ProductHeroShot  the real portal, large, straddling the seam (white -> #f4f4f4)
//   3. TrustBand        four proof items, mono labels               (#f4f4f4)
//   4. Pillars          three capabilities, real artifacts          (white)
//   5. ReportFeature    the weekly report, centered centerpiece     (#f4f4f4)
//   6. LaunchSteps      three-step implementation                   (white)
//   7. Faq              objections                                  (white, hairline above)
//   8. Proof            final CTA                                   (#f4f4f4)
//
// Retired from the page (files kept on disk): PilotCta (redundant with
// Proof), Comparison (startup-y "us vs them"), CapabilitiesRail as a
// section (absorbed into Pillars), standalone ProductTourSection (absorbed
// into ProductHeroShot), the pinned LaunchJourney (compacted into
// LaunchSteps), TrustStrip (replaced by TrustBand).

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <Hero />
      <ProductHeroShot />
      <TrustBand />
      <Pillars />
      <ReportFeature />
      <LaunchSteps />
      <Faq />
      <Proof />
    </div>
  );
}
