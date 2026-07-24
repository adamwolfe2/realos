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
      artifact={<ConfigTabs />}
    />
  );
}
