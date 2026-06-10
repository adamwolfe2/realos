import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getFeaturePriceRows } from "@/lib/billing/feature-prices";
import { PricingEditor } from "./pricing-editor";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

// Admin-editable onboarding feature pricing. Every price here is what the
// operator sees in the onboarding cart's running total. Gated by the admin
// layout (agency only); the save action re-checks requireAgency.
export default async function AdminPricingPage() {
  const rows = await getFeaturePriceRows();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Onboarding pricing"
        description="Set the monthly, per-property price for every feature in the onboarding cart. Changes apply to new signups immediately. Toggle a feature off to hide it from onboarding."
      />
      <PricingEditor rows={rows} />
    </div>
  );
}
