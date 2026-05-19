import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { Hero } from "@/components/home/hero";
import { WhatYouGet } from "@/components/home/what-you-get";
import { Comparison } from "@/components/home/comparison";
import { Weekly } from "@/components/home/weekly";
import { LiveExample } from "@/components/home/live-example";
import { ProductTourSection } from "@/components/home/product-tour-section";
import { Numbers } from "@/components/home/numbers";
import { Verticals } from "@/components/home/verticals";
import { Proof } from "@/components/home/proof";
import { Faq } from "@/components/home/faq";
import { LandingModules } from "@/components/landing/modules";

// Original homepage layout restored. The one carry-over from the May 19
// rewrite is the "Every module you can turn on" grid — slotted between
// Numbers and Verticals so readers see the full module roster mid-scroll.
// Light-mode treatment (no dark slab).

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <Hero />
      <WhatYouGet />
      <Comparison />
      <Weekly />
      <LiveExample />
      <ProductTourSection />
      <Numbers />
      <LandingModules />
      <Verticals />
      <Faq />
      <Proof />
    </div>
  );
}
