import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { HomeThreadFrame } from "@/components/home/home-thread-frame";
import { Hero } from "@/components/home/hero";
import { TrustBand } from "@/components/home/trust-band";
import { ProductHeroShot } from "@/components/home/product-hero-shot";
import { Pillars } from "@/components/home/pillars";
import { SurfacesStrip } from "@/components/home/surfaces-strip";
import { ReportFeature } from "@/components/home/report-feature";
import { LaunchSteps } from "@/components/home/launch-steps";
import { Faq } from "@/components/home/faq";
import { Proof } from "@/components/home/proof";
import { PixelSeam } from "@/components/home/pixel-seam";

// Homepage — one story, one thread (blueprint + depth + cool + motion +
// juicebox + cohesion passes, 2026-07-21). A single blue thread draws down
// the left content rule with scroll; each [0N] index node fills as the story
// arrives. We follow one renter (Priya V.) through the system:
//
//   [01] A renter shows intent      signal-flow hero (the one animated loop)
//        TrustBand                  four proof stats, count-up
//   ~pixel seam~
//   [02] The system catches it      pinned dashboard scrollytelling
//   [03] It works every lead        tabbed switcher (attribution / pixel / ai / rep+seo)
//   [04] Every surface, one login   product surfaces + integration row
//   ~pixel seam (blue)~
//   [05] Monday, it's in your report weekly report on a blue texture panel
//   [06] Your first 14 days         rollout, thread-branch line-draw
//   [07] Then you decide            FAQ
//   ~pixel seam~
//        Proof                      final CTA (thread terminus above the button)

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <HomeThreadFrame>
      <Hero />
      <PixelSeam color="#dbe3f2" />
      <TrustBand />
      <ProductHeroShot />
      <Pillars />
      <SurfacesStrip />
      <PixelSeam color="#dbe6ff" />
      <ReportFeature />
      <LaunchSteps />
      <Faq />
      <Proof />
    </HomeThreadFrame>
  );
}
