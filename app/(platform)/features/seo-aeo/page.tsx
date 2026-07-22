import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SplitHero, SplitSection } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
// SeoAnswer (static AI-citation card) replaced by the animated
// SEOTrendChart below — kept the import path commented as a
// breadcrumb in case we want to bring the static card back to a
// secondary section.
// import { SeoAnswer } from "@/components/platform/artifacts/seo-answer";
import { SEOTrendChart } from "@/components/platform/artifacts/seo-trend-chart";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
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
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Search and AI discovery"
        headline="Pages that rank in Google"
        headlineAccent="and get quoted by AI search."
        subhead="Prospects ask ChatGPT and Perplexity before opening Google. We build per-location pages that rank in both, from the same content."
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Book a demo", href: "/onboarding", variant: "secondary" },
        ]}
        caption="Per-location coverage, schema on every page, monthly AI-discovery audit"
        // Norman 2026-05-21: the static SeoAnswer card read flat.
        // Swapped for the new SEOTrendChart — animated ramp curve,
        // three floating stat-modal callouts pop in on scroll, soft
        // brand-blue grid + perspective tilt for the 3D feel. Wrapped
        // in SoftFramedArtifact for the lavender halo. `bare` because
        // SEOTrendChart ships its own white surface.
        artifact={
          <SoftFramedArtifact tone="lavender" padding="md" pillLabel="Example data" bare>
            <SEOTrendChart />
          </SoftFramedArtifact>
        }
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

      <FullBand
        headline="We ask the engines about you every month."
        body="Once a month we run a scripted set of prompts against ChatGPT, Perplexity, and Claude using the questions your prospects ask. We log who got cited, who didn't, and which of your pages were quoted. Then we close the gaps on the next page release."
        artifact={<AuditGrid />}
      />

      <FullBand
        background="#f4f4f4"
        headline="Be the answer, not another blue link."
        bullets={[
          "Page one for the long-tail queries your leasing team already answers every day.",
          "Named citations when prospects ask ChatGPT or Perplexity about your market.",
          "Organic traffic and conversion, attributed end-to-end in your weekly report.",
          "A month-over-month record of AI citations. You see the gap close in writing.",
        ]}
        artifact={<RankProgress />}
      />

      <FinalBand />
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
        borderRadius: "2px",
        boxShadow: "0 0 0 1px #e0e0e0, 0 20px 60px rgba(15, 23, 42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between gap-3"
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
          Where your brand gets quoted
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#0f62fe",
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
            style={{ borderBottom: i < engines.length - 1 ? "1px solid #e0e0e0" : "none" }}
          >
            <span className="flex-shrink-0 mt-0.5">{e.mark}</span>
            <div className="flex-1 min-w-0">
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "#161616",
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
                  color: "#6f6f6f",
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
        style={{ borderTop: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8d8d8d",
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
            color: "#8d8d8d",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: "rgba(135,134,127,0.12)",
            flexShrink: 0,
          }}
        >
          Example data
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
        borderRadius: "2px",
        boxShadow: "0 0 0 1px #e0e0e0, 0 20px 60px rgba(15, 23, 42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
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
          Monthly audit · April
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#0f62fe",
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
            color: "#8d8d8d",
            fontWeight: 500,
            borderBottom: "1px solid #e0e0e0",
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
              borderBottom: i < queries.length - 1 ? "1px solid #e0e0e0" : "none",
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              color: "#161616",
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
                color: "#161616",
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
        backgroundColor: cited ? "rgba(15, 98, 254,0.12)" : "transparent",
        color: cited ? "#0f62fe" : "#8d8d8d",
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
        borderRadius: "2px",
        boxShadow: "0 0 0 1px #e0e0e0, 0 20px 60px rgba(15, 23, 42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
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
              <li className="py-3" style={{ borderBottom: i < items.length - 1 ? "1px solid #e0e0e0" : "none" }}>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="truncate"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#161616",
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
                      color: "#24a148",
                      fontWeight: 600,
                    }}
                  >
                    #{it.before} → #{it.after}
                  </span>
                </div>
                <div
                  className="relative"
                  style={{ height: "6px", backgroundColor: "#e0e0e0", borderRadius: "3px", overflow: "hidden" }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${100 - afterPct}%`,
                      backgroundColor: "#0f62fe",
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
                      backgroundColor: "#8d8d8d",
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
    <section style={{ backgroundColor: "#f4f4f4" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <Reveal delay={60}>
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
            Best for operators with multiple properties or markets who rely on organic traffic. Pairs with the managed ads module so organic volume and paid conversions show up in the same report.
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
