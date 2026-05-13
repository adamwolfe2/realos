import { BrandIcon, DeliverableIcon, type Deliverable } from "./shared-icons";

const DELIVERABLES: Deliverable[] = [
  {
    key:   "report",
    title: "The report that writes itself",
    body:  "Every Monday: leases attributed to source, spend summary, pacing vs. last cycle, anomalies flagged, and the three actions to take this week.",
    icon:  "report",
    logos: [{ brand: "resend" }],
    big:   true,
  },
  {
    key:   "pixel",
    title: "Know who visited your site",
    body:  "Not just how many. Names and emails on a meaningful share of your anonymous traffic, fed straight into your CRM.",
    icon:  "pixel",
    logos: [{ brand: "ga" }, { brand: "linkedin" }],
  },
  {
    key:   "chatbot",
    title: "An assistant that captures leads at 2am",
    body:  "Trained on your units, pricing rules, and application process. Hot leads land with your team the next morning, thread attached.",
    icon:  "chat",
    logos: [{ brand: "claude" }],
  },
  {
    key:   "ads",
    title: "Ads with attribution to the lease",
    body:  "Google and Meta, geo-fenced and retargeted, creative refreshed weekly. Spend tied back to lease signings, not impressions.",
    icon:  "ads",
    logos: [{ brand: "meta" }, { brand: "google" }, { brand: "tiktok" }],
  },
  {
    key:   "site",
    title: "A site that ranks where prospects look",
    body:  "Built on your domain. Fast, search-friendly, updated by live listing sync. Designed to convert traffic into tours.",
    icon:  "home",
    logos: [{ brand: "vercel" }, { brand: "figma" }],
  },
  {
    key:   "seo",
    title: "Pages quoted by AI search",
    body:  "Written to rank in Google and to be cited by ChatGPT, Perplexity, Claude, and Gemini. Per-location coverage.",
    icon:  "search",
    logos: [{ brand: "chatgpt" }, { brand: "perplexity" }, { brand: "claude" }, { brand: "gemini" }, { brand: "google" }],
  },
  {
    key:   "tours",
    title: "Tour booking, every page",
    body:  "Prospects book tours from any page, any channel. Connected to your leasing team's calendar, attribution attached.",
    icon:  "cal",
    logos: [{ brand: "cal" }],
  },
  {
    key:   "crm",
    title: "One pipeline. Every channel.",
    body:  "Forms, exit intent, chat, calls, scheduling links. Every lead lands in one place, source attached, routed to your team in Slack.",
    icon:  "mail",
    logos: [{ brand: "resend" }, { brand: "slack" }, { brand: "appfolio" }],
    big:   true,
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
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-20 md:py-28">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">What you get</p>
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(32px, 4.2vw, 52px)",
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.025em",
            }}
          >
            Full visibility.
            <br />
            <span style={{ color: "#2563EB" }}>Zero extra work.</span>
          </h2>
          <p
            className="mt-5 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            Every lead source, every channel, every conversion. Tracked,
            aggregated, and reported automatically. No spreadsheets. No agency
            black boxes.
          </p>
        </div>

        {/* Mobile: horizontal snap carousel. Desktop: grid */}
        <div
          className="md:grid md:grid-cols-3 lg:grid-cols-4 gap-3 mb-20 flex overflow-x-auto md:overflow-visible pb-3 md:pb-0"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {DELIVERABLES.map((d) => (
            <div
              key={d.key}
              className={`flex-shrink-0 w-[82vw] max-w-[320px] md:w-auto md:max-w-none md:col-span-1 ${d.big ? "md:col-span-2" : ""}`}
              style={{ scrollSnapAlign: "start" }}
            >
              <DeliverableCard d={d} />
            </div>
          ))}
        </div>

        <GrowthTimeline />
      </div>
    </section>
  );
}

