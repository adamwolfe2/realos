import type { Metadata } from "next";
import { SplitHero } from "@/components/platform/split-hero";
import { SEOTrendChart } from "@/components/platform/artifacts/seo-trend-chart";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";

export const metadata: Metadata = {
  title: "Pages that rank in Google and get quoted by AI search",
  description:
    "Per-location pages written to rank on Google and to be cited by ChatGPT, Perplexity, Claude, and Gemini. One playbook, one piece of content.",
};

// Hero-only page (Adam 2026-07-24): the animated SEOTrendChart IS the pitch.
// The old What-it-is / bands / final-band scroll sections were cut.

export default function SEOAEOFeaturePage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Search and AI discovery"
        headline="Pages that rank in Google"
        headlineAccent="and get quoted by AI search."
        subhead="Prospects ask ChatGPT and Perplexity before opening Google. We build per-location pages that rank in both, from the same content."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Book a demo", href: "/onboarding", variant: "secondary" },
        ]}
        caption="Per-location coverage, schema on every page, monthly AI-discovery audit"
        artifact={
          // Norman 2026-05-21: SEOTrendChart — animated ramp curve, floating
          // stat callouts, lavender halo via SoftFramedArtifact (`bare`
          // because SEOTrendChart ships its own white surface).
          <SoftFramedArtifact tone="lavender" padding="md" pillLabel="Example data" bare>
            <SEOTrendChart />
          </SoftFramedArtifact>
        }
      />
    </div>
  );
}
