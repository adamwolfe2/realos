import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";

export const metadata: Metadata = {
  title: "Identity graph pixel, website visitor identification",
  description:
    "Put names and emails on a meaningful share of your anonymous site traffic. Identity-graph pixel by Cursive, installed and managed by us.",
};

export default function PixelFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Identity graph pixel"
      headline="Know who's actually on your site."
      subhead="Standard analytics tell you impressions. Our pixel tells you which prospect visited, which unit they looked at, and how to reach them, all before they fill out a form."
      whatItIs="A third-party identity-graph pixel (Cursive) installed on your marketing site. It matches anonymous site visitors against a consented identity graph to surface names, emails, and sometimes phone numbers on the visits that matter."
      howItWorks={[
        "We provision a pixel per tenant, installed on your custom domain in under an hour.",
        "Every visit, pageviews, time on page, referrer, UTM, feeds our Visitor table.",
        "When a visit can be resolved to a person, we attach identified fields and a full-contact enrichment blob.",
        "High-intent identified visitors get auto-emailed on an hourly cadence; all visitors feed ad retargeting audiences.",
      ]}
      results={[
        "A steady stream of named visitors in your CRM instead of anonymous session counts.",
        "Weekly pixel report Monday morning, who visited, who's high intent, who converted.",
        "One-click CSV export of hashed emails for Google + Meta custom audiences.",
        "Clear attribution back to ad campaigns, SEO pages, and organic traffic.",
      ]}
      bestFor="Operators with at least a few hundred monthly visitors who currently have no visibility into anonymous traffic. Student housing, multifamily, and senior living benefit most."
    />
  );
}
