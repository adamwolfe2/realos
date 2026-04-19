import type { Metadata } from "next";
import { FeaturePage } from "@/components/platform/feature-page";

export const metadata: Metadata = {
  title: "AI chatbot with real lead capture, 24/7",
  description:
    "Proactive AI chatbot trained on your property facts, pricing guidance, and application process. Captures leads, routes to your team, never calls itself a bot.",
};

export default function ChatbotFeaturePage() {
  return (
    <FeaturePage
      eyebrow="AI chatbot"
      headline="The assistant that actually fills units."
      subhead="Most leasing chatbots are glorified FAQs. Ours is trained on your live listings, pricing rules, and application process. It speaks like a leasing associate, captures leads, and hands the conversation to your team when the lead is warm."
      whatItIs="A branded AI chatbot that appears on your site with a 5-second idle trigger. Every tenant gets a per-property system prompt composed from the live AppFolio listing data, your knowledge base, and your contact channels."
      howItWorks={[
        "Widget loads with your persona name, avatar, and brand color.",
        "At 5 seconds idle, it introduces itself with a branded greeting.",
        "Claude-powered replies, grounded in your live listing + amenity data. Answers pricing confidently, never fabricates.",
        "Auto-captures name + email + phone when a prospect engages, creates a lead in your CRM, links the transcript.",
        "One-click handoff to your leasing team for hot threads.",
      ]}
      results={[
        "Every captured chat becomes a lead with the full transcript attached.",
        "24/7 response, international students and night-owl parents don't bounce waiting for morning.",
        "Transcripts sync into the lead record for context when your team follows up.",
        "Module flag on Organization lets you disable the widget instantly during staffing changes or launches.",
      ]}
      bestFor="Any property marketing site with organic or paid inbound traffic. Especially powerful for student housing international applicants and senior living family decision makers."
    />
  );
}
