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
        subhead="Trained on your live units and pricing rules. It answers like your team, captures the lead, and hands off overnight."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Book a demo", href: "/onboarding", variant: "secondary" },
        ]}
        caption="Live 24/7, trained on your units, captures leads to your CRM"
        artifact={<ChatDemo />}
      />

      <SplitSection
        eyebrow="What it is"
        headline="It answers like a leasing associate, not a bot."
        body="A widget that loads on your property site with your name, avatar, and brand color. After five seconds of idle, it opens with a greeting. Every reply is grounded in your live unit list, your pricing rules, and your application process, so it never invents an answer."
        bullets={[
          "Trained per property on your live unit list and knowledge base.",
          "Answers pricing, tour scheduling, and lease terms accurately or routes to a human.",
          "Captures name, email, and phone. Lands in your CRM with the full transcript.",
          "Pings your leasing team in Slack the moment a thread runs hot.",
        ]}
        side="right"
        artifact={<ChatConfig />}
      />

      <FullBand
        headline="From first message to CRM record in four steps."
        body="Every conversation runs on a grounded prompt, captures contact details as the prospect warms up, then lands in your CRM with enough context for your leasing team to pick up mid-thread."
        artifact={<ChatPipeline />}
      />

      <FullBand
        background="#f4f4f4"
        headline="Every chat is a lead with context attached."
        bullets={[
          "Covers the after-hours gap so international students and night-shift parents don't bounce waiting for morning.",
          "Transcripts sync to the lead record. Your team picks up mid-thread, not cold.",
          "One toggle on your organization disables the widget instantly during staffing changes.",
          "Weekly chat volume, capture rate, and top intents land in your Monday report.",
        ]}
        artifact={<ChatMetrics />}
      />

      <FinalBand />
    </div>
  );
}

function ChatConfig() {
  const rows: Array<{ k: string; v: string; logos?: ReactNode[] }> = [
    { k: "How it greets",       v: "\"Hi, ask me anything about the property.\"" },
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
        borderRadius: "2px",
        boxShadow: "0 0 0 1px #e0e0e0, 0 20px 60px rgba(15, 23, 42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8d8d8d",
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
            style={{ backgroundColor: i % 2 === 0 ? "#f4f4f4" : "transparent" }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#8d8d8d",
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
                color: "#161616",
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
    { title: "Widget loads",    body: "Your persona, avatar, and brand color render on your domain. Five seconds of idle triggers a greeting." },
    { title: "Grounded reply", body: "Replies pull from your live unit list and knowledge base. Pricing is quoted from what you've approved, never invented." },
    { title: "Progressive capture", body: "As the conversation warms, the assistant asks for name, email, and phone. Conversationally, not robotically." },
    { title: "CRM and handoff",  body: "A lead lands in your CRM with the full transcript. Hot threads ping your leasing Slack so a human can step in." },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "2px",
        boxShadow: "0 0 0 1px #e0e0e0, 0 20px 60px rgba(15, 23, 42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3"
        style={{ borderBottom: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8d8d8d",
            fontWeight: 600,
          }}
        >
          Every conversation, start to lead
        </span>
      </div>
      <ol className="p-5 space-y-3">
        {stages.map((s, i) => (
          <Reveal key={s.title} delay={i * 80}>
            <li className="flex gap-4">
              <div
                aria-hidden="true"
                className="flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "2px",
                  backgroundColor: "rgba(15, 98, 254,0.12)",
                  color: "#0f62fe",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 9l3.5 3.5L12 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14.5px",
                    color: "#161616",
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
                    color: "#6f6f6f",
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
    { label: "Escalated to human",   value: "8",     delta: "hot threads, Slack" },
  ];
  return (
    <div className="w-full">
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#8d8d8d",
          fontWeight: 500,
          marginBottom: "10px",
        }}
      >
        Sample dashboard, illustrative
      </p>
    <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
      {deltas.map((d, i) => (
        <Reveal key={d.label} delay={i * 70}>
          <div
            className="p-5"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "2px",
              boxShadow: "0 0 0 1px #e0e0e0",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#8d8d8d",
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
                color: "#161616",
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
                color: "#0f62fe",
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

function FullBand({
  headline,
  body,
  bullets,
  artifact,
  background = "#FFFFFF",
}: {
  headline: string;
  body?: string;
  bullets?: string[];
  artifact: ReactNode;
  background?: string;
}) {
  return (
    <section style={{ backgroundColor: background }}>
      <div className="max-w-[860px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <Reveal>
          <h2
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 3.2vw, 38px)",
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            {headline}
          </h2>
        </Reveal>
        {body ? (
          <Reveal delay={60}>
            <p
              className="mx-auto mt-4 max-w-[620px]"
              style={{
                color: "#6f6f6f",
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                lineHeight: 1.6,
              }}
            >
              {body}
            </p>
          </Reveal>
        ) : null}
        {bullets ? (
          <ul className="mx-auto mt-6 max-w-[560px] text-left space-y-3">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3"
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  lineHeight: 1.55,
                }}
              >
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center flex-shrink-0 mt-1 w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: "rgba(15,98,254,0.14)",
                    color: "#0f62fe",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M1.5 5L4 7.5L8.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Reveal delay={120} y={24}>
          <div className="mt-10">{artifact}</div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalBand() {
  return (
    <section style={{ backgroundColor: "#f4f4f4" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <Reveal>
          <p
            className="mx-auto max-w-[720px]"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.35,
            }}
          >
            Best for property sites with organic or paid traffic, especially student housing with international applicants and senior living with family decision makers in different time zones.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-primary">
              Request pilot
            </Link>
            <Link href="/onboarding" className="btn-secondary">
              Book a demo
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
