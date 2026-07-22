import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Website build · ${BRAND_NAME}`,
  description:
    "A fully-tracked property website, designed, built, and live in 14 days. Hooked up to your weekly report, your pixel, your CRM, and your AI chatbot the same day it ships.",
};

export default function WebsiteBuildFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Website build · Add-on"
      headline="A property website that ships in 14 days."
      subhead="We design, build, and launch your property site, wired to your weekly report, pixel, chatbot, and CRM from day one."
      whatItIs="A production property website, designed, built, and shipped on your domain in two weeks. Every LeaseStack module (pixel, chatbot, popups, conversion tracking, reputation feed) is pre-wired the day the site goes live. No retrofitting, no second integration project."
      howItWorks={[
        "Intake call: brand assets, neighborhood notes, unit details, and any existing copy we can pull forward.",
        "Site Engine designs the layout from a 13-step brief: style, colors, references, voice, content, integrations, domain, timeline.",
        "We build under a preview URL. You review every page, comment inline, and we ship the changes the same day.",
        "Launch on your domain. The pixel, chatbot, and lead capture are already firing the moment DNS resolves.",
        "Your first weekly report lands the following Monday: leases, traffic, anomalies, three actions, all attributed.",
      ]}
      results={[
        "Live property site in 14 days, not 14 weeks.",
        "Every LeaseStack module pre-wired, no second integration project to schedule.",
        "Conversion tracking, identity pixel, and AI chatbot firing from launch day.",
        "Editable inside the portal: copy, photos, unit details update without an agency invoice.",
      ]}
      bestFor="Operators standing up a new property, refreshing a tired site, or replatforming off a templated property-management theme. Especially powerful for groups standardizing a brand across multiple buildings, every site ships from the same blueprint and rolls up to one weekly report."
      artifact={<ConfigTabs />}
    />
  );
}
