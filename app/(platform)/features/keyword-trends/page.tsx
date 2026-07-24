import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";
import { SEOTrendChart } from "@/components/platform/artifacts/seo-trend-chart";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Keyword trends · ${BRAND_NAME}`,
  description:
    "Track how your property ranks for the queries your prospects actually search, week over week, across every keyword that matters in your market.",
};

export default function KeywordTrendsFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Keyword trends · Add-on"
      headline="See exactly which queries find your property."
      subhead="Continuous keyword tracking across the queries prospects actually type: ranked positions, trend lines, volume mapped to traffic."
      artifact={
        <SoftFramedArtifact tone="lavender" padding="md" pillLabel="Example data" bare>
          <SEOTrendChart />
        </SoftFramedArtifact>
      }
    />
  );
}
