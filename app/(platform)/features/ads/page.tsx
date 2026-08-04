import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { MANAGED_ADS_DESCRIPTION } from "@/lib/copy/product-claims";

export const metadata: Metadata = {
  title: "Managed Google + Meta ads",
  description: MANAGED_ADS_DESCRIPTION,
};

export default function AdsFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Managed ads"
      headline="Paid that pays back, audited every week."
      subhead="Most ad spend goes to broad audiences with no retargeting. We flip that: tight audiences, pixel retargeting, defended every dollar."
      artifact={<ConfigTabs />}
    />
  );
}
