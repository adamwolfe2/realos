import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { ProductHeroShot } from "@/components/home/product-hero-shot";
import { Pillars } from "@/components/home/pillars";
import { Comparison } from "@/components/home/comparison";
import { SurfacesStrip } from "@/components/home/surfaces-strip";
import { ReportFeature } from "@/components/home/report-feature";
import { LaunchSteps } from "@/components/home/launch-steps";
import { Faq } from "@/components/home/faq";
import { Proof } from "@/components/home/proof";
import { PixelSeam } from "@/components/home/pixel-seam";

// Homepage — one continuous story (clarity pass, 2026-07-22). We follow a
// lead through the system across 01..07. The hero seam is gone (read as
// decorative filler in review); a real-numbers proof strip sits under the
// hero CTAs instead. Comparison is REMOUNTED after Pillars: it is the page's
// only explicit problem/resolution beat ("your current setup vs one
// dashboard") and review flagged its absence as the page's biggest
// problem-led gap.
//
//   01 Capture           centered signal-flow hero + production proof strip
//   02 The system        pinned camera zoom over the dashboard
//   03 It works          four sequential capability parts (all shown)
//      Comparison        why operators switch (unnumbered aside)
//   04 Every surface     product surfaces + integration row
//   ~pixel seam~
//   05 The report        weekly report on a blue texture panel
//   06 Rollout           three-step implementation, drawing line
//   07 FAQ
//      Proof             final CTA

export const metadata: Metadata = {
  title: `${BRAND_NAME}: See which ad produced the signed lease`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <Hero />
      <ProductHeroShot />
      <Pillars />
      <Comparison />
      <SurfacesStrip />
      <PixelSeam color="#dbe6ff" />
      <ReportFeature />
      <LaunchSteps />
      <Faq />
      <Proof />
    </div>
  );
}
