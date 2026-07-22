import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { SplitHero, SplitSection } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";

export const metadata: Metadata = {
  title: `About ${BRAND_NAME}`,
  description: `${BRAND_NAME} is the dashboard that runs a property's online leasing and shows which ad produced every signed lease. Built alongside a real Berkeley student-housing operator, not sold to one.`,
};

export default function AboutPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <SplitHero
        eyebrow={`About ${BRAND_NAME}`}
        headline="Built by operators,"
        headlineAccent="not by vendors."
        subhead={`${BRAND_NAME} is the dashboard that runs a rental property's online leasing and shows which ad produced every signed lease. Built with operators running a live lease-up at Telegraph Commons in Berkeley.`}
        ctas={[
          { label: "Request pilot", href: "/sign-up" },
          { label: "Read the manifesto", href: "/manifesto", variant: "secondary" },
        ]}
        caption="Built with SG Real Estate at Telegraph Commons, Berkeley"
        artifact={<StackCard />}
      />

      <SplitSection
        eyebrow=""
        headline="It started as a tool we wished existed during our own lease-ups."
        body="One of us spent Monday mornings as an asset manager running a real lease-up by hand. Every feature in LeaseStack is the answer to a question he asked himself on a Monday morning and could not find the data for. The other half is engineering, out of AM Collective."
        bullets={[
          "Every dollar spent and every lead captured: none of it was visible, analyzed, or acted on.",
          "Most operators are running a multi-billion-dollar industry on a patchwork of disconnected tools.",
          "We built the tool we wanted for our own lease-up, then opened it to other operators.",
          "One dashboard for every channel, and a Monday briefing with three specific actions.",
        ]}
        side="right"
        artifact={<VendorCollapse />}
      />

      {/* Vertical stack, not a split, so three text+artifact split
          sections don't chain in a row (Hero + first SplitSection already
          make two; this one breaks the pattern per the de-slop brief). */}
      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[760px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <Reveal>
            <h2
              style={{
                color: "#161616",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 3.6vw, 42px)",
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: "-0.005em",
              }}
            >
              In the open, on a live property, with other operators in the room.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p
              className="mt-5 mx-auto"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                lineHeight: 1.65,
                color: "#6f6f6f",
                maxWidth: "620px",
              }}
            >
              LeaseStack runs today on a real lease-up: Telegraph Commons, a
              student-housing property in Berkeley, built alongside the team
              at SG Real Estate. We ship with the people who will use it
              sitting in the room. That is why every recommendation reads
              like it came from someone who has done the job, because it did.
            </p>
          </Reveal>
        </div>
        <div className="max-w-[720px] mx-auto px-4 md:px-8 pb-20 md:pb-24">
          <Reveal delay={140}>
            <OperatorWeek />
          </Reveal>
        </div>
      </section>

      <section style={{ backgroundColor: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <Reveal delay={60}>
            <p
              className="mx-auto max-w-[780px]"
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px, 3.2vw, 38px)",
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: "-0.008em",
              }}
            >
              See every dollar spent and every lead captured, tied to whether
              it produced a signed lease. Visible, analyzed, and acted on.
              That is the whole product.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/sign-up" className="btn-primary">
                Request pilot
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
    { k: "Channel read",      v: "Every dollar, every source" },
    { k: "Pacing model",      v: "Leases to lease velocity" },
    { k: "Visitor pixel",     v: "Names on anonymous traffic" },
    { k: "AI chatbot",        v: "Trained on your listings" },
    { k: "Reputation scan",   v: "Google, Reddit, open web" },
    { k: "AI briefing",       v: "3 actions, every Monday 7am" },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #E2E8F0, 0 20px 60px rgba(30, 42, 58,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 md:px-6 py-3 flex items-center justify-between gap-3"
        style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 600,
          }}
        >
          What we built
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#2563EB",
            fontWeight: 600,
          }}
        >
          Live on a real lease-up
        </span>
      </div>
      <ul>
        {surfaces.map((s, i) => (
          <li
            key={s.k}
            className="grid grid-cols-[160px_1fr_auto] items-center gap-3 px-5 md:px-6 py-3.5"
            style={{
              borderBottom: i < surfaces.length - 1 ? "1px solid #E2E8F0" : "none",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#1E2A3A",
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
                color: "#64748B",
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
        style={{ borderTop: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 500,
          }}
        >
          One read on every channel · one AI briefing every Monday
        </span>
      </div>
    </div>
  );
}

function VendorCollapse() {
  const before = [
    "PDF of impressions",
    "Deck of clicks",
    "Spreadsheet of reach",
    "Last-touch attribution",
    "Monthly retainer call",
    "Quarterly review",
    "Disconnected dashboards",
    "Nobody owns the number",
  ];
  return (
    <div className="w-full grid grid-cols-1 gap-4">
      <div
        className="p-5"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 0 0 1px #E2E8F0",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 600,
          }}
        >
          Before · the black box
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {before.map((v) => (
            <li
              key={v}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: "#94A3B8",
                padding: "4px 10px",
                border: "1px dashed #94A3B8",
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
          Open the black box.
        </p>
        <p
          className="mt-1.5"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            opacity: 0.85,
          }}
        >
          Visible, analyzed, acted on
        </p>
      </div>
    </div>
  );
}

function OperatorWeek() {
  const rows = [
    { day: "Mon 7am",   item: "AI briefing arrives in your inbox",   tag: "auto"   },
    { day: "Mon 9am",   item: "10-minute read with your team",        tag: "you"    },
    { day: "Tue",       item: "Apply the one recommendation",         tag: "you"    },
    { day: "Ongoing",   item: "Channel reads run in the background",  tag: "us"     },
    { day: "Ongoing",   item: "Pacing model recalculates nightly",    tag: "us"     },
    { day: "Sat",       item: "Pacing-vs-plan check",                 tag: "auto"   },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #E2E8F0, 0 20px 60px rgba(30, 42, 58,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 md:px-6 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#94A3B8",
            fontWeight: 600,
          }}
        >
          Your week with the platform
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
          const color = r.tag === "you" ? "#2563EB" : r.tag === "us" ? "#F59E0B" : "#94A3B8";
          return (
            <li
              key={`${r.day}-${r.item}`}
              className="grid grid-cols-[90px_1fr_auto] items-center gap-3 px-5 md:px-6 py-3.5"
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid #E2E8F0" : "none",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#94A3B8",
                  fontWeight: 600,
                }}
              >
                {r.day}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13.5px",
                  color: "#1E2A3A",
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
                  backgroundColor: r.tag === "you" ? "rgba(37,99,235,0.12)" : r.tag === "us" ? "rgba(245, 158, 11,0.12)" : "rgba(135,134,127,0.12)",
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
