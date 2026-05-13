import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SplitHero, SplitSection } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { SeoAnswer } from "@/components/platform/artifacts/seo-answer";
import {
  ChatGPTMark, PerplexityMark, ClaudeMark, GeminiMark, GoogleMark,
} from "@/components/platform/artifacts/brand-logos";

export const metadata: Metadata = {
  title: "Pages that rank in Google and get quoted by AI search",
  description:
    "Per-location pages written to rank on Google and to be cited by ChatGPT, Perplexity, Claude, and Gemini. One playbook, one piece of content.",
};

export default function SEOAEOFeaturePage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <SplitHero
        eyebrow="Search and AI discovery"
        headline="Pages that rank in Google"
        headlineAccent="and get quoted by AI search."
        subhead="A growing share of prospects ask ChatGPT or Perplexity for housing recommendations before they ever open Google. If you're not in Google's index and not cited by the AI engines, you're invisible. We build per-location pages that show up in both, using the same content."
        ctas={[
          { label: "Book a demo", href: "/onboarding" },
          { label: "See it live", href: "/demo", variant: "secondary" },
        ]}
        caption="Per-location coverage · schema on every page · monthly AI-discovery audit"
        artifact={<SeoAnswer />}
      />

      <SplitSection
        eyebrow="What this does for you"
        headline="Be the answer wherever prospects search."
        body="Every page we ship is written to be the answer when a prospect asks Google, ChatGPT, Perplexity, Claude, or Gemini about your market. One piece of content, ranking on Google and getting cited by the AI engines. No separate AI-content layer."
        bullets={[
          "Per-neighborhood, per-unit-type pages for the questions your prospects actually ask.",
          "Your brand, address, and amenities tagged so AI engines can quote them accurately.",
          "Fast, mobile-ready pages built to pass Google's ranking checks without your input.",
          "A monthly audit that shows where you're being cited and where we're closing the gap.",
        ]}
        side="right"
        artifact={<CitedByAI />}
      />

      <SplitSection
        eyebrow="The AI-discovery audit"
        headline="We ask the engines about you every month."
        body="Once a month we run a scripted set of prompts against ChatGPT, Perplexity, and Claude using the questions your prospects ask. We log who got cited, who didn't, and which of your pages were quoted. Then we close the gaps on the next page release."
        side="left"
        background="#FFFFFF"
        artifact={<AuditGrid />}
      />

      <SplitSection
        eyebrow="What to expect"
        headline="Be the answer, not another blue link."
        bullets={[
          "Page one for the long-tail queries your leasing team already answers every day.",
          "Named citations when prospects ask ChatGPT or Perplexity about your market.",
          "Organic traffic and conversion, attributed end-to-end in your weekly report.",
          "A month-over-month record of AI citations. You see the gap close in writing.",
        ]}
        side="right"
        background="#F1F5F9"
        artifact={<RankProgress />}
      />

      <FinalBand />
    </div>
  );
}

function CitedByAI() {
  const engines: Array<{ name: string; mark: ReactNode; line: string }> = [
    { name: "ChatGPT",     mark: <ChatGPTMark size={22} />,     line: "\"A flagship student-housing property. Steps from campus, fully furnished, wifi included.\"" },
    { name: "Perplexity",  mark: <PerplexityMark size={22} />,  line: "\"The top-rated option for students searching in this neighborhood.\"" },
    { name: "Claude",      mark: <ClaudeMark size={22} />,      line: "\"For students near campus, this property offers furnished rooms with utilities included.\"" },
    { name: "Gemini",      mark: <GeminiMark size={22} />,      line: "\"A highly-rated student-housing option close to the main campus quad.\"" },
    { name: "Google",      mark: <GoogleMark size={22} />,      line: "\"Best student housing near campus.\" Ranked #1 for the query." },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #E2E8F0, 0 20px 60px rgba(30, 42, 58,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between gap-3"
        style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 600,
          }}
        >
          Where your brand gets quoted
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#2563EB",
            fontWeight: 600,
          }}
        >
          5 of 5 engines · this month
        </span>
      </div>
      <ul>
        {engines.map((e, i) => (
          <li
            key={e.name}
            className="flex items-start gap-3 px-5 py-3.5"
            style={{ borderBottom: i < engines.length - 1 ? "1px solid #E2E8F0" : "none" }}
          >
            <span className="flex-shrink-0 mt-0.5">{e.mark}</span>
            <div className="flex-1 min-w-0">
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "#1E2A3A",
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {e.name}
              </p>
              <p
                className="mt-1"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "#64748B",
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}
              >
                {e.line}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div
        className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 500,
          }}
        >
          Ask any of them about your market. You're the answer
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: "rgba(135,134,127,0.12)",
            flexShrink: 0,
          }}
        >
          Illustrative
        </span>
      </div>
    </div>
  );
}

