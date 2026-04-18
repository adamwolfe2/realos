import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";

export const metadata: Metadata = {
  title: "Managed Google + Meta ads",
  description:
    "Geo-fenced campaigns, pixel-powered retargeting, creative studio, weekly performance reviews. Google + Meta + LinkedIn + TikTok, all managed at 15% of spend.",
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
        "Tight cost per lead (typical $20-$60 depending on vertical and market).",
        "Attribution through to leased units in the portal dashboard.",
        "15% of spend, no agency markup on creative, no minimums.",
        "Pause, shift, or kill any campaign from the portal without waiting on anyone.",
      ]}
      bestFor="Operators running at least $3K/mo in ad spend who want results, not retainers. Scale tier on our pricing page bundles this with the full platform."
    />
  );
}
