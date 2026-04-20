import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";

export const metadata: Metadata = {
  title: "Search and AI discovery for real estate operators",
  description:
    "Rank in Google. Get recommended by ChatGPT and Perplexity. Per-location landing pages, sitemap automation, schema markup, monthly audits.",
};

export default function SEOAEOFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Search + AI discovery"
      headline="Rank in Google. Get recommended by ChatGPT."
      subhead="Prospects are asking AI for housing options before they open a search tab. If your property doesn't show up in Google and isn't recommended by ChatGPT or Perplexity, you're invisible. We build the infrastructure that lets both surface you."
      whatItIs="A complete search stack that covers traditional SEO plus answer-engine optimization for real estate marketing sites. Sitemap, schema, per-location landing pages, content strategy, and active monitoring of how LLMs reference your brand."
      howItWorks={[
        "Schema.org markup on every page: LocalBusiness, ApartmentComplex, FAQPage, Article.",
        "Dynamic sitemap rebuilt on every deploy, per-tenant sitemaps at the custom domain.",
        "Per-location, per-neighborhood, per-unit-type landing pages with local search copy.",
        "Monthly AI-discovery audit: we ask ChatGPT, Perplexity, and Claude about your market and log the results.",
        "Technical SEO basics handled: Core Web Vitals, mobile, canonical URLs, OG images.",
      ]}
      results={[
        "Climb to page one for long-tail keywords your leasing team already writes answers for.",
        "Be the named answer when prospects ask ChatGPT or Perplexity for housing recommendations.",
        "Organic traffic + conversion, fully attributed in your dashboard.",
      ]}
      bestFor="Operators with multiple properties or locations who rely on organic traffic. Pairs well with the managed ads module, organic volume plus paid conversions."
    />
  );
}
