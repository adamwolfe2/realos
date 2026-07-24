import type { Metadata } from "next";
import { SplitHero } from "@/components/platform/split-hero";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";

export const metadata: Metadata = {
  title: "An assistant that captures leads at 2am",
  description:
    "Trained on your units, pricing rules, and application process. Hot leads land with your team the next morning, with the full thread attached.",
};

// Hero-only page (Adam 2026-07-24): the animated ChatDemo IS the pitch.
// The old What-it-is / pipeline / metrics scroll sections were cut.

export default function ChatbotFeaturePage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Leasing assistant"
        headline="An assistant"
        headlineAccent="that captures leads at 2am."
        subhead="Trained on your live units and pricing rules. It answers like your team, captures the lead, and hands off overnight."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Book a demo", href: "/onboarding", variant: "secondary" },
        ]}
        caption="Live 24/7, trained on your units, captures leads to your CRM"
        artifact={<ChatDemo />}
      />
    </div>
  );
}
