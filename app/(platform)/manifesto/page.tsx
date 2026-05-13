import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME, getSiteUrl } from "@/lib/brand";
import { Reveal } from "@/components/platform/reveal";

// ---------------------------------------------------------------------------
// Manifesto — a founder-voice note, written to be emailed as a single link to
// operators and investors. Not a product tour, not a pitch deck. Editorial
// prose on the same parchment canvas as the rest of the marketing site.
//
// Voice: first-person plural ("we"). Confident, specific, no dollar figures,
// no customer names, no vendor brand names. Honest about the stage.
// ---------------------------------------------------------------------------

const DESCRIPTION =
  "Most operators are running a multi-billion-dollar industry on a patchwork of disconnected tools. We are opening the black box. A note from the team on why we built LeaseStack and who we are building it with.";

export const metadata: Metadata = {
  title: `Why we built ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: {
    canonical: `${getSiteUrl()}/manifesto`,
  },
  openGraph: {
    title: `Why we built ${BRAND_NAME}`,
    description: DESCRIPTION,
    type: "article",
    url: `${getSiteUrl()}/manifesto`,
    siteName: BRAND_NAME,
    images: [
      {
        url: "/logos/social-background.png",
        width: 1200,
        height: 630,
        alt: `Why we built ${BRAND_NAME}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Why we built ${BRAND_NAME}`,
    description: DESCRIPTION,
    images: ["/logos/social-background.png"],
  },
};

export default function ManifestoPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <Hero />
      <Body />
      <Close />
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-14 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 lg:items-center">
          <div className="lg:col-span-7">
            <Reveal>
              <p
                className="mb-6"
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                A note from the team
              </p>
            </Reveal>
            <Reveal delay={60}>
              <h1
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(40px, 5vw, 62px)",
                  fontWeight: 500,
                  lineHeight: 1.06,
                  letterSpacing: "-0.005em",
                }}
              >
                Why we built {BRAND_NAME}.
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p
                className="mt-6"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(20px, 2.2vw, 26px)",
                  lineHeight: 1.4,
                  fontWeight: 400,
                  letterSpacing: "-0.003em",
                }}
              >
                Most operators are running a multi-billion-dollar industry on a
                patchwork of disconnected tools. We are <span style={{ color: "#2563EB" }}>opening the black box</span>.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <Reveal delay={180} y={24}>
              <FounderCard />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function FounderCard() {
  const facts = [
    { k: "Written",    v: "April 2026" },
    { k: "Read time",  v: "6 minutes" },
    { k: "Stage",      v: "Live at Telegraph Commons, Berkeley" },
    { k: "Partners",   v: "Operators in the room as we ship" },
    { k: "Pricing",    v: "Free pilot. Month-to-month after." },
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
        className="px-5 md:px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            backgroundColor: "#2563EB",
            color: "#ffffff",
            fontFamily: "var(--font-display)",
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          LS
        </span>
        <div>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              color: "#1E2A3A",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            The {BRAND_NAME} team
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94A3B8",
              marginTop: "2px",
              fontWeight: 500,
            }}
          >
            Founder note · {BRAND_NAME}
          </p>
        </div>
      </div>
      <ul>
        {facts.map((f, i) => (
          <li
            key={f.k}
            className="grid grid-cols-[110px_1fr] gap-3 px-5 md:px-6 py-3"
            style={{ borderBottom: i < facts.length - 1 ? "1px solid #E2E8F0" : "none" }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#94A3B8",
                fontWeight: 500,
              }}
            >
              {f.k}
            </span>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#1E2A3A",
                fontWeight: 500,
              }}
            >
              {f.v}
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
          Written to be emailed as a single link
        </span>
      </div>
    </div>
  );
}

function Body() {
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div
        className="max-w-[720px] mx-auto px-4 md:px-8 pb-16 md:pb-24"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "18px",
          lineHeight: 1.75,
          color: "#2a2a28",
        }}
      >
        <Prose>
          <p>
            We have sat in more real-estate marketing reviews than we can
            honestly count. Different operators, different portfolios,
            different verticals. The meeting was always the same. Someone
            presented a deck with impressions, clicks, and reach. Someone else
            asked how many leases it produced. Nobody in the room had a
            defensible answer, and everyone had agreed in advance to pretend
            otherwise.
          </p>

          <Heading>The shift</Heading>

          <p>
            We are moving from agency black boxes to operator intelligence.
            That sentence sounds simple. The implications are not.
          </p>
          <p>
            Most operators are running a multi-billion-dollar industry on a
            patchwork of disconnected tools. Every dollar spent, every lead
            captured, every signal: none of it is visible, analyzed, or acted
            on at the asset level. The agency keeps the data. The PDF gets
            mailed monthly. Nobody on the asset side can answer the question
            that matters, which is whether the spend produced a lease.
          </p>
          <p>
            We have lived this from the asset-management seat. Norman ran the
            Telegraph Commons lease-up by hand and wanted to know, on a Monday
            morning, what every channel of spend was doing. The answer was
            never available. It was a deck a week later, with the wrong
            attribution, presented by someone who had never set foot in the
            building.
          </p>

          <Heading>The promise</Heading>

          <p>
            Open the black box. Visible. Analyzed. Acted on.
          </p>
          <p>
            That means a real read on every channel, in one place, run on the
            data you already produce. It means pacing-vs-plan that pulls from
            the PMS, not the agency&apos;s creative deck. It means a written
            recommendation on what to do next, in operator language, because
            an operator wrote it. It means the asset-management seat finally
            owns the marketing read.
          </p>

          <Heading>The principles</Heading>

          <p>
            We hold ourselves to five.
          </p>
          <p>
            <strong>One: operator-built, not vendor-built.</strong> Every
            feature is the answer to a question we asked ourselves on a
            Monday morning and could not find the data for. If a vendor would
            have built it, we don&apos;t want it.
          </p>
          <p>
            <strong>Two: outcomes over activity.</strong> Leases signed, not
            impressions. Pacing-vs-plan, not reach. The number on the report
            is the number the asset side is graded on.
          </p>
          <p>
            <strong>Three: recommendations, not just reports.</strong> A
            dashboard that does not tell you what to do next is overhead.
            Every weekly note ends with one specific recommendation, written
            by an operator.
          </p>
          <p>
            <strong>Four: AI made digestible, never intimidating.</strong>
            The models do the heavy reading. The interface stays plain. Nobody
            on the asset side should need a data scientist to understand the
            output.
          </p>
          <p>
            <strong>Five: replace the manual work, not the people.</strong>
            Your property manager still runs the asset. Your leasing agents
            still tour. Your in-house marketer still owns the calendar. We
            stop the meeting where nobody can answer how many leases the
            spend produced.
          </p>

          <Heading>How we are building it</Heading>

          <p>
            With operators, on a live property, in public.
          </p>
          <p>
            LeaseStack is running today at Telegraph Commons in Berkeley, on
            a real lease-up with real pacing. We did not build a demo and
            then sell it to someone. We built the version we wanted on our
            own asset, and we are opening it to other operators one at a
            time. The pilot is free for that exact reason: we want operators
            to see the data first, before anyone asks for a card.
          </p>
          <p>
            If you have run a lease-up and felt the gap between what your
            spend is doing and what your agency says it is doing, we want
            you in the room. The first cohort of operators is shaping the
            roadmap. The product gets sharper every time an operator sits
            with it and points at the part that does not match how they
            think.
          </p>
          <p
            style={{
              marginTop: "36px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#94A3B8",
              fontWeight: 500,
            }}
          >
            The {BRAND_NAME} team
          </p>
        </Prose>
      </div>
    </section>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-12 mb-2"
      style={{
        color: "#1E2A3A",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(24px, 2.4vw, 30px)",
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: "-0.003em",
      }}
    >
      {children}
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

function Close() {
  return (
    <section
      style={{
        backgroundColor: "#F1F5F9",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[820px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <h2
          className="mx-auto max-w-[620px]"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 3.6vw, 44px)",
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: "-0.005em",
          }}
        >
          We are building this with operators, in public.
        </h2>
        <p
          className="mx-auto mt-5 max-w-[520px]"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
          }}
        >
          The pilot is free. We connect to your stack, show you what your data
          actually says, and write you one operator-to-operator recommendation.
          If it lands, we keep going. If it does not, you close the tab.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/onboarding" className="btn-primary">
            Start the free pilot
          </Link>
          <Link href="/demo" className="btn-secondary">
            See it on a live property
          </Link>
        </div>
      </div>
    </section>
  );
}
