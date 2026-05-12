import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { PricingHero } from "@/components/platform/pricing/pricing-hero";
import { PricingTiers } from "@/components/platform/pricing/pricing-tiers";
import { AddonsGrid } from "@/components/platform/pricing/addons-grid";
import { ComparisonTable } from "@/components/platform/pricing/comparison-table";
import { PricingFaq } from "@/components/platform/pricing/pricing-faq";
import { PricingCta } from "@/components/platform/pricing/pricing-cta";

// ---------------------------------------------------------------------------
// Pricing page — /pricing
//
// Page order (self-serve buying journey):
//
//   1. Hero        value frame plus trust strip
//   2. Tiers       three published plans plus Enterprise, with billing
//                  cycle toggle and per-property pricing as the headline
//   3. Add-ons     capability and capacity add-ons that customers can
//                  toggle on later inside the billing portal
//   4. Comparison  feature-by-tier table for the detail-oriented buyer,
//                  compact by default with a "show every detail"
//                  disclosure for the long matrix
//   5. FAQ         eight deal-breaker objections, accordion pattern
//   6. CTA         last conversion push (demo or onboarding)
//
// Style: matches the platform brand (#f5f4ed parchment, #2563EB accent,
// alternating section backgrounds, generous negative space).
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Pricing | ${BRAND_NAME}`,
  description:
    "Self-serve marketing platform for real estate operators. Per-property pricing from $499 per month. Site builder, AppFolio sync, AI chatbot, visitor pixel, ad campaigns, SEO, reputation, audiences. No contracts.",
  openGraph: {
    title: `Pricing | ${BRAND_NAME}`,
    description:
      "Per-property pricing from $499 per month. Self-serve, no setup fee, no contracts.",
    type: "website",
  },
};

// Pricing page is mostly static — no per-request data. Let Next prerender
// it at build time so first paint is instant.
export const dynamic = "force-static";

export default function PricingPage() {
  return (
    <>
      <PricingHero />
      <PricingTiers />
      <AddonsGrid />
      <ComparisonTable />
      <PricingFaq />
      <PricingCta />
    </>
  );
}
