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

// Modules section deliberately removed from the home page. WhatYouGet's
// "Inside the platform" strip now covers the modules list with real brand
// logos and editorial typography — the 9-card grid was duplicative and
// the lowest-density section on the page.

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
      <Verticals />
      <Faq />
      <Proof />
    </div>
  );
}