function DeliverableCard({ d }: { d: Deliverable }) {
  return (
    <div
      className="p-6 h-full flex flex-col gap-3"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #E2E8F0",
        transition: "transform 260ms ease, box-shadow 260ms ease",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            backgroundColor: "rgba(37,99,235,0.12)",
            color: "#2563EB",
          }}
        >
          <DeliverableIcon kind={d.icon} />
        </span>
        {d.logos && d.logos.length > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1">
            {d.logos.map((l, i) => (
              <BrandIcon key={`${d.key}-${l.brand}-${i}`} brand={l.brand} />
            ))}
          </span>
        ) : null}
      </div>
      <h3
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-display)",
          fontSize: "19px",
          fontWeight: 600,
          lineHeight: 1.22,
          letterSpacing: "-0.01em",
        }}
      >
        {d.title}
      </h3>
      <p
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          lineHeight: 1.55,
        }}
      >
        {d.body}
      </p>
    </div>
  );
}

type TimelineStep = {
  when: string;
  title: string;
  body: string;
  metric?: string;
  metricTone?: "neutral" | "up";
};

const TIMELINE: TimelineStep[] = [
  {
    when:  "Day 1",
    title: "Intake call",
    body:  "Thirty minutes. We audit your current marketing stack and lock the build plan.",
  },
  {
    when:  "Day 7",
    title: "Site preview",
    body:  "Your custom site on a staging link. You comment, we iterate, you approve.",
  },
  {
    when:  "Day 14",
    title: "Live on your domain",
    body:  "DNS flipped. Pixel firing. Chatbot answering. Ads running.",
    metric: "Launch",
    metricTone: "neutral",
  },
  {
    when:  "Day 30",
    title: "First leases attributed",
    body:  "AI chatbot capturing leads 24/7. Visitor pixel identifying traffic. First tour bookings flow in.",
    metric: "Leads",
    metricTone: "up",
  },
  {
    when:  "Day 60",
    title: "Cost curves drop",
    body:  "Ads optimized. Creative shipping weekly. AI answer engines starting to cite your pages.",
    metric: "Cost per tour",
    metricTone: "up",
  },
  {
    when:  "Day 90",
    title: "Compounding",
    body:  "Portfolio-wide visibility. Identified visitors flowing to CRM. Monday report shows real growth.",
    metric: "Growth",
    metricTone: "up",
  },
];

function GrowthTimeline() {
  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Your first 90 days
          </p>
          <h3
            className="mt-2"
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 3.2vw, 38px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            Live in fourteen days. Compounding from day one.
          </h3>
        </div>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 relative">
        <div
          aria-hidden
          className="hidden lg:block absolute"
          style={{
            top: "18px",
            left: "8%",
            right: "8%",
            height: "2px",
            background: "linear-gradient(to right, #E2E8F0 0%, #2563EB 30%, #2563EB 60%, #E2E8F0 100%)",
            opacity: 0.5,
          }}
        />
        {TIMELINE.map((step, i) => {
          const isLaunch = step.when === "Day 14";
          return (
            <li
              key={step.when}
              className="relative p-5"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "14px",
                boxShadow: `0 0 0 1px ${isLaunch ? "rgba(37,99,235,0.35)" : "#E2E8F0"}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block"
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: i < 2 ? "#94A3B8" : "#2563EB",
                    boxShadow: "0 0 0 4px #ffffff",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
                <p
                  style={{
                    color: "#2563EB",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {step.when}
                </p>
              </div>
              <h4
                className="mt-3"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-display)",
                  fontSize: "18px",
                  fontWeight: 600,
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                }}
              >
                {step.title}
              </h4>
              <p
                className="mt-2"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {step.body}
              </p>
              {step.metric ? (
                <p
                  className="mt-3"
                  style={{
                    color: step.metricTone === "up" ? "#16A34A" : "#2563EB",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    padding: "4px 8px",
                    backgroundColor: step.metricTone === "up" ? "rgba(22, 163, 74,0.10)" : "rgba(37,99,235,0.10)",
                    borderRadius: "6px",
                    display: "inline-block",
                  }}
                >
                  {step.metric}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
