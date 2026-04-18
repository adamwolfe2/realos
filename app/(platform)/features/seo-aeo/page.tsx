import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";

export const metadata: Metadata = {
  title: "SEO + AEO for real estate operators",
  description:
    "Rank in Google and in answer engines like ChatGPT and Perplexity. Per-campus and per-neighborhood landing pages, sitemap automation, schema markup.",
};

export default function SEOAEOFeaturePage() {
  return (
    <FeaturePage
      eyebrow="SEO + AEO"
      headline="Rank in Google. Rank in ChatGPT. Show up first."
      subhead="LLM answer engines are the new storefront. If your property doesn't show up when someone asks ChatGPT about housing options, you're invisible. We build the infrastructure that lets both search and answer engines index you."
      whatItIs="A complete SEO stack plus AEO (answer engine optimization) for real estate marketing sites. Sitemap, schema, per-location landing pages, content strategy, and active monitoring of how LLMs reference your brand."
      howItWorks={[
        "Schema.org markup on every page: LocalBusiness, ApartmentComplex, FAQPage, Article.",
        "Dynamic sitemap rebuilt on every deploy, per-tenant sitemaps at the custom domain.",
        "Per-campus, per-neighborhood, per-unit-type landing pages with local SEO copy.",
        "Monthly AEO audit: we ask ChatGPT / Perplexity / Claude about your market and log the results.",
        "Technical SEO basics handled: Core Web Vitals, mobile, canonical URLs, OG images.",
      ]}
      results={[
        "Climb to page one for long-tail keywords (e.g. 'student housing near Sproul Plaza').",
        "Be the named answer when prospects ask AI for housing recommendations.",
        "Organic traffic + conversion, fully attributed in your dashboard.",
      ]}
      bestFor="Operators with multiple properties or locations who rely on organic traffic. Pairs well with the managed ads module, SEO volume plus paid conversions."
    />
  );
}
