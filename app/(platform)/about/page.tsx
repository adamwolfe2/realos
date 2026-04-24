import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { SplitHero, SplitSection } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";

export const metadata: Metadata = {
  title: `About ${BRAND_NAME}`,
  description: `${BRAND_NAME} is the managed marketing platform for real estate operators. One platform, one retainer, no long contracts.`,
};

export default function AboutPage() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <SplitHero
        eyebrow={`About ${BRAND_NAME}`}
        headline="Infrastructure for the"
        headlineAccent="independent operator."
        subhead={`${BRAND_NAME} is a managed marketing platform built for independent real-estate operators. Custom site, live listings, identity pixel, AI chatbot, managed ads, follow-up. One retainer, no long contracts.`}
        ctas={[
          { label: "Book a demo", href: "/onboarding" },
          { label: "Read the manifesto", href: "/manifesto", variant: "secondary" },
        ]}
        caption="Founded 2025 · built by operators for operators"
        artifact={<StackCard />}
      />

      <SplitSection
        eyebrow="Why we exist"
        headline="Independent operators were buying the wrong stack."
        body="Most operators we met were running five to eight vendors: an agency for paid spend, a site no one could edit, a chatbot that answered one question, a CRM no team used, a freelance designer, and a listing portal pulling its own fee. None of it spoke to anything else."
        bullets={[
          "National REITs solved this years ago with in-house teams and internal software.",
          "Independent operators couldn't hire that team, so they absorbed the coordination tax.",
          "We built the off-the-shelf version of the REIT playbook, priced for the independent.",
          "One login, one weekly report, one bill, across every surface in the stack.",
        ]}
        side="right"
        artifact={<VendorCollapse />}
      />

      <SplitSection
        eyebrow="How we work"
        headline="Managed, not sold."
        body="We run the platform on your behalf. You don't learn a new tool, you don't hire a marketing team. You approve creative, read the Monday report, and spend your time on the part of the business that compounds."
        side="left"
        background="#f5f4ed"
        artifact={<OperatorWeek />}
      />

      <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <Reveal>
            <p
              className="mb-6"
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Our belief
            </p>
          </Reveal>
          <Reveal delay={60}>
            <p
              className="mx-auto max-w-[780px]"
              style={{
                color: "#141413",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px, 3.2vw, 38px)",
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: "-0.008em",
              }}
            >
              Operators should spend their time on partnerships, pricing, and community.
              Not on stitching together five vendor dashboards. We do the stitching. You run the building.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/onboarding" className="btn-primary">
                Book a demo
              </Link>
              <Link href="/manifesto" className="btn-secondary">
                Read the manifesto
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function StackCard() {
  const surfaces = [
    { k: "Marketing site",    v: "Your domain, your brand" },
    { k: "Identity pixel",    v: "Names on anonymous traffic" },
    { k: "AI chatbot",        v: "Trained on your listings" },
    { k: "Managed ads",       v: "Meta + Google, 48h creative" },
    { k: "CRM + routing",     v: "Lead capture to leasing team" },
    { k: "Weekly report",     v: "Monday, 7am, owner + GM" },
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
        className="px-5 md:px-6 py-3 flex items-center justify-between gap-3"
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
          What we built for you
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#2563EB",
            fontWeight: 600,
          }}
        >
          6 surfaces · 1 platform
        </span>
      </div>
      <ul>
        {surfaces.map((s, i) => (
          <li
            key={s.k}
            className="grid grid-cols-[160px_1fr_auto] items-center gap-3 px-5 md:px-6 py-3.5"
            style={{
              borderBottom: i < surfaces.length - 1 ? "1px solid #f0eee6" : "none",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#141413",
                fontWeight: 600,
              }}
            >
              {s.k}
            </span>
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "#5e5d59",
              }}
            >
              {s.v}
            </span>
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                backgroundColor: "rgba(37,99,235,0.12)",
                color: "#2563EB",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </li>
        ))}
      </ul>
      <div
        className="px-5 md:px-6 py-3"
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
          One contract · one login · one weekly report
        </span>
      </div>
    </div>
  );
}

function VendorCollapse() {
  const before = [
    "Paid-ads agency",
    "Website vendor",
    "Chatbot shop",
    "CRM SaaS",
    "Freelance designer",
    "Listing portal",
    "Analytics consultant",
    "Review-response vendor",
  ];
  return (
    <div className="w-full grid grid-cols-1 gap-4">
      <div
        className="p-5"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 0 0 1px #f0eee6",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#87867f",
            fontWeight: 600,
          }}
        >
          Before · eight vendors
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {before.map((v) => (
            <li
              key={v}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: "#87867f",
                padding: "4px 10px",
                border: "1px dashed #b0aea5",
                borderRadius: "999px",
                textDecoration: "line-through",
                textDecorationColor: "rgba(135,134,127,0.55)",
              }}
            >
              {v}
            </li>
          ))}
        </ul>
      </div>
      <div
        className="p-5 text-center"
        style={{
          backgroundColor: "#2563EB",
          color: "#ffffff",
          borderRadius: "16px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.8,
            fontWeight: 600,
          }}
        >
          After
        </p>
        <p
          className="mt-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "28px",
            lineHeight: 1.1,
            fontWeight: 500,
          }}
        >
          One platform.
        </p>
        <p
          className="mt-1.5"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            opacity: 0.85,
          }}
        >
          One retainer · one login · one weekly report
        </p>
      </div>
    </div>
  );
}

function OperatorWeek() {
  const rows = [
    { day: "Mon 7am",   item: "Weekly report arrives",        tag: "auto"   },
    { day: "Mon 9am",   item: "10-minute review",              tag: "you"    },
    { day: "Tue",       item: "Creative review, if any",       tag: "you"    },
    { day: "Ongoing",   item: "Ads, chatbot, follow-up",       tag: "us"     },
    { day: "Ongoing",   item: "Lead routing + CRM sync",       tag: "us"     },
    { day: "Sat",       item: "Spend & pacing auto-adjust",    tag: "auto"   },
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
        className="px-5 md:px-6 py-3 flex items-center justify-between"
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
          Your week with us
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#2563EB",
            fontWeight: 600,
          }}
        >
          ~30 min total · your side
        </span>
      </div>
      <ul>
        {rows.map((r, i) => {
          const color = r.tag === "you" ? "#2563EB" : r.tag === "us" ? "#b8860b" : "#87867f";
          return (
            <li
              key={`${r.day}-${r.item}`}
              className="grid grid-cols-[90px_1fr_auto] items-center gap-3 px-5 md:px-6 py-3.5"
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid #f0eee6" : "none",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#87867f",
                  fontWeight: 600,
                }}
              >
                {r.day}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13.5px",
                  color: "#141413",
                  fontWeight: 500,
                }}
              >
                {r.item}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: color,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  backgroundColor: r.tag === "you" ? "rgba(37,99,235,0.12)" : r.tag === "us" ? "rgba(184,134,11,0.12)" : "rgba(135,134,127,0.12)",
                }}
              >
                {r.tag}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