function AuditGrid() {
  const queries = [
    { q: "best student housing near campus",             chatgpt: "cited", perplexity: "cited",  google: "#2"  },
    { q: "furnished apartments near main quad",          chatgpt: "cited", perplexity: "cited",  google: "#1"  },
    { q: "affordable off-campus housing",                chatgpt: "cited", perplexity: "not yet", google: "#4"  },
    { q: "student dorms with wifi included",             chatgpt: "cited", perplexity: "cited",  google: "#3"  },
    { q: "downtown student apartments",                  chatgpt: "cited", perplexity: "cited",  google: "#1"  },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #E2E8F0, 0 20px 60px rgba(30, 42, 58,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 600,
          }}
        >
          Monthly audit · April
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#2563EB",
            fontWeight: 600,
          }}
        >
          5 / 5 markets covered
        </span>
      </div>
      <div className="px-4 py-3">
        <div
          className="grid grid-cols-[1fr_70px_70px_60px] gap-3 px-2 pb-2"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 500,
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <span>Query</span>
          <span className="text-center">ChatGPT</span>
          <span className="text-center">Perplexity</span>
          <span className="text-center">Google</span>
        </div>
        {queries.map((r, i) => (
          <div
            key={r.q}
            className="grid grid-cols-[1fr_70px_70px_60px] gap-3 items-center px-2 py-2.5"
            style={{
              borderBottom: i < queries.length - 1 ? "1px solid #E2E8F0" : "none",
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              color: "#1E2A3A",
            }}
          >
            <span className="truncate">"{r.q}"</span>
            <AuditBadge value={r.chatgpt} />
            <AuditBadge value={r.perplexity} />
            <span
              className="text-center"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "#1E2A3A",
                fontWeight: 600,
              }}
            >
              {r.google}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditBadge({ value }: { value: string }) {
  const cited = value === "cited";
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "5px",
        backgroundColor: cited ? "rgba(37,99,235,0.12)" : "transparent",
        color: cited ? "#2563EB" : "#94A3B8",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: cited ? "uppercase" : "none",
      }}
    >
      {cited ? "cited" : "not yet"}
    </span>
  );
}

function RankProgress() {
  const items = [
    { keyword: "student housing near campus",      before: 18, after: 2  },
    { keyword: "furnished apartments near quad",   before: 11, after: 1  },
    { keyword: "off-campus housing",               before: 22, after: 4  },
    { keyword: "downtown student apartments",      before: 8,  after: 1  },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #E2E8F0, 0 20px 60px rgba(30, 42, 58,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 600,
          }}
        >
          Rank movement · last 90 days
        </span>
      </div>
      <ul className="px-4 py-3">
        {items.map((it, i) => {
          const maxRank = 25;
          const beforePct = Math.min(it.before / maxRank, 1) * 100;
          const afterPct  = Math.min(it.after / maxRank, 1) * 100;
          return (
            <Reveal key={it.keyword} delay={i * 80}>
              <li className="py-3" style={{ borderBottom: i < items.length - 1 ? "1px solid #E2E8F0" : "none" }}>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="truncate"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#1E2A3A",
                      fontWeight: 500,
                    }}
                  >
                    "{it.keyword}"
                  </span>
                  <span
                    className="flex-shrink-0"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: "#16A34A",
                      fontWeight: 600,
                    }}
                  >
                    #{it.before} → #{it.after}
                  </span>
                </div>
                <div
                  className="relative"
                  style={{ height: "6px", backgroundColor: "#E2E8F0", borderRadius: "3px", overflow: "hidden" }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${100 - afterPct}%`,
                      backgroundColor: "#2563EB",
                      borderRadius: "3px",
                      transition: "width 800ms ease",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: `${100 - beforePct}%`,
                      top: 0,
                      height: "100%",
                      width: "2px",
                      backgroundColor: "#94A3B8",
                    }}
                  />
                </div>
              </li>
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
}

function FinalBand() {
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <Reveal>
          <p
            style={{
              color: "#94A3B8",
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
              color: "#1E2A3A",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 500,
              lineHeight: 1.35,
            }}
          >
            Operators with multiple properties or markets who rely on organic traffic. Pairs with the managed ads module so organic volume and paid conversions show up in the same report.
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
