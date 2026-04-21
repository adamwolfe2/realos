import Link from "next/link";
import type { Metadata } from "next";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";
import { ProductTour } from "@/components/product-tour";
import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { RotatingWord } from "@/components/platform/rotating-word";
import {
  MetaMark, GoogleMark, TikTokMark, SlackMark, CalcomMark, ResendMark,
  GA4Mark, AppFolioMark, ChatGPTMark, PerplexityMark, ClaudeMark,
  GeminiMark, LinkedInMark, VercelMark, FigmaMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// Claude-inspired homepage.
//
// Editorial pacing, warm parchment canvas, Fraunces serif headlines, Inter
// sans for body/UI. Blue accent reserved for the primary CTA and a single
// hero emphasis span. Metadata and labels run on warm grays, not blue.
// No stock photos. No named competitors. No named reference customers.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description: MARKETING.home.hero.subhead,
};

export default function PlatformHome() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <Hero />
      <WhatYouGet />
      <Comparison />
      <Weekly />
      <LiveExample />
      <ProductTourSection />
      <Numbers />
      <Modules />
      <Verticals />
      <Faq />
      <Proof />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HERO — split layout. Left: message. Right: auto-advancing config artifact
// that walks through Intake → Build → Launch → Weekly.
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <SplitHero
      eyebrow="For multifamily and student-housing operators"
      headline={
        <span style={{ display: "block" }}>
          <span style={{ display: "block" }}>
            The <span style={{ color: "#2F6FE5" }}>#1</span> Real Estate
          </span>
          <span style={{ display: "block", whiteSpace: "nowrap" }}>
            Ecosystem for{" "}
            <RotatingWord
              words={["Marketing", "Leasing", "Leads", "Conversion", "Ads", "Growth", "Discovery", "Occupancy"]}
            />
          </span>
        </span>
      }
      subhead={
        <>
          <strong style={{ color: "#141413", fontWeight: 600 }}>Premium Website</strong>,{" "}
          <strong style={{ color: "#141413", fontWeight: 600 }}>AI Chatbot</strong>,{" "}
          <strong style={{ color: "#141413", fontWeight: 600 }}>Visitor Tracking Pixel</strong>, and{" "}
          <span style={{ color: "#2F6FE5", fontWeight: 600 }}>#1</span> search visibility. Live in 14 days.
        </>
      }
      ctas={[
        { label: "Book a demo", href: "/onboarding" },
        { label: "See it live", href: "/#live", variant: "secondary" },
      ]}
      trust={[
        { value: "14 days", label: "First call to live" },
        { value: "One",     label: "Platform, one login" },
        { value: "Zero",    label: "Long-term contracts" },
      ]}
      artifact={<ConfigTabs />}
    />
  );
}

// ---------------------------------------------------------------------------
// WHAT YOU GET — bento grid of deliverables with brand logos + icons, followed
// by an expanded 6-step growth timeline that extends through day 90 so buyers
// see what happens AFTER launch, not just on launch day.
// ---------------------------------------------------------------------------

type Deliverable = {
  key: string;
  title: string;
  body: string;
  icon: "home" | "chat" | "pixel" | "ads" | "search" | "mail" | "report" | "cal";
  logos?: { brand: "meta" | "google" | "tiktok" | "slack" | "resend" | "cal" | "ga" | "appfolio" | "chatgpt" | "perplexity" | "claude" | "gemini" | "linkedin" | "vercel" | "figma" }[];
  big?: boolean;
};

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
    body:  "Meta, Google, and TikTok — running, pacing, and shipping new creative every 48 hours.",
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

