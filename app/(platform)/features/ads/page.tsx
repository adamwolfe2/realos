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
      subhead="Most real estate ad spend is poured into broad audiences with no retargeting. We flip that: tight audiences, identity-pixel retargeting, creative swapped weekly, and a weekly call where we defend every dollar."
      whatItIs="Managed Google, Meta, LinkedIn, and TikTok campaigns tailored to each property. Creative ships from our studio, campaigns optimize against lease-velocity targets, and everything rolls up in the same dashboard that shows your leads."
      howItWorks={[
        "Connect your ad accounts to your portal via OAuth, we don't move spend through us.",
        "We set up geo-fenced, audience-targeted campaigns per property.",
        "Creative studio supplies fresh assets on a weekly cadence, stories, feed, search copy, display banners.",
        "Identity-pixel audiences from our own pixel fuel retargeting at warmer ID rates than any platform audience.",
        "Weekly review call: spend, CPL, conversion, next test to run.",
      ]}
      results={[
        "Cost per lead defended on a weekly call, not buried in a quarterly report.",
        "Attribution through to leased units in the portal dashboard.",
        "No agency markup on creative, no minimums, pause or kill any campaign from the portal.",
        "Creative refreshed weekly out of the Creative Studio, no separate production retainer.",
      ]}
      bestFor="Operators who want paid performance defended every week, not explained every quarter. Most powerful once the pixel is running, so retargeting audiences exist."
      artifact={<ConfigTabs />}
    />
  );
}
