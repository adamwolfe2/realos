import type { Metadata } from "next";
import { VerticalLanding } from "@/components/platform/vertical-landing";
import { NurtureTimeline } from "@/components/platform/artifacts/nurture-timeline";

export const metadata: Metadata = {
  title: "Senior living leasing intelligence that respects the family",
  description:
    "LeaseStack gives senior living operators family-first nurture sequences, compliance-aware creative, and a marketing report the executive director and the family can both read.",
};

export default function SeniorLivingPage() {
  return (
    <VerticalLanding
      eyebrow="Senior living"
      headline="Your community's marketing data."
      headlineAccent="Finally working for you."
      subhead="Senior living decisions take 90 to 180 days, and the adult child is the one researching. LeaseStack is the leasing intelligence platform that runs patient, family-first nurture across that window, keeps creative compliant at every step, and gives the executive director one clear answer to the question the family is asking."
      caption="The marketing report writes itself in language the executive director and the family can both read."
      artifact={<NurtureTimeline />}
      painsHeading="What senior living operators tell us."
      modulesHeading="What you get the day you turn it on."
      pains={[
        {
          title: "90 to 180 day consideration windows",
          body: "Short-cycle marketing tools assume the lead converts in two weeks. Senior living families come back in month four, on a Sunday, after a hospital visit. The nurture has to be waiting.",
        },
        {
          title: "Compliance pressure on every claim",
          body: "Care-level descriptions, memory-care language, ADA accommodations, Fair Housing in adjacent demographics. Template creative does not survive a regulatory review.",
        },
        {
          title: "Two audiences in one funnel",
          body: "The resident is the customer. The adult child is the researcher and the buyer. The funnel has to speak to both without confusing either.",
        },
      ]}
      modules={[
        {
          title: "Family-first site structure",
          body: "Separate narratives for the resident and the adult child, with messaging and imagery that honor the decision they are making together.",
        },
        {
          title: "Long-cycle nurture sequences",
          body: "Month one, quarter one, and year-one touch points keep the community top of mind through the months a family takes to be ready.",
        },
        {
          title: "Compliance-aware ad creative",
          body: "Every ad and landing page passes a Fair Housing and ADA review before it goes live, with the creative library kept current as regulations change.",
        },
        {
          title: "AI assistant with human handoff",
          body: "Answers practical questions about pricing, care levels, and visiting hours at any hour, and hands sensitive conversations to your community liaison the same morning.",
        },
        {
          title: "Reputation and review integration",
          body: "A Place for Mom, Caring.com, and Google reviews surfaced in one view and responded to from one inbox, so the public story stays consistent.",
        },
        {
          title: "One report for the ED and the family",
          body: "A monthly report the executive director can hand to ownership and a family-facing summary the adult child can read in five minutes. Same data, two audiences.",
        },
      ]}
    />
  );
}