function WhatYouGet() {
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

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-20">
          {DELIVERABLES.map((d) => (
            <DeliverableCard key={d.key} d={d} />
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
      className={`p-6 h-full flex flex-col gap-3 ${d.big ? "md:col-span-2" : ""}`}
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

function DeliverableIcon({ kind }: { kind: Deliverable["icon"] }) {
  const p = { width: 16, height: 16, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (kind) {
    case "home":   return <svg {...p}><path d="M2 7L7 3L12 7V12H8V9H6V12H2V7Z" /></svg>;
    case "chat":   return <svg {...p}><path d="M2 3H12V9H5L2 11V3Z" /></svg>;
    case "pixel":  return <svg {...p}><circle cx="7" cy="7" r="4"/><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>;
    case "ads":    return <svg {...p}><path d="M2 5H5L9 2V12L5 9H2V5Z" /></svg>;
    case "search": return <svg {...p}><circle cx="6" cy="6" r="3.5"/><path d="M9 9l3 3"/></svg>;
    case "mail":   return <svg {...p}><path d="M2 4h10v6H2V4Zm0 0l5 4 5-4"/></svg>;
    case "report": return <svg {...p}><path d="M3 11V3h8v8H3Zm2-4h4M5 9h4M5 5h3"/></svg>;
    case "cal":    return <svg {...p}><rect x="2" y="3" width="10" height="9" rx="1.5"/><path d="M2 6h10M5 2v2M9 2v2"/></svg>;
  }
}

function BrandIcon({ brand }: { brand: NonNullable<Deliverable["logos"]>[number]["brand"] }) {
  switch (brand) {
    case "meta":       return <MetaMark size={16} />;
    case "google":     return <GoogleMark size={16} />;
    case "tiktok":     return <TikTokMark size={16} />;
    case "slack":      return <SlackMark size={16} />;
    case "resend":     return <ResendMark size={16} />;
    case "cal":        return <CalcomMark size={16} />;
    case "ga":         return <GA4Mark size={16} />;
    case "appfolio":   return <AppFolioMark size={16} />;
    case "chatgpt":    return <ChatGPTMark size={16} />;
    case "perplexity": return <PerplexityMark size={16} />;
    case "claude":     return <ClaudeMark size={16} />;
    case "gemini":     return <GeminiMark size={16} />;
    case "linkedin":   return <LinkedInMark size={16} />;
    case "vercel":     return <VercelMark size={16} />;
    case "figma":      return <FigmaMark size={16} />;
  }
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

// ---------------------------------------------------------------------------
// COMPARISON — side-by-side contrast: the vendor-stack status quo vs. a single
// managed product. Left column is muted (current pain), right column is the
// highlighted side with a subtle blue accent on check icons. No pricing rows.
// ---------------------------------------------------------------------------

function Comparison() {
  const { comparison } = MARKETING.home;
  return (
    <section
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{comparison.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {comparison.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {comparison.body}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="p-7 md:p-8"
            style={{
              backgroundColor: "#faf9f5",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  backgroundColor: "#f0eee6",
                  color: "#87867f",
                }}
                aria-hidden="true"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="5" width="4" height="4" rx="0.7" />
                  <rect x="7.5" y="5" width="4" height="4" rx="0.7" />
                  <rect x="12.5" y="5" width="3" height="4" rx="0.7" />
                  <path d="M2.5 12h13" />
                </svg>
              </span>
              <p
                className="inline-flex items-center gap-2"
                style={{
                  color: "#87867f",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "#c2c0b6",
                  }}
                />
                {comparison.leftLabel}
              </p>
            </div>
            <ul className="space-y-0">
              {comparison.rows.map((row, i) => (
                <li
                  key={row.old}
                  className="flex items-start gap-3"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    color: "#5e5d59",
                    lineHeight: 1.55,
                    paddingTop: "14px",
                    paddingBottom: "14px",
                    borderTop: i > 0 ? "1px solid #f0eee6" : "none",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "#f0eee6",
                      color: "#87867f",
                      marginTop: "2px",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 2l6 6M8 2l-6 6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span>{row.old}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="p-7 md:p-8"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(47,111,229,0.12)",
                  color: "#2F6FE5",
                }}
                aria-hidden="true"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="3" width="13" height="12" rx="1.5" />
                  <path d="M2.5 7h13" />
                  <circle cx="5" cy="5" r="0.6" fill="currentColor" stroke="none" />
                  <path d="M5 10h3M5 12.5h6" />
                </svg>
              </span>
              <p
                className="inline-flex items-center gap-2"
                style={{
                  color: "#2F6FE5",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "#2F6FE5",
                  }}
                />
                {comparison.rightLabel}
              </p>
            </div>
            <ul className="space-y-0">
              {comparison.rows.map((row, i) => (
                <li
                  key={row.new}
                  className="flex items-start gap-3"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    color: "#141413",
                    lineHeight: 1.55,
                    paddingTop: "14px",
                    paddingBottom: "14px",
                    borderTop: i > 0 ? "1px solid #f0eee6" : "none",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(47,111,229,0.10)",
                      color: "#2F6FE5",
                      marginTop: "2px",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M2 5.5L4.5 8L9 3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{row.new}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// WEEKLY — a week-in-the-life scene. Four cards map to Monday / Tuesday /
// Thursday / Ongoing moments so the buyer can picture the rhythm of operating
// on the platform without a status meeting.
// ---------------------------------------------------------------------------

const WEEKLY_VISUALS: Array<{
  icon: Deliverable["icon"];
  brands: NonNullable<Deliverable["logos"]>[number]["brand"][];
}> = [
  { icon: "report", brands: ["resend"] },
  { icon: "cal",    brands: ["cal", "appfolio"] },
  { icon: "ads",    brands: ["meta", "google", "tiktok", "figma"] },
  { icon: "chat",   brands: ["claude"] },
];

function Weekly() {
  const { weekly } = MARKETING.home;
  return (
    <section
      style={{
        backgroundColor: "#faf9f5",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{weekly.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {weekly.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {weekly.body}
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {weekly.items.map((item, i) => {
            const v = WEEKLY_VISUALS[i] ?? WEEKLY_VISUALS[0];
            return (
              <li
                key={item.title}
                className="p-6 md:p-7 flex flex-col gap-3"
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  boxShadow: "0 0 0 1px #f0eee6",
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
                    <DeliverableIcon kind={v.icon} />
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    {v.brands.map((b, idx) => (
                      <BrandIcon key={`${item.title}-${b}-${idx}`} brand={b} />
                    ))}
                  </span>
                </div>
                <p
                  className="flex items-center justify-between gap-2"
                  style={{
                    color: "#87867f",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  <span style={{ color: "#141413" }}>{item.day}</span>
                  <span>{item.time}</span>
                </p>
                <h3
                  style={{
                    color: "#141413",
                    fontFamily: "var(--font-display)",
                    fontSize: "19px",
                    fontWeight: 500,
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    color: "#5e5d59",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14.5px",
                    lineHeight: 1.6,
                  }}
                >
                  {item.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// LIVE EXAMPLE — abstract production proof. Two cards, two live surfaces.
// No customer names, no hostnames, no PMS brands. Let prospects click in and
// see the deployment; keep the marketing surface enterprise-generic.
// ---------------------------------------------------------------------------

function LiveExample() {
  const { liveExample } = MARKETING.home;
  return (
    <section
      id="live"
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{liveExample.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {liveExample.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {liveExample.body}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LiveCard
            href={liveExample.siteHref}
            label={liveExample.siteLabel}
            caption={liveExample.siteCaption}
            badge="Live deployment"
            icon="home"
            brands={["vercel", "cal"]}
            external
          />
          <LiveCard
            href={liveExample.portalHref}
            label={liveExample.portalLabel}
            caption={liveExample.portalCaption}
            badge="Operator portal"
            icon="report"
            brands={["slack", "resend", "appfolio"]}
          />
        </div>
      </div>
    </section>
  );
}

function LiveCard({
  href,
  label,
  caption,
  badge,
  icon,
  brands,
  external = false,
}: {
  href: string;
  label: string;
  caption: string;
  badge: string;
  icon: Deliverable["icon"];
  brands: NonNullable<Deliverable["logos"]>[number]["brand"][];
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="group block p-7"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #f0eee6",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      }}
    >
      <div className="flex items-center gap-2 mb-5">
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
          <DeliverableIcon kind={icon} />
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          {brands.map((b, idx) => (
            <BrandIcon key={`${label}-${b}-${idx}`} brand={b} />
          ))}
        </span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="mb-2 inline-flex items-center gap-2"
            style={{
              color: "#87867f",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#3a7d44",
              }}
            />
            {badge}
          </p>
          <h3 className="heading-sub" style={{ color: "#141413" }}>
            {label}
          </h3>
          <p
            className="mt-3 max-w-md"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              lineHeight: 1.6,
            }}
          >
            {caption}
          </p>
        </div>
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            color: "#5e5d59",
            boxShadow: "0 0 0 1px #e8e6dc",
          }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d={
                external
                  ? "M5 9L9 5M9 5H5.5M9 5V8.5"
                  : "M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
              }
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// PRODUCT TOUR SECTION - the interactive CRM preview
// ---------------------------------------------------------------------------

function ProductTourSection() {
  return (
    <section id="product-tour" style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-20 pb-20 md:pb-28 md:pt-24">
        <div className="text-center mb-8 md:mb-10 max-w-[720px] mx-auto">
          <p className="eyebrow mb-4">Interactive preview</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Click through the actual portal.
          </h2>
          <p
            className="mt-3 mx-auto"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#5e5d59",
            }}
          >
            Every tab in the sidebar below is a real surface in the platform.
            Open a lead. Read a chatbot conversation. Filter the creative
            queue. This is what ships on day one.
          </p>
        </div>
        <ProductTour />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// NUMBERS - four big stats, Claude editorial treatment
// ---------------------------------------------------------------------------

const METRICS = [
  {
    value: "One",
    label: "Platform replaces five-plus vendors: site, chatbot, ads, CRM, creative.",
  },
  {
    value: "24/7",
    label: "AI chatbot that answers, qualifies, and captures leads after hours.",
  },
  {
    value: "48h",
    label: "Turnaround on every managed creative asset: ads, landing blocks, emails.",
  },
  {
    value: "14 days",
    label: "From intake call to a custom site live on your domain with full stack.",
  },
];

function Numbers() {
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <p className="eyebrow mb-10 text-center">The numbers we hit</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6 lg:gap-4">
          {METRICS.map((m, i) => (
            <div
              key={m.value}
              className={`px-0 lg:px-6 text-left ${i > 0 ? "lg:border-l" : ""}`}
              style={i > 0 ? { borderColor: "#e8e6dc" } : undefined}
            >
              <p
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(40px, 5.2vw, 56px)",
                  fontWeight: 500,
                  lineHeight: 1.05,
                  letterSpacing: "-0.005em",
                }}
              >
                {m.value}
              </p>
              <p
                className="mt-4 max-w-[280px]"
                style={{
                  color: "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.55,
                }}
              >
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// MODULES - warm card grid, no photos
// ---------------------------------------------------------------------------

function Modules() {
  return (
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-14">
          <p className="eyebrow mb-4">Inside the platform</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Every module the operator stack needs, in one login.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            Nothing to wire up. Nothing to learn. We run it. You review the
            weekly report.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MARKETING.home.modules.map((m) => (
            <div
              key={m.title}
              className="p-6"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 0 0 1px #f0eee6",
              }}
            >
              <h3 className="heading-card" style={{ color: "#141413" }}>
                {m.title}
              </h3>
              <p
                className="mt-3"
                style={{
                  color: "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                }}
              >
                {m.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// VERTICALS - text-only cards, no photos
// ---------------------------------------------------------------------------

const VERTICALS = [
  {
    href: "/student-housing",
    label: "Student housing",
    tag: "Pre-lease cycles, parent decision-makers, campus-proximity plays.",
  },
  {
    href: "/multifamily",
    label: "Multifamily",
    tag: "Portfolio rollups, per-property retargeting, fair-housing-safe creative.",
  },
  {
    href: "/senior-living",
    label: "Senior living",
    tag: "Family-first nurture, patient conversion, compliance-aware forms.",
  },
  {
    href: "/commercial",
    label: "Commercial",
    tag: "Office, industrial, retail. Broker-aware, spec-sheet driven. Coming soon.",
  },
];

function Verticals() {
  return (
    <section style={{ backgroundColor: "#f5f4ed", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-14">
          <p className="eyebrow mb-4">Same platform, tailored</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Built for the way your vertical actually operates.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VERTICALS.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className="group block p-7"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 0 0 1px #f0eee6",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="heading-sub" style={{ color: "#141413" }}>
                    {v.label}
                  </h3>
                  <p
                    className="mt-3 max-w-md"
                    style={{
                      color: "#5e5d59",
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      lineHeight: 1.6,
                    }}
                  >
                    {v.tag}
                  </p>
                </div>
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    color: "#5e5d59",
                    boxShadow: "0 0 0 1px #e8e6dc",
                  }}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PROOF - dark section, product-positioning (no named customer)
// ---------------------------------------------------------------------------

function Proof() {
  const { proof } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-28 text-center">
        <p
          className="mb-6"
          style={{
            color: "#2F6FE5",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          The platform
        </p>
        <h2
          className="mx-auto max-w-[860px]"
          style={{
            color: "#141413",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px, 4vw, 48px)",
            fontWeight: 500,
            lineHeight: 1.12,
            letterSpacing: "-0.008em",
          }}
        >
          {proof.heading}
        </h2>
        <p
          className="mx-auto mt-5 max-w-[620px]"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
          }}
        >
          {proof.body}
        </p>

        <div className="mt-14 flex flex-wrap items-start justify-center gap-x-16 gap-y-8">
          <BigStat value="One" label="Platform, one login" />
          <BigStat value="Two" label="Weeks from intake to live" />
          <BigStat value="Zero" label="Long-term contracts" />
        </div>

        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/onboarding" className="btn-primary">
            Book a demo
          </Link>
          <Link href="/#live" className="btn-secondary">
            See it live
          </Link>
        </div>
      </div>
    </section>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p
        style={{
          color: "#141413",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 4.8vw, 56px)",
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: "-0.008em",
        }}
      >
        {value}
      </p>
      <p
        className="mt-2 mx-auto max-w-[180px]"
        style={{
          color: "#87867f",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ — answers the questions that stall every first-call deal
// ---------------------------------------------------------------------------

function Faq() {
  const { faq } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="text-center mb-12 md:mb-14">
          <p className="eyebrow mb-4">{faq.eyebrow}</p>
          <h2
            className="mx-auto max-w-[640px]"
            style={{
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 3.4vw, 42px)",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.005em",
            }}
          >
            {faq.headline}
          </h2>
        </div>

        <ul
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 0 0 1px #f0eee6",
            overflow: "hidden",
          }}
        >
          {faq.items.map((item, i) => (
            <li
              key={item.q}
              style={{
                borderTop: i > 0 ? "1px solid #f0eee6" : "none",
              }}
            >
              <details className="group">
                <summary
                  className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "17px",
                    fontWeight: 500,
                    color: "#141413",
                    lineHeight: 1.35,
                  }}
                >
                  <span>{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="flex-shrink-0 inline-flex items-center justify-center transition-transform group-open:rotate-45"
                    style={{
                      width: "24px",
                      height: "24px",
                      color: "#87867f",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 2v10M2 7h10"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </summary>
                <div
                  className="px-6 pb-5 -mt-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    lineHeight: 1.65,
                    color: "#5e5d59",
                    maxWidth: "680px",
                  }}
                >
                  {item.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FINAL CTA
// ---------------------------------------------------------------------------

function FinalCta() {
  const { final } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32 text-center">
        <h2
          className="mx-auto max-w-[780px]"
          style={{
            color: "#141413",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 4.4vw, 52px)",
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.005em",
          }}
        >
          {final.heading}
        </h2>
        <p
          className="mx-auto mt-5 max-w-[560px]"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
          }}
        >
          {final.body}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={final.primaryHref} className="btn-primary">
            {final.primaryCta}
          </Link>
          <Link href="/#live" className="btn-secondary">
            See it live
          </Link>
        </div>
      </div>
    </section>
  );
}
