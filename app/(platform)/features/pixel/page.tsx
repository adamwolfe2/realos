import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";

export const metadata: Metadata = {
  title: "Visitor identification, names and emails on your site traffic",
  description:
    "Put names and emails on a meaningful share of your anonymous website traffic. Installed and managed end-to-end.",
};

export default function PixelFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Visitor identification"
      headline="Know who's actually on your site."
      subhead="Standard analytics tell you impressions. Our system tells you which prospect visited, which unit they looked at, and how to reach them, all before they fill out a form."
      whatItIs="A lightweight script installed on your marketing site that matches anonymous visitors against a consented identity graph to surface names, emails, and sometimes phone numbers on the visits that matter."
      howItWorks={[
        "We provision an identity-graph pixel per tenant, installed on your custom domain in under an hour.",
        "Every visit, pageviews, time on page, referrer, UTM, feeds our Visitor table.",
        "When a visit can be resolved to a person, we attach identified fields and a full-contact enrichment blob.",
        "High-intent identified visitors get auto-emailed on an hourly cadence; all visitors feed ad retargeting audiences.",
      ]}
      results={[
        "A steady stream of named visitors in your CRM instead of anonymous session counts.",
        "Weekly visitor report Monday morning, who visited, who's high intent, who converted.",
        "One-click CSV export of hashed emails for ads-platform custom audiences.",
        "Clear attribution back to ad campaigns, search pages, and organic traffic.",
      ]}
      bestFor="Operators with at least a few hundred monthly visitors who currently have no visibility into anonymous traffic. Student housing, multifamily, and senior living benefit most."
    />
  );
}
