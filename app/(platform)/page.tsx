import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { ProductHeroShot } from "@/components/home/product-hero-shot";
import { Pillars } from "@/components/home/pillars";
import { SurfacesStrip } from "@/components/home/surfaces-strip";
import { ReportFeature } from "@/components/home/report-feature";
import { LaunchSteps } from "@/components/home/launch-steps";
import { Faq } from "@/components/home/faq";
import { Proof } from "@/components/home/proof";
import { PixelSeam } from "@/components/home/pixel-seam";

// Homepage — one continuous story (round-2 QA, 2026-07-21). The blue thread
// spine and the trust band are gone; sections breathe. We follow a lead
// through the system across [01]..[07]:
//
//   [01] Capture         centered signal-flow hero (the one animated loop)
//   ~pixel seam~
//   [02] The system      pinned camera zoom over the dashboard
//   [03] It works         four sequential capability parts (all shown)
//   [04] Every surface    product surfaces + integration row
//   ~pixel seam~
//   [05] The report       weekly report on a blue texture panel
//   [06] Rollout          three-step implementation, drawing line
//   [07] FAQ
//        Proof            final CTA

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <Hero />
      <PixelSeam color="#dbe3f2" />
      <ProductHeroShot />
      <Pillars />
      <SurfacesStrip />
      <PixelSeam color="#dbe6ff" />
      <ReportFeature />
      <LaunchSteps />
      <Faq />
      <Proof />
    </div>
  );
}
