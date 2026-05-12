import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { PricingHero } from "@/components/platform/pricing/pricing-hero";
import { PricingTiers } from "@/components/platform/pricing/pricing-tiers";
import { ExampleBills } from "@/components/platform/pricing/example-bills";
import { AddonsGrid } from "@/components/platform/pricing/addons-grid";
import { ComparisonTable } from "@/components/platform/pricing/comparison-table";
import { PricingFaq } from "@/components/platform/pricing/pricing-faq";
import { PricingCta } from "@/components/platform/pricing/pricing-cta";

// ---------------------------------------------------------------------------
// Pricing page — /pricing
//
// Page order (matches the buying journey, not a marketing template):
//
//   1. Hero            — value frame ("managed, not DIY") + trust strip
//   2. Tiers           — three published plans + Enterprise, with billing
//                        cycle toggle and per-property pricing as the
//                        headline number
//   3. Example bills   — three sample invoices so the buyer can map their
//                        portfolio onto the math without a sales call
//   4. Add-ons         — capacity / capability / service add-ons grouped
//                        by buying motion
//   5. Comparison      — full feature-by-tier table for the detail-oriented
//                        buyer (lives below the cards so it never blocks
//                        the scan-and-decide path)
//   6. FAQ             — eight deal-breaker objections, accordion pattern
//   7. CTA             — last conversion push (demo / start now)
//
// Style: matches the platform brand (#f5f4ed parchment, #2563EB accent,
// alternating section backgrounds, generous negative space).
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Pricing — ${BRAND_NAME}`,
  description:
    "Managed marketing for real estate operators. Per-property pricing from $599/mo. Site, listings, AI chatbot, ad management, pixel, reputation, audiences — built and run by our team.",
  openGraph: {
    title: `Pricing — ${BRAND_NAME}`,
    description:
      "Per-property pricing from $599/mo. Managed by our team. 14 days to live. No contracts.",
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
      <ExampleBills />
      <AddonsGrid />
      <ComparisonTable />
      <PricingFaq />
      <PricingCta />
    </>
  );
}
