import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { PricingHero } from "@/components/platform/pricing/pricing-hero";
import { PricingTiers } from "@/components/platform/pricing/pricing-tiers";
import { AddonsGrid } from "@/components/platform/pricing/addons-grid";
import { ComparisonTable } from "@/components/platform/pricing/comparison-table";
import { PricingFaq } from "@/components/platform/pricing/pricing-faq";
import { PricingCta } from "@/components/platform/pricing/pricing-cta";
import { getEffectiveFeatureCatalog } from "@/lib/billing/feature-prices";

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
// Style: matches the platform brand (white canvas, var(--color-primary)
// accent, alternating section backgrounds, flat Carbon-forward cards).
// Plan names/prices on Tiers + Comparison both derive from
// lib/billing/catalog.ts via components/platform/pricing/plan-display.ts.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Pricing | ${BRAND_NAME}`,
  description:
    "Operator-built leasing intelligence platform — a more economical alternative to a traditional marketing-agency retainer, with more insights and control. Free pilot, month-to-month standard plan, portfolio pricing for owners.",
  openGraph: {
    title: `Pricing | ${BRAND_NAME}`,
    description:
      "Operator-built. A more economical alternative to traditional marketing vendors, with more insights and control.",
    type: "website",
  },
};

// ISR: the per-feature prices come from the live admin catalog
// (getEffectiveFeatureCatalog), so an admin price edit reflects on the public
// pricing page within the revalidation window without per-request DB load.
export const revalidate = 600;

export default async function PricingPage() {
  const { features, basePlatformCents } = await getEffectiveFeatureCatalog();
  return (
    <>
      <PricingHero />
      <PricingTiers />
      <AddonsGrid
        features={features.map((f) => ({
          name: f.name,
          copy: f.copy,
          monthlyCents: f.monthlyCents,
          recommended: f.recommended,
        }))}
        basePlatformCents={basePlatformCents}
      />
      <ComparisonTable />
      <PricingFaq />
      <PricingCta />
    </>
  );
}
