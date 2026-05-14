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
  artifact: "intake" | "preview" | "launch" | "pipeline" | "optimize" | "compound";
};

const LAUNCH_STEPS: LaunchStep[] = [
  {
    when: "Day 1",
    title: "Intake call",
    body: "Thirty minutes. We audit your stack live and lock the build plan.",
    marker: "before",
    artifact: "intake",
  },
  {
    when: "Day 7",
    title: "Site preview",
    body: "Your custom site on a staging URL. You comment, we iterate.",
    marker: "before",
    artifact: "preview",
  },
  {
    when: "Day 14",
    title: "Live on your domain",
    body: "DNS flipped. Pixel firing. Chatbot answering. Ads running.",
    marker: "launch",
    artifact: "launch",
  },
  {
    when: "Day 30",
    title: "First leases attributed",
    body: "Visitor pixel naming traffic. Tours booking. AI insights flowing.",
    marker: "after",
    artifact: "pipeline",
  },
  {
    when: "Day 60",
    title: "Cost curves drop",
    body: "Ads optimized. Creative refreshing weekly. AI search citing your pages.",
    marker: "after",
    artifact: "optimize",
  },
  {
    when: "Day 90",
    title: "Compounding",
    body: "Portfolio-wide visibility. Identified visitors in CRM. Real growth.",
    marker: "after",
    artifact: "compound",
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

        <ol className="relative grid grid-cols-2 md:grid-cols-6 gap-x-3 gap-y-8 z-10">
          {LAUNCH_STEPS.map((s) => {
            const isLaunch = s.marker === "launch";
            const isBefore = s.marker === "before";
            return (
              <li key={s.when} className="relative">
                <div className="flex items-center gap-2 mb-3">
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
                {/* Mini artifact per step so the timeline reads as a product
                    journey, not a row of text labels under disconnected dots. */}
                <LaunchArtifact kind={s.artifact} highlighted={isLaunch} />
                <p
                  className="mt-3"
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

// ---------------------------------------------------------------------------
// LaunchArtifact — tiny product mockup rendered under each timeline step.
// Each kind is a CSS-only mini surface so the 90-day track reads as an
// actual product journey, not a row of dots and text labels.
// ---------------------------------------------------------------------------
function LaunchArtifact({
  kind,
  highlighted,
}: {
  kind: "intake" | "preview" | "launch" | "pipeline" | "optimize" | "compound";
  highlighted: boolean;
}) {
  const ringColor = highlighted ? "#2563EB" : "#E2E8F0";
  const baseStyle: React.CSSProperties = {
    border: `1px solid ${ringColor}`,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    padding: 7,
    height: 56,
    overflow: "hidden",
    boxShadow: highlighted ? "0 0 0 3px rgba(37,99,235,0.10)" : "none",
  };

  if (kind === "intake") {
    return (
      <div style={baseStyle}>
        <p
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            letterSpacing: "0.14em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Call · 30 min
        </p>
        <div className="mt-1.5 flex items-center gap-1">
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)",
              fontSize: "8px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden="true"
          >
            N
          </span>
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: "#1E2A3A",
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)",
              fontSize: "8px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: -4,
            }}
            aria-hidden="true"
          >
            A
          </span>
          <span
            style={{
              color: "#64748B",
              fontFamily: "var(--font-mono)",
              fontSize: "8.5px",
              marginLeft: 4,
            }}
          >
            zoom.us
          </span>
        </div>
      </div>
    );
  }
  if (kind === "preview") {
    return (
      <div style={{ ...baseStyle, padding: 5 }}>
        <div className="flex gap-1 mb-1">
          <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#E2E8F0" }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#E2E8F0" }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#E2E8F0" }} />
        </div>
        <div
          style={{
            height: 36,
            background: "linear-gradient(135deg, #1E2A3A 0%, #2563EB 100%)",
            borderRadius: 2,
            padding: 4,
          }}
        >
          <div
            style={{
              width: "50%",
              height: 3,
              backgroundColor: "rgba(255,255,255,0.8)",
              borderRadius: 1,
            }}
          />
          <div
            style={{
              width: "70%",
              height: 2,
              backgroundColor: "rgba(255,255,255,0.5)",
              borderRadius: 1,
              marginTop: 3,
            }}
          />
          <div
            style={{
              width: "30%",
              height: 6,
              backgroundColor: "#FFFFFF",
              borderRadius: 1,
              marginTop: 6,
            }}
          />
        </div>
      </div>
    );
  }
  if (kind === "launch") {
    return (
      <div style={baseStyle}>
        <div className="flex items-center justify-between">
          <span
            style={{
              color: "#16A34A",
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "0.12em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            ● LIVE
          </span>
          <span
            style={{
              color: "#64748B",
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "0.04em",
            }}
          >
            yourdomain.com
          </span>
        </div>
        <div className="mt-1.5 flex gap-1">
          {["DNS", "Pixel", "Bot", "Ads"].map((tag) => (
            <span
              key={tag}
              style={{
                padding: "2px 4px",
                backgroundColor: "rgba(22,163,74,0.10)",
                color: "#16A34A",
                fontFamily: "var(--font-mono)",
                fontSize: "7.5px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                borderRadius: 1,
              }}
            >
              {tag} ✓
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "pipeline") {
    return (
      <div style={baseStyle}>
        <p
          style={{
            color: "#64748B",
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            letterSpacing: "0.12em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Funnel · 28d
        </p>
        <div className="mt-1.5 flex items-end gap-1 h-6">
          {[20, 16, 12, 6].map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: h,
                backgroundColor: "#2563EB",
                opacity: 1 - i * 0.18,
                borderRadius: 1,
              }}
            />
          ))}
        </div>
        <p
          className="mt-1"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-mono)",
            fontSize: "7.5px",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          142→38→11→3
        </p>
      </div>
    );
  }
  if (kind === "optimize") {
    return (
      <div style={baseStyle}>
        <p
          style={{
            color: "#64748B",
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            letterSpacing: "0.12em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          CPL · trending
        </p>
        <svg
          viewBox="0 0 60 18"
          preserveAspectRatio="none"
          style={{ width: "100%", height: 22, marginTop: 2 }}
          aria-hidden="true"
        >
          <polyline
            points="0,4 10,5 20,7 30,9 40,11 50,13 60,15"
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <p
          className="mt-1"
          style={{
            color: "#16A34A",
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            fontWeight: 700,
          }}
        >
          −34% in 30 days
        </p>
      </div>
    );
  }
  // compound — portfolio rollup tiles
  return (
    <div style={baseStyle}>
      <div className="grid grid-cols-3 gap-0.5 h-full">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor:
                i % 5 === 0
                  ? "#2563EB"
                  : i % 3 === 0
                    ? "rgba(37,99,235,0.45)"
                    : "rgba(37,99,235,0.15)",
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
