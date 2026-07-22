import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { PricingHero } from "@/components/platform/pricing/pricing-hero";
import { PricingBuilder } from "@/components/platform/pricing/pricing-builder";
import { EnterpriseBand } from "@/components/platform/pricing/enterprise-band";
import { PricingFaq } from "@/components/platform/pricing/pricing-faq";
import { PricingCta } from "@/components/platform/pricing/pricing-cta";
import { getEffectiveFeatureCatalog } from "@/lib/billing/feature-prices";

// ---------------------------------------------------------------------------
// Pricing page — /pricing
//
// 2026-07-21 pricing rebuild (marketing-deslop spec, Group B): killed the
// dual pricing story. The page used to show four tier cards (Foundation/
// Growth/Scale/Enterprise) AND a separate à-la-carte grid, which read as
// two competing prices for the same thing. Now there is ONE builder.
//
// Page order:
//
//   1. Hero        "One platform fee. Add only what you need." CTA jumps
//                   to the builder (#builder).
//   2. Builder      the centerpiece: base platform + feature toggles +
//                   property stepper + monthly/annual cycle, resolving to
//                   a live total and a "Start free trial" CTA that deep-
//                   links the selection into sign-up.
//   3. Enterprise   single-row band for 20+ properties / multi-brand,
//                   routes to Book a demo instead of self-serve checkout.
//   4. FAQ          6 deal-breaker objections, accordion pattern.
//   5. CTA          last conversion push, routes back to the builder.
//
// PricingTiers + ComparisonTable are no longer used on this page (they
// rendered the old tier-card story) but their files stay on disk;
// plan-display.ts stays since other surfaces still import it.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Pricing | ${BRAND_NAME}`,
  description:
    "One platform fee per property, plus only the features you turn on. Configure your platform, see the live total, and start a 14-day free trial. No card required.",
  openGraph: {
    title: `Pricing | ${BRAND_NAME}`,
    description:
      "One platform fee per property, plus only the features you turn on. Configure your platform and start a free trial.",
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
      <PricingBuilder
        features={features.map((f) => ({
          key: f.key,
          name: f.name,
          copy: f.copy,
          monthlyCents: f.monthlyCents,
          recommended: f.recommended,
        }))}
        basePlatformCents={basePlatformCents}
      />
      <EnterpriseBand />
      <PricingFaq />
      <PricingCta />
    </>
  );
}
