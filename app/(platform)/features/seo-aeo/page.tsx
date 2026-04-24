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
  title: "Search and AI discovery for real estate operators",
  description:
    "Rank in Google. Get recommended by ChatGPT and Perplexity. Per-location landing pages, sitemap automation, schema markup, monthly audits.",
};

export default function SEOAEOFeaturePage() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <SplitHero
        eyebrow="Search + AI discovery"
        headline="Rank in Google."
        headlineAccent="Get recommended by ChatGPT."
        subhead="Prospects now ask AI for housing options before they open a search tab. If your pages aren't in Google's index and aren't cited by ChatGPT or Perplexity, you're invisible. We build the infrastructure so both surface you."
        ctas={[
          { label: "Book a demo", href: "/onboarding" },
          { label: "See it live", href: "/#live", variant: "secondary" },
        ]}
        caption="Schema on every page · dynamic sitemap · monthly AI-discovery audit"
        artifact={<SeoAnswer />}
      />

      <SplitSection
        eyebrow="What this does for you"
        headline="Be the answer across every place people search."
        body="Every page we ship for you is written to be the answer when a prospect asks Google, ChatGPT, Perplexity, Claude, or Gemini about your market. One playbook. Better Google rankings and better AI citations."
        bullets={[
          "Per-neighborhood, per-unit-type pages for the questions your prospects actually ask.",
          "Your brand, your address, your amenities tagged so AI engines can quote them.",
          "Fast pages, mobile-ready, built to pass Google's ranking checks without you worrying about it.",
          "A monthly audit that tells you exactly where you're showing up, and where we're closing the gap.",
        ]}
        side="right"
        artifact={<CitedByAI />}
      />

      <SplitSection
        eyebrow="The AI-discovery audit"
        headline="We ask the bots about you every month."
        body="Once a month we run a scripted interrogation of ChatGPT, Perplexity, and Claude across the questions your prospects actually ask. We log who gets cited, who doesn't, and which of your pages got quoted. Then we close the gaps."
        side="left"
        background="#f5f4ed"
        artifact={<AuditGrid />}
      />

      <SplitSection
        eyebrow="What to expect"
        headline="Be the answer, not another blue link."
        bullets={[
          "Climb to page one for the long-tail queries your leasing team already answers daily.",
          "Be the named citation when prospects ask ChatGPT or Perplexity about your market.",
          "Organic traffic and conversion, attributed end-to-end in your weekly report.",
          "A month-over-month audit trail of LLM citations. We track the gap, then close it.",
        ]}
        side="right"
        background="#faf9f5"
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
        boxShadow: "0 0 0 1px #f0eee6, 0 20px 60px rgba(20,20,19,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between gap-3"
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
            style={{ borderBottom: i < engines.length - 1 ? "1px solid #f0eee6" : "none" }}
          >
            <span className="flex-shrink-0 mt-0.5">{e.mark}</span>
            <div className="flex-1 min-w-0">
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "#141413",
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
                  color: "#5e5d59",
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
        className="px-5 py-3"
        style={{ borderTop: "1px solid #f0eee6", backgroundColor: "#faf9f5" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#87867f",
            fontWeight: 500,
          }}
        >
          Ask any of them about your market. You'll be the answer
        </span>
      </div>
    </div>
  );
}

function AuditGrid() {
  const queries = [
    { q: "best student housing near campus",             chatgpt: "cited", perplexity: "cited",  google: "#2"  },
    { q: "furnished apartments near main quad",          chatgpt: "cited", perplexity: "cited",  google: "#1"  },
    { q: "affordable off-campus housing",                chatgpt: "cited", perplexity: "—",      google: "#4"  },
    { q: "student dorms with wifi included",             chatgpt: "cited", perplexity: "cited",  google: "#3"  },
    { q: "downtown student apartments",                  chatgpt: "cited", perplexity: "cited",  google: "#1"  },
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
        className="px-5 py-3 flex items-center justify-between"
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
            color: "#87867f",
            fontWeight: 500,
            borderBottom: "1px solid #f0eee6",
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
              borderBottom: i < queries.length - 1 ? "1px solid #f0eee6" : "none",
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              color: "#141413",
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
                color: "#141413",
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
        color: cited ? "#2563EB" : "#87867f",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: cited ? "uppercase" : "none",
      }}
    >
      {cited ? "cited" : "—"}
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
        boxShadow: "0 0 0 1px #f0eee6, 0 20px 60px rgba(20,20,19,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
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
              <li className="py-3" style={{ borderBottom: i < items.length - 1 ? "1px solid #f0eee6" : "none" }}>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="truncate"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#141413",
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
                      color: "#3a7d44",
                      fontWeight: 600,
                    }}
                  >
                    #{it.before} → #{it.after}
                  </span>
                </div>
                <div
                  className="relative"
                  style={{ height: "6px", backgroundColor: "#f0eee6", borderRadius: "3px", overflow: "hidden" }}
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
                      backgroundColor: "#87867f",
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
            Operators with multiple properties or markets who rely on organic traffic.
            Pairs with the managed ads module. Organic volume plus paid conversions.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/onboarding" className="btn-primary">
              Book a demo
            </Link>
            <Link href="/#live" className="btn-secondary">
              See it live
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
