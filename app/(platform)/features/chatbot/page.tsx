import type { Metadata } from "next";
import { Bot, ClipboardCheck, MessageSquareText, TrendingUp } from "lucide-react";
import { SplitHero } from "@/components/platform/split-hero";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";

export const metadata: Metadata = {
  title: "An assistant that captures leads at 2am",
  description:
    "Trained on your units, pricing rules, and application process. Hot leads land with your team the next morning, with the full thread attached.",
};

export default function ChatbotFeaturePage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Leasing assistant"
        headline="An assistant"
        headlineAccent="that captures leads at 2am."
        subhead="Preview the setup before you create an account. Then train the assistant on your live units, pricing rules, objections, and handoff process."
        ctas={[
          { label: "Preview chatbot setup", href: "/onboarding" },
          { label: "Create account", href: "/sign-up", variant: "secondary" },
        ]}
        caption="No card to preview. Account needed only when you save and install."
        artifact={<ChatDemo />}
      />

      <section className="border-t border-[#E0E0E0] bg-white px-4 py-14 md:px-10 md:py-18">
        <div className="mx-auto max-w-[1160px]">
          <div className="max-w-[720px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0F62FE]">
              Built for self-serve evaluation
            </p>
            <h2 className="mt-3 font-display text-[30px] font-normal leading-[1.08] tracking-[-0.02em] text-[#161616] sm:text-[40px]">
              The first experience is the product, not a sales form.
            </h2>
            <p className="mt-4 text-[16px] leading-7 text-[#6F6F6F]">
              Prospects can configure a draft assistant, see how it handles a leasing conversation, and understand the handoff before deciding to save it inside a workspace.
            </p>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-4">
            {[
              {
                icon: Bot,
                title: "Configure first",
                body: "Property name, website, goals, and key facts are collected before account creation.",
              },
              {
                icon: MessageSquareText,
                title: "Preview replies",
                body: "The setup shows what the assistant will say and where it needs better property knowledge.",
              },
              {
                icon: ClipboardCheck,
                title: "Hand off leads",
                body: "Captured conversations become follow-up drafts and tasks for the leasing team.",
              },
              {
                icon: TrendingUp,
                title: "Learn from drop-off",
                body: "The learning loop turns missed objections into chatbot knowledge and site improvements.",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="border border-[#E0E0E0] bg-white p-4">
                  <Icon className="h-5 w-5 text-[#0F62FE]" />
                  <h3 className="mt-4 text-[14px] font-semibold text-[#161616]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-5 text-[#6F6F6F]">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
