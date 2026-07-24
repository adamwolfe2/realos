import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";

export const metadata: Metadata = {
  title: "Managed Google + Meta ads",
  description:
    "Geo-fenced campaigns, pixel-powered retargeting, creative studio, weekly performance reviews. Google, Meta, LinkedIn, and TikTok, managed end-to-end.",
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
