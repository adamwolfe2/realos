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
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-12 md:py-16">
        {/* Section header */}
        <div className="max-w-3xl mb-10 md:mb-12">
          <p className="eyebrow mb-3">What you get</p>
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(32px, 4.4vw, 52px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            The intelligence layer
            <br />
            <span style={{ color: "#2563EB" }}>your stack is missing.</span>
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.55,
            }}
          >
            LeaseStack connects to what you already run and turns it into
            one weekly read. Visibility, recommendations, and the work done
            for you.
          </p>
        </div>

        {/* Three pillars — editorial, not card-grid */}
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8 mb-14 md:mb-16">
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
                className="mt-2"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(20px, 2vw, 24px)",
                  fontWeight: 700,
                  lineHeight: 1.18,
                  letterSpacing: "-0.02em",
                }}
              >
                {p.headline}
              </h3>
              <p
                className="mt-3"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14.5px",
                  lineHeight: 1.55,
                }}
              >
                {p.body}
              </p>
              <p
                className="mt-4 pt-3"
                style={{
                  borderTop: "1px solid #E2E8F0",
                  color: "#1E2A3A",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
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
        <div className="mb-14 md:mb-16">
          <div className="flex items-end justify-between gap-6 mb-6 flex-wrap">
            <h3
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(22px, 2.4vw, 28px)",
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
                fontSize: "14.5px",
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
                className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 md:gap-10 px-5 md:px-7 py-4 md:py-5"
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
                      fontSize: "17px",
                      fontWeight: 600,
                      lineHeight: 1.3,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {m.title}
                  </h4>
                  <p
                    className="mt-1.5 max-w-2xl"
                    style={{
                      color: "#64748B",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13.5px",
                      lineHeight: 1.5,
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
  // Rewritten as a single connected flex row. Each step is a flex-1
  // column with a centered dot at the top; the connecting line is a
  // segmented hairline drawn between adjacent dots (so it always lines
  // up regardless of viewport width — no fragile absolute %s). The
  // "Day 14 = Launch" floating label is gone (it was visually
  // disconnected from the actual Day 14 column); emphasis now lives on
  // the Day 14 dot + label themselves.

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow mb-3">Your first 90 days</p>
        <h3
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(22px, 2.4vw, 28px)",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: "780px",
          }}
        >
          Live in fourteen days. Compounding from day one.
        </h3>
      </div>

      {/* Desktop: one connected flex row. Mobile: 2-col grid, no line. */}
      <ol className="hidden md:flex items-start">
        {LAUNCH_STEPS.map((s, idx) => {
          const isLaunch = s.marker === "launch";
          const isBefore = s.marker === "before";
          const isActive = isLaunch || isBefore;
          const Icon = s.icon;
          // Segment connecting this dot to the next one. Coloured
          // through the "launch" step (idx <= 2), gray after.
          const segmentColor = idx < 2 ? "#2563EB" : "#E2E8F0";
          return (
            <li key={s.when} className="flex-1 relative min-w-0">
              {/* Connecting line — sits at dot vertical center, spans
                  from this column's center to the next column's center.
                  Skip on the last item. */}
              {idx < LAUNCH_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute"
                  style={{
                    top: 5,
                    left: "50%",
                    right: "-50%",
                    height: 2,
                    backgroundColor: segmentColor,
                  }}
                />
              )}

              {/* Dot — centered in its column. */}
              <div className="flex justify-center">
                <span
                  aria-hidden
                  style={{
                    width: isLaunch ? 12 : 10,
                    height: isLaunch ? 12 : 10,
                    marginTop: isLaunch ? 0 : 1,
                    borderRadius: "50%",
                    backgroundColor: isActive ? "#2563EB" : "#CBD5E1",
                    boxShadow: isLaunch
                      ? "0 0 0 4px rgba(37,99,235,0.18)"
                      : "none",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              </div>

              {/* Content block — centered under the dot. */}
              <div className="mt-5 flex flex-col items-center text-center px-3">
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
                  {isLaunch ? " — Launch" : ""}
                </span>
                <div
                  className="inline-flex items-center justify-center mt-3 mb-4"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    backgroundColor: isActive
                      ? "rgba(37,99,235,0.10)"
                      : "#F1F5F9",
                    color: isActive ? "#2563EB" : "#94A3B8",
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
                    maxWidth: "180px",
                  }}
                >
                  {s.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile fallback — same content, simpler 2-col grid, no line. */}
      <ol className="md:hidden grid grid-cols-2 gap-x-4 gap-y-10">
        {LAUNCH_STEPS.map((s) => {
          const isLaunch = s.marker === "launch";
          const isBefore = s.marker === "before";
          const isActive = isLaunch || isBefore;
          const Icon = s.icon;
          return (
            <li key={s.when}>
              <div className="flex items-center gap-2 mb-4">
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: isActive ? "#2563EB" : "#CBD5E1",
                    boxShadow: isLaunch
                      ? "0 0 0 3px rgba(37,99,235,0.18)"
                      : "none",
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
                  {isLaunch ? " — Launch" : ""}
                </span>
              </div>
              <div
                className="inline-flex items-center justify-center mb-3"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  backgroundColor: isActive
                    ? "rgba(37,99,235,0.10)"
                    : "#F1F5F9",
                  color: isActive ? "#2563EB" : "#94A3B8",
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
  );
}

// Removed LaunchArtifact: faux-UI mini mockups under each timeline step
// (Zoom card, gradient hero, DNS/Pixel chips, funnel bars, sparkline,
// 3x3 grid). At 56px height they read as visual noise, not product
// surfaces. Replaced with a single consistent lucide icon chip per step
// above — Phone / Eye / Rocket / LineChart / TrendingDown / Layers.
