import type { Metadata } from "next";
import Link from "next/link";
import { SplitHero, SplitSection } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";
import { VisitorStream } from "@/components/platform/artifacts/visitor-stream";

export const metadata: Metadata = {
  title: "Visitor identification, names and emails on your site traffic",
  description:
    "Put names and emails on a meaningful share of your anonymous website traffic. Installed and managed end-to-end.",
};

export default function PixelFeaturePage() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <SplitHero
        eyebrow="Visitor identification"
        headline="Know who's actually"
        headlineAccent="on your site."
        subhead="Standard analytics tell you impressions. Our pixel tells you which prospect visited, which unit they looked at, and how to reach them — all before they fill out a form."
        ctas={[
          { label: "Book a demo", href: "/onboarding" },
          { label: "See it live", href: "/#live", variant: "secondary" },
        ]}
        caption="Installed in under an hour · consented identity graph · per-tenant per-domain"
        artifact={<VisitorStream />}
      />

      <SplitSection
        eyebrow="What it is"
        headline="A pixel that puts names on the visits that matter."
        body="A lightweight script on your marketing site matches anonymous visitors against a consented identity graph. When a visit resolves to a person, we attach the name, email, sometimes the phone, plus a full-contact enrichment payload — before they've filled anything out."
        bullets={[
          "Per-tenant install on your custom domain — no shared scripts, no brand collisions.",
          "Matches only against consented identity sources — opt-in, compliant, auditable.",
          "Every visit is stored as a row: pageviews, time on page, referrer, UTM, session chain.",
          "High-intent identified visitors route to your CRM automatically, with enrichment attached.",
        ]}
        side="right"
        artifact={<PixelMatchMatrix />}
      />

      <SplitSection
        eyebrow="How it works"
        headline="Anonymous to named, in four moves."
        body="We handle the install, the matching, the enrichment, and the routing. You review the identified list Monday morning and a steady drip of new leads throughout the week."
        side="left"
        background="#f5f4ed"
        artifact={<PixelPipeline />}
      />

      <SplitSection
        eyebrow="What to expect"
        headline="A steady stream of named visitors, not session counts."
        bullets={[
          "Weekly visitor report Monday morning — who visited, who's high intent, who converted.",
          "Named leads appear in your CRM with enrichment, UTM, and page-journey attached.",
          "One-click CSV of hashed emails for Meta, Google, and TikTok custom audiences.",
          "Clear attribution from ad campaigns, search pages, and organic traffic to real people.",
        ]}
        side="right"
        background="#faf9f5"
        artifact={<PixelResults />}
      />

      <FinalBand />
    </div>
  );
}

function PixelMatchMatrix() {
  const rows = [
    { label: "Page journey",      value: "/floor-plans/2-bed → /pricing → /tour",    match: true  },
    { label: "Device",            value: "iPhone 15 · Safari · Berkeley, CA",        match: true  },
    { label: "Session duration",  value: "4m 38s across 3 visits",                    match: true  },
    { label: "Identity match",    value: "marisol.reyes@berkeley.edu",                match: true  },
    { label: "Enrichment",        value: "UC Berkeley · sophomore · 19",              match: true  },
    { label: "LinkedIn",          value: "linkedin.com/in/marisolreyes",              match: true  },
    { label: "Intent score",      value: "0.87  · high",                              match: true  },
    { label: "Routed to",         value: "CRM · ads audience · owner report",         match: true  },
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
        className="px-5 py-3 flex items-center gap-2"
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
          resolved_visit · anon_8f2e…a91
        </span>
      </div>
      <ul className="px-2 py-2">
        {rows.map((r, i) => (
          <li
            key={r.label}
            className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{
              backgroundColor: i % 2 === 0 ? "#faf9f5" : "transparent",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(47,111,229,0.12)",
                  color: "#2F6FE5",
                }}
              >
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span
                className="truncate"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "#141413",
                  fontWeight: 500,
                }}
              >
                {r.label}
              </span>
            </div>
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11.5px",
                color: "#4d4c48",
                maxWidth: "240px",
                textAlign: "right",
              }}
            >
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PixelPipeline() {
  const stages = [
    { num: "01", title: "Visit",    body: "Pixel fires on pageview. Every visit is logged with pageviews, referrer, UTM, device, and session chain." },
    { num: "02", title: "Match",    body: "The session is hashed and matched against a consented identity graph. High-confidence matches only." },
    { num: "03", title: "Enrich",   body: "Matched people get a full-contact enrichment payload attached — role, org, socials, phone if available." },
    { num: "04", title: "Route",    body: "High-intent identified visitors land in CRM, ad-audience CSV, and your Monday report. Automatic." },
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
        className="px-5 py-3"
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
          pipeline.identify
        </span>
      </div>
      <ol className="p-5 space-y-3">
        {stages.map((s, i) => (
          <Reveal key={s.num} delay={i * 80}>
            <li className="flex gap-4">
              <div
                className="flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(47,111,229,0.12)",
                  color: "#2F6FE5",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                {s.num}
              </div>
              <div className="flex-1">
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14.5px",
                    color: "#141413",
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
                    color: "#5e5d59",
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

function PixelResults() {
  const deltas = [
    { label: "Identified visitors",   value: "312",   delta: "last 7 days" },
    { label: "Named leads to CRM",    value: "48",    delta: "+23 vs. forms" },
    { label: "High-intent flagged",   value: "19",    delta: "emailed Mon 7am" },
    { label: "Retargeting audience",  value: "2,847", delta: "hashed emails" },
  ];
  return (
    <div
      className="w-full grid grid-cols-2 gap-3"
    >
      {deltas.map((d, i) => (
        <Reveal key={d.label} delay={i * 70}>
          <div
            className="p-5"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#87867f",
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
                color: "#141413",
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
                color: "#2F6FE5",
                fontWeight: 600,
              }}
            >
              {d.delta}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function FinalBand() {
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <Reveal>
          <p
            className="eyebrow mb-4"
            style={{
              color: "#87867f",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
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
            Operators with a few hundred monthly visitors and no visibility into anonymous traffic.
            Student housing, multifamily, and senior living benefit most.
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
