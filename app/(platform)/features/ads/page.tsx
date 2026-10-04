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
      eyebrow="Ad attribution"
      headline="Paid that pays back, tracked to the lease."
      subhead="Most ad spend goes to broad audiences with no retargeting. LeaseStack ties every dollar to a signed lease, so you see which campaigns pay back."
      artifact={<ConfigTabs />}
    />
  );
}
