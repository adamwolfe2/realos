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
import { Modules } from "@/components/home/modules";
import { Verticals } from "@/components/home/verticals";
import { Proof } from "@/components/home/proof";
import { Faq } from "@/components/home/faq";

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <Hero />
      <WhatYouGet />
      <Comparison />
      <Weekly />
      <LiveExample />
      <ProductTourSection />
      <Numbers />
      <Modules />
      <Verticals />
      <Faq />
      <Proof />
    </div>
  );
}
