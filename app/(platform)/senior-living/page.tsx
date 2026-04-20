import type { Metadata } from "next";
import { VerticalLanding } from "@/components/platform/vertical-landing";
import { NurtureTimeline } from "@/components/platform/artifacts/nurture-timeline";

export const metadata: Metadata = {
  title: "Senior living marketing that respects the family",
  description:
    "Managed marketing platform for senior living operators: family-first site copy, compliance-aware ads, long-cycle lead nurture, AI chatbot with human handoff.",
};

export default function SeniorLivingPage() {
  return (
    <VerticalLanding
      eyebrow="Senior living"
      headline="Respect the family."
      headlineAccent="Show results."
      subhead="Senior living prospects research for months, often on behalf of a parent. Your marketing stack needs to be patient, compliant, and always ready to hand a warm lead to a real person."
      caption="90+ day journeys · compliance-reviewed creative · human handoff on sensitive threads"
      artifact={<NurtureTimeline />}
      pains={[
        {
          title: "Long, sensitive buying journeys",
          body: "The average senior living consideration window is 90+ days. Short-cycle marketing tools break down.",
        },
        {
          title: "Compliance and care copy",
          body: "Care-level claims, memory care descriptions, and pricing transparency all carry regulatory weight. Template creative won't cut it.",
        },
        {
          title: "Adult-child decision makers",
          body: "You're marketing to the family, not the resident. The funnel has two audiences and two message paths.",
        },
      ]}
      modules={[
        {
          title: "Family-first site structure",
          body: "Separate narratives for residents and their children, with messaging and imagery that honor the decision.",
        },
        {
          title: "Long-cycle lead nurture",
          body: "Month-one, quarter-one, year-one touch points keep you top-of-mind when the family is finally ready.",
        },
        {
          title: "Chatbot with human handoff",
          body: "Answers the practical questions at 2am, hands sensitive conversations to your community liaison by day.",
        },
        {
          title: "HIPAA-safe intake form",
          body: "Capture basics without collecting protected health info until a real person is on the line.",
        },
        {
          title: "Tour + respite stay booking",
          body: "Multi-step tour flow for memory care, assisted living, respite. Flexible to your community's ritual.",
        },
        {
          title: "Reputation + review integration",
          body: "A Place for Mom, Caring.com, Google reviews, surfaced in one view, responded to from one inbox.",
        },
      ]}
    />
  );
}
