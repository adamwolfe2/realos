import type { Metadata } from "next";
import { VerticalLanding } from "@/components/platform/vertical-landing";

export const metadata: Metadata = {
  title: "Multifamily marketing, measured by signed leases",
  description:
    "Portfolio-level marketing platform for multifamily operators: managed site, live listings, identity pixel, AI chatbot, fair-housing-safe creative, retargeting.",
};

export default function MultifamilyPage() {
  return (
    <VerticalLanding
      eyebrow="Multifamily"
      headline="Portfolio-grade marketing without portfolio-grade agency fees."
      subhead="You manage buildings across different cities and demographics. Your marketing stack should speak to each one and roll up into one dashboard."
      pains={[
        {
          title: "Agency spend you can't justify",
          body: "$2,600/mo per property, unclear ROI, no lease attribution. Invoice looks the same whether you leased out or not.",
        },
        {
          title: "Fair-housing compliance headaches",
          body: "Every creative asset needs a review pass. Most agencies don't know the rules; we do.",
        },
        {
          title: "No portfolio rollup",
          body: "You can't tell which property is under-performing without chasing three dashboards and a spreadsheet.",
        },
      ]}
      modules={[
        {
          title: "Portfolio dashboard",
          body: "Single pane of glass across every property, lease velocity, cost-per-lead, ad spend, chatbot pipeline.",
        },
        {
          title: "Fair-housing-safe creative",
          body: "Every ad + landing page passes a HUD-compliance review before it goes live.",
        },
        {
          title: "Retargeting pools, per property",
          body: "Identity graph pixel builds audiences by building, so retargeting respects the community, not just the city.",
        },
        {
          title: "Multi-property SEO + AEO",
          body: "Per-city, per-neighborhood landing pages. LLM answer engines index every property by name.",
        },
        {
          title: "AI chatbot with site-specific knowledge",
          body: "Trained per building on floor plans, amenities, pricing guidance, and move-in dates.",
        },
        {
          title: "Managed paid search + social",
          body: "Google + Meta at 15% of spend. Creative studio ships new angles in 48 hours.",
        },
      ]}
    />
  );
}
