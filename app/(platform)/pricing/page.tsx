import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { PricingHero } from "@/components/platform/pricing/pricing-hero";
import { PricingTiers } from "@/components/platform/pricing/pricing-tiers";
import { PricingFaq } from "@/components/platform/pricing/pricing-faq";
import { PricingCta } from "@/components/platform/pricing/pricing-cta";

// 2026-09-27 (Adam): three packages instead of the a-la-carte builder.
// Cards render from PLAN_DISPLAY (lib/billing/catalog.ts TIERS), the same
// source trial activation checkout bills from.

export const metadata: Metadata = {
  title: `Pricing | ${BRAND_NAME}`,
  description:
    "Three plans, priced per property: Foundation, Growth, and Scale. Book a demo on your own property's data, or start a 14-day free trial with no card.",
  openGraph: {
    title: `Pricing | ${BRAND_NAME}`,
    description:
      "Three plans, priced per property. Book a demo or start a 14-day free trial.",
    type: "website",
  },
};

export default function PricingPage() {
  return (
    <>
      <PricingHero />
      <PricingTiers />
      <PricingFaq />
      <PricingCta />
    </>
  );
}
