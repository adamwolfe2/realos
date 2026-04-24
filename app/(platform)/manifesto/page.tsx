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
  "Real estate is the last large vertical still buying marketing as a retainer. We think it should be a product. A note from the founder on why we built LeaseStack and who we want to build it with.";

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
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
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
      style={{ backgroundColor: "#f5f4ed", borderBottom: "1px solid #f0eee6" }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-14 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 lg:items-center">
          <div className="lg:col-span-7">
            <Reveal>
              <p
                className="mb-6"
                style={{
                  color: "#87867f",
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
                  color: "#141413",
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
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(20px, 2.2vw, 26px)",
                  lineHeight: 1.4,
                  fontWeight: 400,
                  letterSpacing: "-0.003em",
                }}
              >
                Real estate is the last large vertical still buying marketing as a retainer.
                We think it should be a <span style={{ color: "#2563EB" }}>product</span>.
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
    { k: "Stage",      v: "Live on a production domain" },
    { k: "Partners",   v: "Ten operator slots" },
    { k: "Price",      v: "One retainer, no long contracts" },
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
        className="px-5 md:px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid #f0eee6", backgroundColor: "#faf9f5" }}
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
              color: "#141413",
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
              color: "#87867f",
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
              {f.k}
            </span>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#141413",
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
          Written to be emailed as a single link
        </span>
      </div>
    </div>
  );
}

function Body() {
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
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

          <Heading>The observation</Heading>

          <p>
            Every independent operator we talked to was paying five to eight
            vendors to do what should be one job. A retainer agency bought the
            ads. A separate shop built the website, which nobody on the team
            could edit. A third vendor bolted on a chatbot that answered one
            question and forgot the visitor. A fourth charged monthly for a
            CRM that nobody logged into. A freelance designer turned around
            creative in three weeks. A listing portal pulled its own fee on
            top.
          </p>
          <p>
            None of these tools spoke to each other. The weekly report was a
            PDF of screenshots from different dashboards, glued together by a
            human who was also trying to field the regional manager&apos;s
            questions. Attribution was a spreadsheet that optimistically
            credited the last touch to whichever vendor was on that month&apos;s
            call.
          </p>
          <p>
            The big REITs had solved this years ago by building in-house. They
            hired marketing engineers, data scientists, and creative teams and
            ran it all on internal tools. The independent operator &mdash; the
            family portfolio, the regional multifamily group, the campus
            operator with a dozen properties &mdash; could not hire that team.
            So they bought the retainer stack and quietly absorbed the
            coordination cost.
          </p>

          <Heading>The thesis</Heading>

          <p>
            The operator stack should not be assembled by hand every time
            somebody acquires a new property. It should be a product.
          </p>
          <p>
            Meaning: one login, one domain, one pipeline, one weekly report.
            The site, the pixel, the chatbot, the ads, the creative, the CRM,
            and the attribution layer are the same codebase for every
            customer. The brand, the listings, and the playbook are what
            change. The vendor coordination cost goes to zero because there
            is only one vendor, and it built the whole thing to work
            together.
          </p>
          <p>
            This is a boring idea in other verticals. Every SaaS company you
            have ever heard of figured it out a decade ago. Real estate
            marketing is the last major category still sold as a retainer
            assembled by hand, and it is sold that way mostly because the
            incumbents have no incentive to change.
          </p>

          <Heading>Why now</Heading>

          <p>
            We would not have tried to build this three years ago. Two things
            changed.
          </p>
          <p>
            The first is that AI finally makes conversational tools that are
            worth a prospect&apos;s time. A chatbot used to be a decision tree
            pretending to be a person. It is now a real assistant that can
            answer floor-plan questions, route a tour request, and hand a
            warm lead to a human with a summary attached. International
            students applying from seven time zones away at two in the
            morning now get an actual conversation. That was impossible in
            2022.
          </p>
          <p>
            The second is that the identity and attribution stack finally
            works outside the walled gardens. A meaningful share of anonymous
            site visitors can now be resolved to a name and email without
            breaking any privacy law. Paired with a good CRM, that changes
            what a marketing site is for. It stops being a brochure and
            starts being a funnel.
          </p>
          <p>
            Add fast model-driven creative to the mix &mdash; where the
            48-hour turnaround is real and not aspirational &mdash; and the
            economics of a fully managed operator platform tip the right
            way for the first time.
          </p>

          <Heading>What we built</Heading>

          <p>
            {BRAND_NAME} is a single managed platform for real-estate
            operators. One contract, one login, one weekly report. Inside it,
            the custom marketing site, the live listing sync, the AI chatbot,
            the visitor-identification layer, the managed ads, the creative
            studio, the CRM, and the attribution model are the same product.
            They ship together on day fourteen because they were designed
            together.
          </p>
          <p>
            We operate it for the customer. The operator doesn&apos;t learn a
            new tool or stand up a marketing team. They approve creative,
            read the Monday report, and spend their time on the part of the
            business that compounds: pricing, partnerships, community,
            acquisitions.
          </p>
          <p>
            We have a production deployment live on a client&apos;s own
            domain, doing real work. More are in the pipeline. The platform
            is in the portion of its life where the product is clearly real
            and the distribution is still being built.
          </p>

          <Heading>What we&apos;re looking for</Heading>

          <p>
            Two kinds of people. First: operators who are tired of running
            five vendors and want to be one of the first ten portfolios
            running on {BRAND_NAME}. Expect an intake call, a preview within
            a week, and a live deployment inside of two. If it doesn&apos;t
            move your lease velocity, you cancel. We don&apos;t do long
            contracts.
          </p>
          <p>
            Second: investors and collaborators who recognize the pattern.
            Vertical SaaS that replaces a retainer usually takes a few years
            to become obvious and then compounds fast. If you have seen this
            movie before in another industry, we would like to talk.
          </p>
          <p
            style={{
              marginTop: "36px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#87867f",
              fontWeight: 500,
            }}
          >
            &mdash; The {BRAND_NAME} team
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
        color: "#141413",
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
        backgroundColor: "#faf9f5",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[820px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
        <h2
          className="mx-auto max-w-[620px]"
          style={{
            color: "#141413",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 3.6vw, 44px)",
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: "-0.005em",
          }}
        >
          The first ten operators set the pattern.
        </h2>
        <p
          className="mx-auto mt-5 max-w-[520px]"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
          }}
        >
          Twenty minutes on a call tells us whether we&apos;re a fit. If we
          are, you&apos;re live inside of two weeks. If we&apos;re not,
          you&apos;ve lost a lunch break.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/onboarding" className="btn-primary">
            Book a call
          </Link>
          <Link href="/#live" className="btn-secondary">
            See it running
          </Link>
        </div>
      </div>
    </section>
  );
}
