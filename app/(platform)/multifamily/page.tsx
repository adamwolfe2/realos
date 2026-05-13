import type { Metadata } from "next";
import { VerticalLanding } from "@/components/platform/vertical-landing";
import { PortfolioOccupancy } from "@/components/platform/artifacts/portfolio-occupancy";

export const metadata: Metadata = {
  title: "Multifamily leasing intelligence across the whole portfolio",
  description:
    "LeaseStack rolls up per-property leasing data into one view, attributes signed leases to the channel that produced them, and tells multifamily operators which property is dragging the rollup before the GM does.",
};

export default function MultifamilyPage() {
  return (
    <VerticalLanding
      eyebrow="Multifamily"
      headline="Your portfolio leasing data."
      headlineAccent="Finally working for you."
      subhead="A portfolio is only as healthy as the property pulling the rollup down. LeaseStack is the leasing intelligence platform that gives multifamily operators unit-level attribution across every property and tells you exactly which building, which floor plan, and which channel needs attention this week."
      caption="Know which property is dragging the portfolio rollup before the GM does. Same dashboard for the GM, the AM, and the operator."
      artifact={<PortfolioOccupancy label="Your whole portfolio, one view" />}
      painsHeading="What multifamily operators tell us."
      modulesHeading="What you get the day you turn it on."
      pains={[
        {
          title: "The rollup hides the problem",
          body: "Portfolio averages look fine until one property has been losing on cost-per-lease for three months. The data was there. Nobody could see it.",
        },
        {
          title: "Agency invoices that all look the same",
          body: "Per-property retainers, no signed-lease attribution, the same number every month whether you leased out or not. The check is not the question. The answer is.",
        },
        {
          title: "Fair-housing creative at every unit count",
          body: "Every ad and every landing page needs a compliance pass. At twelve properties it is hard. At forty it is a job nobody on the team actually owns.",
        },
      ]}
      modules={[
        {
          title: "Portfolio rollup with per-property drill-down",
          body: "One dashboard for every property in the portfolio. Lease velocity, cost-per-lead, cost-per-signed-lease, paid spend, chatbot pipeline. Click any tile, see the property.",
        },
        {
          title: "Unit-level attribution",
          body: "Know which channel signed which lease at which property. Roll it up to the portfolio. Drill it down to a floor plan. Stop guessing.",
        },
        {
          title: "Per-property retargeting pools",
          body: "Identity pixel builds audience pools by building, not by metro. Retargeting respects the community the lead actually visited, not the city it sits in.",
        },
        {
          title: "Fair-housing-reviewed creative",
          body: "Every ad and every landing page gets a HUD-compliance pass before it goes live. Reviewed copy, reviewed imagery, documented for your records.",
        },
        {
          title: "Per-city and per-neighborhood SEO and AEO",
          body: "Every property gets its own search and answer-engine footprint, so the lead who searched for your neighborhood lands on the right building.",
        },
        {
          title: "AI leasing assistant trained per building",
          body: "Floor plans, amenities, pricing guidance, and move-in dates loaded per property. The same assistant pattern, the right answers per address.",
        },
      ]}
    />
  );
}
