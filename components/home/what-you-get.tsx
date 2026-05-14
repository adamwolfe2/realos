import {
  MetaMark,
  GoogleMark,
  TikTokMark,
  SlackMark,
  CalcomMark,
  ResendMark,
  GA4Mark,
  AppFolioMark,
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
  LinkedInMark,
  VercelMark,
  FigmaMark,
} from "@/components/platform/artifacts/brand-logos";
import {
  Phone,
  Eye,
  Rocket,
  TrendingDown,
  LineChart,
  Layers,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// WhatYouGet — editorial rewrite (drastic structural change).
//
// Was: 8 generic icon-card grid + random colored timeline pills.
// Now: three-pillar editorial block at the top → integrated module strip
//      with real brand logos → clean horizontal launch track at the bottom.
//
// Single column of typographic rhythm, not a grid of disconnected cards.
// ---------------------------------------------------------------------------

const PILLARS = [
  {
    num: "01",
    headline: "Full visibility.",
    body: "Every lead source, every channel, every conversion tracked, aggregated, and reported automatically. No spreadsheets. No agency black boxes.",
    proof: "100% spend tracked to lease",
  },
  {
    num: "02",
    headline: "Recommendations, not just reports.",
    body: "LeaseStack does not just show you what happened. It tells you what to do next, prioritized by impact, ready for your Monday morning.",
    proof: "3 next actions delivered weekly",
  },
  {
    num: "03",
    headline: "Operator-built, priced for the market.",
    body: "Not a generic SaaS retrofitted to housing. Not an agency with a reporting layer bolted on. A purpose-built platform from someone who managed the lease-up.",
    proof: "Replaces the typical agency retainer",
  },
];

type Module = {
  title: string;
  body: string;
  logos: React.ReactNode[];
};

const MODULES: Module[] = [
  {
    title: "Your weekly report writes itself",
    body: "Leases attributed to source, pacing vs. last cycle, anomalies flagged, and the three actions to take this week. One page, readable over coffee.",
    logos: [<ResendMark key="r" size={16} />, <SlackMark key="s" size={16} />],
  },
  {
    title: "Know who visited your site",
    body: "Not just how many. Names and emails on a meaningful share of your anonymous traffic, fed straight into your CRM.",
    logos: [<GA4Mark key="ga" size={16} />, <LinkedInMark key="li" size={16} />],
  },
  {
    title: "An assistant that captures leads at 2am",
    body: "Trained on your units, pricing rules, and application process. Hot leads land with your team the next morning, thread attached.",
    logos: [<ClaudeMark key="cl" size={16} />, <CalcomMark key="c" size={16} />],
  },
  {
    title: "Ads with attribution to the lease",
    body: "Google and Meta, geo-fenced and retargeted, creative refreshed weekly. Spend tied back to lease signings, not impressions.",
    logos: [<MetaMark key="m" size={16} />, <GoogleMark key="g" size={16} />, <TikTokMark key="t" size={16} />],
  },
  {
    title: "Pages quoted by AI search",
    body: "Written to rank in Google and to be cited by ChatGPT, Perplexity, Claude, and Gemini. Per-location coverage.",
    logos: [<ChatGPTMark key="c" size={16} />, <PerplexityMark key="p" size={16} />, <ClaudeMark key="cl" size={16} />, <GeminiMark key="gem" size={16} />, <GoogleMark key="g" size={16} />],
  },
  {
    title: "One pipeline. Every channel.",
    body: "Forms, exit intent, chat, calls, scheduling links. Every lead lands in one place, source attached, routed to your team.",
    logos: [<AppFolioMark key="af" size={16} />, <VercelMark key="v" size={16} />, <FigmaMark key="f" size={16} />],
  },
];

export function WhatYouGet() {
  return (
    <section
      style={{
        backgroundColor: "#F1F5F9",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-16 md:py-24">
        {/* Section header */}
        <div className="max-w-3xl mb-20">
          <p className="eyebrow mb-4">What you get</p>
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(36px, 5.2vw, 64px)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
            }}
          >
            The intelligence layer
            <br />
            <span style={{ color: "#2563EB" }}>your stack is missing.</span>
          </h2>
          <p
            className="mt-6 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
            }}
          >
            LeaseStack connects to what you already run and turns it into
            one weekly read. Visibility, recommendations, and the work done
            for you.
          </p>
        </div>

        {/* Three pillars — editorial, not card-grid */}
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12 mb-24 md:mb-32">
          {PILLARS.map((p) => (
            <li key={p.num}>
              <p
                style={{
                  color: "#2563EB",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  letterSpacing: "0.2em",
                  fontWeight: 700,
                }}
              >
                {p.num}
              </p>
              <h3
                className="mt-3"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(22px, 2.4vw, 28px)",
                  fontWeight: 700,
                  lineHeight: 1.18,
                  letterSpacing: "-0.02em",
                }}
              >
                {p.headline}
              </h3>
              <p
                className="mt-4"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15.5px",
                  lineHeight: 1.6,
                }}
              >
                {p.body}
              </p>
              <p
                className="mt-5 pt-4"
                style={{
                  borderTop: "1px solid #E2E8F0",
                  color: "#1E2A3A",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11.5px",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}
              >
                <span style={{ color: "#16A34A" }}>●</span>&nbsp;&nbsp;{p.proof}
              </p>
            </li>
          ))}
        </ol>

        {/* Module strip — replaces the 8-card grid. Two-column list, each
            row a clean editorial line with real brand logos on the right. */}
        <div className="mb-24 md:mb-32">
          <div className="flex items-end justify-between gap-6 mb-10 flex-wrap">
            <h3
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(24px, 2.8vw, 32px)",
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                maxWidth: "560px",
              }}
            >
              Inside the platform.
            </h3>
            <p
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                lineHeight: 1.55,
                maxWidth: "420px",
              }}
            >
              Six modules, one login. We run them. You review the weekly
              report.
            </p>
          </div>

          <ul
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {MODULES.map((m, i) => (
              <li
                key={m.title}
                className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:gap-10 px-6 md:px-8 py-6 md:py-7"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid #E2E8F0",
                  alignItems: "center",
                }}
              >
                <div>
                  <h4
                    style={{
                      color: "#1E2A3A",
                      fontFamily: "var(--font-sans)",
                      fontSize: "19px",
                      fontWeight: 600,
                      lineHeight: 1.3,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {m.title}
                  </h4>
                  <p
                    className="mt-2 max-w-2xl"
                    style={{
                      color: "#64748B",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14.5px",
                      lineHeight: 1.55,
                    }}
                  >
                    {m.body}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 md:justify-end opacity-80">
                  {m.logos}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <LaunchTrack />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// LaunchTrack — clean horizontal narrative, killed the colored pills.
// ---------------------------------------------------------------------------

type LaunchStep = {
  when: string;
  title: string;
  body: string;
  marker: "before" | "launch" | "after";
  icon: LucideIcon;
};

const LAUNCH_STEPS: LaunchStep[] = [
  {
    when: "Day 1",
    title: "Intake call",
    body: "Thirty minutes. We audit your stack live and lock the build plan.",
    marker: "before",
    icon: Phone,
  },
  {
    when: "Day 7",
    title: "Site preview",
    body: "Your custom site on a staging URL. You comment, we iterate.",
    marker: "before",
    icon: Eye,
  },
  {
    when: "Day 14",
    title: "Live on your domain",
    body: "DNS flipped. Pixel firing. Chatbot answering. Ads running.",
    marker: "launch",
    icon: Rocket,
  },
  {
    when: "Day 30",
    title: "First leases attributed",
    body: "Visitor pixel naming traffic. Tours booking. AI insights flowing.",
    marker: "after",
    icon: LineChart,
  },
  {
    when: "Day 60",
    title: "Cost curves drop",
    body: "Ads optimized. Creative refreshing weekly. AI search citing your pages.",
    marker: "after",
    icon: TrendingDown,
  },
  {
    when: "Day 90",
    title: "Compounding",
    body: "Portfolio-wide visibility. Identified visitors in CRM. Real growth.",
    marker: "after",
    icon: Layers,
  },
];

function LaunchTrack() {
  return (
    <div>
      <div className="mb-10 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="eyebrow mb-3">Your first 90 days</p>
          <h3
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(24px, 2.8vw, 34px)",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            Live in fourteen days. Compounding from day one.
          </h3>
        </div>
        <p
          style={{
            color: "#94A3B8",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Day 14 = Launch
        </p>
      </div>

      {/* Horizontal track with a continuous baseline so the timeline reads
          as one connected story instead of six floating cards. */}
      <div className="relative">
        <div
          aria-hidden
          className="hidden md:block absolute"
          style={{
            top: 13,
            left: "5%",
            right: "5%",
            height: 1,
            backgroundColor: "#E2E8F0",
            zIndex: 0,
          }}
        />
        <div
          aria-hidden
          className="hidden md:block absolute"
          style={{
            top: 11,
            left: "5%",
            width: "calc(35% - 5%)",
            height: 5,
            backgroundColor: "#2563EB",
            borderRadius: 1,
            zIndex: 0,
          }}
        />

        <ol className="relative grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-10 z-10">
          {LAUNCH_STEPS.map((s) => {
            const isLaunch = s.marker === "launch";
            const isBefore = s.marker === "before";
            const Icon = s.icon;
            const isActive = isLaunch || isBefore;
            return (
              <li key={s.when} className="relative">
                {/* Dot + Day label sit on the timeline baseline */}
                <div className="flex items-center gap-2 mb-5">
                  <span
                    aria-hidden
                    style={{
                      width: isLaunch ? 16 : 10,
                      height: isLaunch ? 16 : 10,
                      borderRadius: "50%",
                      backgroundColor: isLaunch
                        ? "#2563EB"
                        : isBefore
                          ? "#2563EB"
                          : "#CBD5E1",
                      boxShadow: isLaunch
                        ? "0 0 0 4px rgba(37,99,235,0.15)"
                        : "none",
                      transition: "all 200ms ease",
                    }}
                  />
                  <span
                    style={{
                      color: isLaunch ? "#2563EB" : "#64748B",
                      fontFamily: "var(--font-mono)",
                      fontSize: "10.5px",
                      letterSpacing: "0.16em",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {s.when}
                  </span>
                </div>
                {/* Single icon chip per step — consistent across all 6,
                    scannable at a glance. Replaced the busy faux-UI mockups
                    that read as noise at this scale. */}
                <div
                  className="inline-flex items-center justify-center mb-4"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 4,
                    backgroundColor: isActive
                      ? "rgba(37,99,235,0.10)"
                      : "#F1F5F9",
                    color: isActive ? "#2563EB" : "#94A3B8",
                    border: isLaunch
                      ? "1px solid rgba(37,99,235,0.25)"
                      : "1px solid transparent",
                  }}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.6} />
                </div>
                <p
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                  }}
                >
                  {s.title}
                </p>
                <p
                  className="mt-1.5"
                  style={{
                    color: "#64748B",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    lineHeight: 1.5,
                  }}
                >
                  {s.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// Removed LaunchArtifact: faux-UI mini mockups under each timeline step
// (Zoom card, gradient hero, DNS/Pixel chips, funnel bars, sparkline,
// 3x3 grid). At 56px height they read as visual noise, not product
// surfaces. Replaced with a single consistent lucide icon chip per step
// above — Phone / Eye / Rocket / LineChart / TrendingDown / Layers.
