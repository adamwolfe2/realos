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
        subhead="Most analytics tell you impressions. We tell you which prospect just visited, which unit they looked at, and how to reach them, all before they fill out a form."
        ctas={[
          { label: "Book a demo", href: "/onboarding" },
          { label: "See it live", href: "/demo", variant: "secondary" },
        ]}
        caption="Live on your site · consented identity graph · fully compliant"
        artifact={<VisitorStream />}
      />

      <SplitSection
        eyebrow="What you see"
        headline="Real names on the visits that matter."
        body="Every time a prospect loads a floor plan, we tell you who they are. Not a vague 'someone from California', but a name, an email, often a phone and a LinkedIn. Your leasing team gets to follow up before the prospect has even filled anything out."
        bullets={[
          "Live feed of identified visitors. Who, where, and what they looked at.",
          "Every identified visitor enriched with role, organization, and contact info.",
          "High-intent visitors flagged and emailed to your team within minutes.",
          "All of it captured with consent. Audit-friendly, compliant, yours to keep.",
        ]}
        side="right"
        artifact={<VisitorProfile />}
      />

      <SplitSection
        eyebrow="How it works for you"
        headline="Anonymous to named, without you lifting a finger."
        body="We install it, we run it, we feed the results into your team's workflow. You review the Monday report and the steady drip of named leads throughout the week."
        side="left"
        background="#f5f4ed"
        artifact={<PixelPipeline />}
      />

      <SplitSection
        eyebrow="What you get"
        headline="A steady stream of named visitors, not session counts."
        bullets={[
          "Monday report: who visited, who's high intent, who converted last week.",
          "Named leads feed your team's inbox and your leasing software automatically.",
          "Your Meta, Google, and TikTok audiences rebuilt weekly from the people who actually showed up.",
          "Clear attribution from ad to tour to lease. No more guessing what's working.",
        ]}
        side="right"
        background="#faf9f5"
        artifact={<PixelResults />}
      />

      <FinalBand />
    </div>
  );
}

function VisitorProfile() {
  const facts = [
    { label: "Name",          value: "Marisol Reyes" },
    { label: "Email",         value: "marisol.reyes@berkeley.edu" },
    { label: "Who she is",    value: "UC Berkeley · sophomore" },
    { label: "Where she's from", value: "Sacramento, CA" },
    { label: "What she looked at", value: "2-bed floor plan · pricing · tours" },
    { label: "Time on site",  value: "4m 38s across 3 visits" },
    { label: "Intent",        value: "High. Viewed tours twice" },
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
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid #f0eee6", backgroundColor: "#faf9f5" }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#2563EB",
            color: "#ffffff",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          MR
        </span>
        <div className="flex-1 min-w-0">
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: "#141413",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            Marisol Reyes · identified visitor
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#87867f",
              marginTop: "3px",
              fontWeight: 500,
            }}
          >
            Here's what we know before she filled anything out
          </p>
        </div>
      </div>
      <ul>
        {facts.map((f, i) => (
          <li
            key={f.label}
            className="grid grid-cols-[150px_1fr] gap-3 items-center px-5 py-3"
            style={{ borderBottom: i < facts.length - 1 ? "1px solid #f0eee6" : "none" }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#87867f",
                fontWeight: 500,
              }}
            >
              {f.label}
            </span>
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#141413",
                fontWeight: 500,
              }}
            >
              {f.value}
            </span>
          </li>
        ))}
      </ul>
      <div
        className="px-5 py-3 flex items-center justify-between gap-3"
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
          Sent to your team · added to your ad audiences
        </span>
      </div>
    </div>
  );
}

function PixelPipeline() {
  const stages = [
    { num: "01", title: "A prospect visits your site",   body: "Every pageview is captured: which units they looked at, how long they stayed, how they got there." },
    { num: "02", title: "We match the visit to a person", body: "Consented identity graph returns a real name and email for a meaningful share of your visits." },
    { num: "03", title: "We add everything we know",      body: "Role, organization, phone, LinkedIn, attached to the visitor so your team can reach out confidently." },
    { num: "04", title: "It lands where your team works", body: "Your leasing inbox, your CRM, your ad audiences, and your Monday owner report. You don't lift a finger." },
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
          How a single visit becomes a named lead
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
                  backgroundColor: "rgba(37,99,235,0.12)",
                  color: "#2563EB",
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
                color: "#2563EB",
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
            <Link href="/demo" className="btn-secondary">
              See it live
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
