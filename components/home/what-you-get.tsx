import { BrandIcon, DeliverableIcon, type Deliverable } from "./shared-icons";

const DELIVERABLES: Deliverable[] = [
  {
    key:   "site",
    title: "Premium marketing site",
    body:  "Built on your domain, written in your voice, designed to convert prospects into tours.",
    icon:  "home",
    logos: [{ brand: "vercel" }, { brand: "figma" }],
    big:   true,
  },
  {
    key:   "ads",
    title: "Managed ad campaigns",
    body:  "Meta, Google, and TikTok. Running, pacing, and shipping new creative every 48 hours.",
    icon:  "ads",
    logos: [{ brand: "meta" }, { brand: "google" }, { brand: "tiktok" }],
  },
  {
    key:   "chatbot",
    title: "AI chatbot, 24/7",
    body:  "Trained on your units, pricing rules, and application process. Captures leads at 2am so your team doesn't have to.",
    icon:  "chat",
    logos: [{ brand: "claude" }],
  },
  {
    key:   "pixel",
    title: "Visitor tracking pixel",
    body:  "Real names and emails on your anonymous traffic. Identified prospects feed your CRM and ad audiences.",
    icon:  "pixel",
    logos: [{ brand: "ga" }, { brand: "linkedin" }],
  },
  {
    key:   "seo",
    title: "AI-search discovery",
    body:  "Your pages written to be quoted by ChatGPT, Perplexity, Claude, Gemini, and ranked #1 on Google.",
    icon:  "search",
    logos: [{ brand: "chatgpt" }, { brand: "perplexity" }, { brand: "claude" }, { brand: "gemini" }, { brand: "google" }],
  },
  {
    key:   "tours",
    title: "Tour booking, inline",
    body:  "Prospects book tours from any page, any channel. Connected to your leasing team's calendar.",
    icon:  "cal",
    logos: [{ brand: "cal" }],
  },
  {
    key:   "crm",
    title: "CRM and lead routing",
    body:  "Every lead lands in one place. Hot threads ping your leasing team in Slack in under 60 seconds.",
    icon:  "mail",
    logos: [{ brand: "resend" }, { brand: "slack" }, { brand: "appfolio" }],
  },
  {
    key:   "report",
    title: "Monday owner report",
    body:  "One PDF every Monday. Leads, tours, applications, leases, cost per tour, cost per lease. Delivered to owner and GM.",
    icon:  "report",
    logos: [{ brand: "resend" }],
    big:   true,
  },
];

export function WhatYouGet() {
  return (
    <section
      style={{
        backgroundColor: "#faf9f5",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-20 md:py-28">
        <div className="max-w-3xl mb-12">
          <p
            className="mb-4"
            style={{
              color: "#2F6FE5",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            What's in your ecosystem
          </p>
          <h2
            style={{
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px, 4.2vw, 52px)",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.012em",
            }}
          >
            Eight surfaces, one platform,
            <br />
            <span style={{ color: "#2F6FE5" }}>live in fourteen days.</span>
          </h2>
          <p
            className="mt-5 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
            }}
          >
            Every surface your marketing team would build. Shipped, integrated, and managed for you.
            You approve. We operate.
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
              className={`flex-shrink-0 md:flex-shrink md:col-span-1 ${d.big ? "md:col-span-2" : ""}`}
              style={{ scrollSnapAlign: "start", width: "82vw", maxWidth: "320px" }}
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
        boxShadow: "0 0 0 1px #f0eee6",
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
            backgroundColor: "rgba(47,111,229,0.12)",
            color: "#2F6FE5",
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
          color: "#141413",
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 500,
          lineHeight: 1.2,
        }}
      >
        {d.title}
      </h3>
      <p
        style={{
          color: "#5e5d59",
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
    metric: "+40 leads",
    metricTone: "up",
  },
  {
    when:  "Day 60",
    title: "Cost curves drop",
    body:  "Ads optimized. Creative shipping weekly. AI answer engines starting to cite your pages.",
    metric: "−8% cost per tour",
    metricTone: "up",
  },
  {
    when:  "Day 90",
    title: "Compounding",
    body:  "Portfolio-wide visibility. Identified visitors flowing to CRM. Monday report shows real growth.",
    metric: "+12% leads MoM",
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
              color: "#2F6FE5",
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
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 3.2vw, 38px)",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.005em",
            }}
          >
            Launch on day fourteen. Compound from day one.
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
            background: "linear-gradient(to right, #f0eee6 0%, #2F6FE5 30%, #2F6FE5 60%, #f0eee6 100%)",
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
                boxShadow: `0 0 0 1px ${isLaunch ? "rgba(47,111,229,0.35)" : "#f0eee6"}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block"
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: i < 2 ? "#b0aea5" : "#2F6FE5",
                    boxShadow: "0 0 0 4px #ffffff",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
                <p
                  style={{
                    color: "#2F6FE5",
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
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "18px",
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                {step.title}
              </h4>
              <p
                className="mt-2"
                style={{
                  color: "#5e5d59",
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
                    color: step.metricTone === "up" ? "#1f7a3a" : "#2F6FE5",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    padding: "4px 8px",
                    backgroundColor: step.metricTone === "up" ? "rgba(31,122,58,0.10)" : "rgba(47,111,229,0.10)",
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
