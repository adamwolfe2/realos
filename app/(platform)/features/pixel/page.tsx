import type { Metadata } from "next";
import { SplitHero } from "@/components/platform/split-hero";
import { VisitorStream } from "@/components/platform/artifacts/visitor-stream";

export const metadata: Metadata = {
  title: "Know who visited your website, not just how many",
  description:
    "Names and emails on a meaningful share of your anonymous site traffic. Fed straight into your CRM and ad audiences.",
};

// Hero-only page (Adam 2026-07-24): the animated VisitorStream IS the pitch.
// The old What-you-see / pipeline / results scroll sections were cut.

export default function PixelFeaturePage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Visitor identification"
        headline="Know who visited your website,"
        headlineAccent="not just how many."
        subhead="We give you the name and email behind a meaningful share of your sessions before they fill out a form."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Book a demo", href: "/onboarding", variant: "secondary" },
        ]}
        caption="Live on your site, consented identity graph, fully compliant"
        artifact={<VisitorStream />}
      />
    </div>
  );
}
