import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";
import { SEOTrendChart } from "@/components/platform/artifacts/seo-trend-chart";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Keyword trends · ${BRAND_NAME}`,
  description:
    "Track how your property ranks for the queries your prospects actually search — week over week, across every keyword that matters in your market. Backed by DataForSEO.",
};

export default function KeywordTrendsFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Keyword trends · Add-on"
      headline="See exactly which queries find your property."
      subhead="Continuous keyword tracking across the queries your prospects actually type — ranked positions logged weekly, trend lines plotted by query, search volume mapped to your traffic. The thing your SEO consultant only mentions during the renewal call."
      whatItIs="A live dashboard of every keyword that matters in your market. Ranked positions, search volume, click-through rate, and trajectory — all logged weekly via DataForSEO. The same data that powers the SEO + AEO module's content briefs, surfaced as a standalone tracker for operators who want the full picture."
      howItWorks={[
        "We seed your tracker with the long-tail queries your leasing team already answers — \"furnished apartments near campus\", \"pet-friendly downtown\", \"month-to-month near hospital\".",
        "DataForSEO logs your ranked position for every query, weekly, at your property's geography.",
        "Trend charts plot 90-day movement per query — gains, losses, and queries where you've never ranked.",
        "New query opportunities surface automatically when search volume spikes in your market.",
        "Weekly report calls out the three movements that mattered — a query you just claimed, a query you slipped on, a new opportunity worth chasing.",
      ]}
      results={[
        "Every query that matters in your market, ranked and tracked, week over week.",
        "Trend visualization on each keyword so you see the slope, not just the snapshot.",
        "Search-volume context so a #3 ranking on a low-volume query is treated differently than a #3 on a high-volume one.",
        "Three movements per week called out in the weekly report — wins, losses, openings.",
      ]}
      bestFor="Operators in competitive markets where ranking position directly drives tour volume — student housing near major campuses, urban multifamily, hospitality, senior living in growing metros. Pairs naturally with the SEO + AEO module so the keyword data feeds the same content engine that ships the pages."
      artifact={
        <SoftFramedArtifact tone="lavender" padding="md" pillLabel="LIVE" bare>
          <SEOTrendChart />
        </SoftFramedArtifact>
      }
    />
  );
}
