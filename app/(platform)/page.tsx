import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { TrustBand } from "@/components/home/trust-band";
import { ProductHeroShot } from "@/components/home/product-hero-shot";
import { Pillars } from "@/components/home/pillars";
import { ReportFeature } from "@/components/home/report-feature";
import { LaunchSteps } from "@/components/home/launch-steps";
import { Faq } from "@/components/home/faq";
import { Proof } from "@/components/home/proof";
import { PixelSeam } from "@/components/home/pixel-seam";

// Homepage — product-forward rebuild with the signature motif language
// (blueprint + depth + cool + motion + juicebox passes, 2026-07-21). Light
// only, single brand-blue accent. A ruled spec-sheet frame runs the length of
// the page; sections carry a systematic mono index voice [01]..[06].
//
//   [01] Capture     signal-flow hero (the one animated loop)
//        TrustBand   four proof stats, count-up
//   ~pixel seam~
//   [02] The system  the real portal in a physical frame
//   [03] Pillars      tabbed product switcher (attribution / ai / reputation)
//   ~pixel seam~
//   [04] The report   weekly report on a blue texture panel
//   [05] Rollout      three-step implementation, drawing line
//   [06] FAQ          objections
//   ~pixel seam~
//        Proof       final CTA
//
// Retired (files kept on disk): PilotCta, Comparison, CapabilitiesRail,
// ProductTourSection, LaunchJourney, TrustStrip.

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <Hero />
      <PixelSeam color="#dbe3f2" />
      <TrustBand />
      <ProductHeroShot />
      <Pillars />
      <PixelSeam color="#dbe6ff" />
      <ReportFeature />
      <LaunchSteps />
      <Faq />
      <PixelSeam color="#e6e6e6" />
      <Proof />
    </div>
  );
}
