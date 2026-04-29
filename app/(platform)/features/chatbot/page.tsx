import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SplitHero, SplitSection } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";
import {
  CalcomMark, ResendMark, SlackMark,
} from "@/components/platform/artifacts/brand-logos";

export const metadata: Metadata = {
  title: "AI chatbot with real lead capture, 24/7",
  description:
    "Proactive AI chatbot trained on your property facts, pricing guidance, and application process. Captures leads, routes to your team, never calls itself a bot.",
};

export default function ChatbotFeaturePage() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <SplitHero
        eyebrow="AI chatbot"
        headline="The assistant"
        headlineAccent="that actually fills units."
        subhead="Most leasing chatbots are glorified FAQs. Ours is trained on your live listings, pricing rules, and application process. It speaks like a leasing associate, captures leads, and hands the conversation to your team when the lead is warm."
        ctas={[
          { label: "Book a demo", href: "/onboarding" },
          { label: "See it live", href: "/demo", variant: "secondary" },
        ]}
        caption="Live 24/7 · trained on your listings · captures leads directly to CRM"
        artifact={<ChatDemo />}
      />

      <SplitSection
        eyebrow="What it is"
        headline="A branded leasing assistant, not a bot."
        body="A chatbot widget that loads with your persona name, avatar, and brand color. At 5 seconds idle it opens with a branded greeting. Replies are Claude-powered and grounded in your live listing data (pricing, amenities, availability) so it never fabricates."
        bullets={[
          "Per-property system prompt composed from live listing + knowledge base.",
          "Pricing rules, tour scheduling, lease terms. Answered accurately or escalated.",
          "Auto-captures name, email, phone. Creates a lead in CRM with the full transcript.",
          "One-click handoff to your leasing team for hot threads.",
        ]}
        side="right"
        artifact={<ChatConfig />}
      />

      <SplitSection
        eyebrow="How it works"
        headline="Prompt to CRM record in four steps."
        body="Every conversation runs through a grounded system prompt, captures intent progressively, then lands in your CRM with context your leasing team can act on."
        side="left"
        background="#f5f4ed"
        artifact={<ChatPipeline />}
      />

      <SplitSection
        eyebrow="What to expect"
        headline="Every chat is a lead with context attached."
        bullets={[
          "24/7 response so international students and night-owl parents don't bounce waiting for morning.",
          "Transcripts sync to the lead record, your team picks up mid-thread, not cold.",
          "Module flag on the Organization. Disable the widget instantly during staffing changes.",
          "Weekly summary of chat volume, capture rate, and top intents in the Monday report.",
        ]}
        side="right"
        background="#faf9f5"
        artifact={<ChatMetrics />}
      />

      <FinalBand />
    </div>
  );
}

function ChatConfig() {
  const rows: Array<{ k: string; v: string; logos?: ReactNode[] }> = [
    { k: "How it greets",       v: "\"Hi — ask me anything about the property.\"" },
    { k: "When it opens",        v: "After 5 seconds, or when they scroll down" },
    { k: "What it knows",       v: "Your live unit list, amenities, and pricing rules" },
    { k: "When pricing is asked", v: "Quotes what you've approved. Never guesses" },
    { k: "Tours",                v: "Booked inline",                          logos: [<CalcomMark key="cal" size={16} />] },
    { k: "Leads",                v: "Captured and sent to your team",         logos: [<ResendMark key="r" size={16} />] },
    { k: "Hot threads",          v: "Ping your leasing team in real time",    logos: [<SlackMark key="s" size={16} />] },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #f0eee6, 0 20px 60px rgba(20,20,19,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid #f0eee6", backgroundColor: "#faf9f5" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#87867f",
            fontWeight: 600,
          }}
        >
          Trained for your property
        </span>
      </div>
      <ul className="px-2 py-2">
        {rows.map((r, i) => (
          <li
            key={r.k}
            className="grid grid-cols-[160px_1fr_auto] gap-3 items-center px-3 py-2.5 rounded-lg"
            style={{ backgroundColor: i % 2 === 0 ? "#faf9f5" : "transparent" }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#87867f",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {r.k}
            </span>
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#141413",
                fontWeight: 500,
              }}
            >
              {r.v}
            </span>
            {r.logos ? (
              <span className="inline-flex items-center gap-1 flex-shrink-0">{r.logos}</span>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatPipeline() {
  const stages = [
    { num: "01", title: "Widget load",    body: "Persona, avatar, and brand color render on your domain. 5s idle triggers a branded greeting." },
    { num: "02", title: "Grounded reply", body: "Claude-powered reply, grounded in live listings and your knowledge base. Pricing is confirmed, never guessed." },
    { num: "03", title: "Progressive capture", body: "As intent rises, the bot asks for name, email, and phone. Naturally, never robotically." },
    { num: "04", title: "CRM + handoff",  body: "A lead is created with the full transcript. Hot threads ping your leasing Slack channel for a human handoff." },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #f0eee6, 0 20px 60px rgba(20,20,19,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3"
        style={{ borderBottom: "1px solid #f0eee6", backgroundColor: "#faf9f5" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#87867f",
            fontWeight: 600,
          }}
        >
          Every conversation, start to lead
        </span>
      </div>
      <ol className="p-5 space-y-3">
        {stages.map((s, i) => (
          <Reveal key={s.num} delay={i * 80}>
            <li className="flex gap-4">
              <div
                className="flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(37,99,235,0.12)",
                  color: "#2563EB",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                {s.num}
              </div>
              <div className="flex-1">
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14.5px",
                    color: "#141413",
                    fontWeight: 600,
                  }}
                >
                  {s.title}
                </p>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13.5px",
                    color: "#5e5d59",
                    lineHeight: 1.55,
                  }}
                >
                  {s.body}
                </p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

function ChatMetrics() {
  const deltas = [
    { label: "Chats this week",      value: "284",   delta: "live on 4 domains" },
    { label: "Leads captured",       value: "96",    delta: "34% capture rate" },
    { label: "Tours scheduled",      value: "22",    delta: "from chat, last 7 days" },
    { label: "Escalated to human",   value: "8",     delta: "hot threads · Slack" },
  ];
  return (
    <div className="w-full">
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#87867f",
          fontWeight: 500,
          marginBottom: "10px",
        }}
      >
        Sample dashboard · illustrative
      </p>
    <div className="grid grid-cols-2 gap-3">
      {deltas.map((d, i) => (
        <Reveal key={d.label} delay={i * 70}>
          <div
            className="p-5"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#87867f",
                fontWeight: 500,
              }}
            >
              {d.label}
            </p>
            <p
              className="mt-1.5"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "32px",
                color: "#141413",
                fontWeight: 500,
                lineHeight: 1.05,
              }}
            >
              {d.value}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#2563EB",
                fontWeight: 600,
              }}
            >
              {d.delta}
            </p>
          </div>
        </Reveal>
      ))}
      </div>
    </div>
  );
}

function FinalBand() {
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <Reveal>
          <p
            style={{
              color: "#87867f",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: "16px",
            }}
          >
            Best for
          </p>
        </Reveal>
        <Reveal delay={60}>
          <p
            className="mx-auto max-w-[720px]"
            style={{
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.35,
            }}
          >
            Property marketing sites with organic or paid inbound traffic.
            Especially powerful for student housing international applicants and senior living family decision makers.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/onboarding" className="btn-primary">
              Book a demo
            </Link>
            <Link href="/demo" className="btn-secondary">
              See it live
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
