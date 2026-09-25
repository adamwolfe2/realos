import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME, getSiteUrl } from "@/lib/brand";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { SectionEyebrow } from "@/components/platform/section-eyebrow";
import { SectionShell } from "@/components/home/section-shell";
import { Mark } from "@/components/home/mark";
import { Proof } from "@/components/home/proof";
import {
  CASE_STUDY_PATH,
  CASE_STUDY_PUBLIC,
  SG_CASE_STUDY as CS,
  pct,
} from "@/lib/case-study/sg-real-estate";

// ---------------------------------------------------------------------------
// /case-study: SG Real Estate at Telegraph Commons. Every number comes from
// lib/case-study/sg-real-estate.ts (frozen, verified by
// scripts/case-study/verify-sg-numbers.ts). The page never queries the DB.
// Unlisted while CASE_STUDY_PUBLIC is false (noindex, no sitemap, no nav).
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const HAIRLINE = "#e0e0e0";
const BLUE = "#0f62fe";

const TITLE = `${CS.customer}: ${CS.tracedSignedLeases} leads marked signed and matched to an AppFolio resident`;
const DESCRIPTION = `How ${CS.customer} records leads at ${CS.property}, a ${CS.market} property, from the website chatbot and AppFolio applications, and matches them to residents in AppFolio.`;

export const metadata: Metadata = {
  title: `Case study: ${CS.customer} | ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${getSiteUrl()}${CASE_STUDY_PATH}` },
  robots: CASE_STUDY_PUBLIC ? undefined : { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    url: `${getSiteUrl()}${CASE_STUDY_PATH}`,
    siteName: BRAND_NAME,
    images: [
      {
        url: "/logos/social-background.png",
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/logos/social-background.png"],
  },
};

const STATS = [
  {
    label: "Lead records",
    value: String(CS.leads),
    sub: "Chatbot and AppFolio",
  },
  {
    label: "From the chatbot",
    value: String(CS.chatbotLeads),
    sub: `${pct(CS.chatbotLeads, CS.leads)}% of lead records`,
  },
  {
    label: "Contact captured",
    value: `${pct(CS.chatbotCapturedConversations, CS.chatbotConversations)}%`,
    sub: `${CS.chatbotCapturedConversations} of ${CS.chatbotConversations} sessions`,
  },
  {
    label: "Marked signed",
    value: String(CS.tracedSignedLeases),
    sub: "Matched in AppFolio",
  },
];

const STEPS = [
  {
    title: "The chatbot captures the lead",
    body: `The chatbot on the property website answers renters from real unit data and asks for a name and contact details, in a form before the chat or during it. It captured contact details on ${CS.chatbotCapturedConversations} of ${CS.chatbotConversations} sessions (${pct(CS.chatbotCapturedConversations, CS.chatbotConversations)}%), ${CS.chatbotPreChatCaptures} of them through the form. Counting only sessions with a conversation, it was ${CS.chatbotCapturedWithMessages} of ${CS.chatbotConversationsWithMessages} (${pct(CS.chatbotCapturedWithMessages, CS.chatbotConversationsWithMessages)}%). That produced ${CS.chatbotLeads} of the ${CS.leads} lead records in the window.`,
  },
  {
    title: "AppFolio stays the record",
    body: `${BRAND_NAME} reads applications and residents from AppFolio. During the sync it links residents to lead records automatically, using email, phone, and name, and marks a linked lead signed. No one reviews the links one by one, so some may be wrong.`,
  },
  {
    title: "One report the owner can check",
    body: `${CS.customer} gets one client report. Its lead records count only ${CS.property}, the one building on ${BRAND_NAME}. ${CS.tracedAtProperty} of the ${CS.tracedSignedLeases} signed leads match a resident at ${CS.property}; ${CS.tracedSignedLeases - CS.tracedAtProperty} match only residents at other buildings in the same AppFolio account.`,
  },
];

const METHOD = [
  `Window: ${CS.period.label}, the same window as the client report ${CS.customer} received. Tracking began inside it: the first chatbot session is dated ${formatAsOf(CS.firstRecords.conversation)}, the first lead record ${formatAsOf(CS.firstRecords.lead)}, and the first AppFolio application record ${formatAsOf(CS.firstRecords.appfolioApplication)}. Numbers re-checked against production on ${formatAsOf(CS.asOf)}.`,
  `A lead record is not a person. The ${CS.chatbotLeads} chatbot records carry ${CS.chatbotLeadEmails} distinct email addresses, and one of them is the property's own inbox. The only sources are the chatbot and AppFolio applications.`,
  `A lead counts as signed when ${BRAND_NAME} has linked it to an AppFolio resident and marked it signed with a date in the window. That link is the whole test. It does not check the resident's building or a lease record.`,
  `${CS.chatbotTracedSignedLeases} of the ${CS.tracedSignedLeases} signed lead records were created by the chatbot's pre-chat contact form and ${CS.tracedSignedLeases - CS.chatbotTracedSignedLeases} from AppFolio applications. That says where the record came from, not what led to the lease.`,
  `Residents with no linked lead record are left out. We would rather show a smaller number we can defend.`,
];

function formatAsOf(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="min-w-0 flex flex-col gap-2 p-4 md:p-6"
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2,
      }}
    >
      <p
        className="truncate"
        style={{
          color: MUTED,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        className="truncate tabular-nums"
        style={{
          color: INK,
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(34px, 4.6vw, 56px)",
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </p>
      <p
        className="truncate"
        style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 13 }}
      >
        {sub}
      </p>
    </div>
  );
}

export default function CaseStudyPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK }}>
      <SectionShell bg="#FFFFFF">
        <div className="pt-16 md:pt-20 pb-12 md:pb-14 max-w-[860px]">
          <SectionEyebrow>{`Case study: ${CS.customer}`}</SectionEyebrow>
          <h1
            className="mt-6"
            style={{
              color: INK,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(38px, 6vw, 72px)",
              fontWeight: 550,
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
            }}
          >
            {CS.tracedSignedLeases} leads marked signed,{" "}
            <Mark>matched to an AppFolio resident.</Mark>
          </h1>
          <p
            className="mt-6"
            style={{
              color: MUTED,
              fontFamily: "var(--font-sans)",
              fontSize: 18,
              lineHeight: 1.6,
              maxWidth: 640,
            }}
          >
            {CS.customer} runs {CS.property}, a student-housing property in
            Berkeley. {BRAND_NAME} records leads there from the website chatbot
            and AppFolio applications and matches them to residents in
            AppFolio. The client report for {CS.period.label} counts{" "}
            {CS.leads} lead records, {CS.tracedSignedLeases} of them marked
            signed. Lead capture began in May and AppFolio application
            tracking in June.
          </p>
          <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center gap-3">
            <Link href="/sign-up" className="btn-primary sm:w-auto">
              Request pilot
            </Link>
            <BookDemoLink className="btn-secondary sm:w-auto">
              Book a demo
            </BookDemoLink>
          </div>
        </div>

        <div className="pb-16 md:pb-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {STATS.map((s) => (
              <StatTile key={s.label} {...s} />
            ))}
          </div>
          <p
            className="mt-4"
            style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 13 }}
          >
            {CS.property}, {CS.period.label}. As of {formatAsOf(CS.asOf)}.
          </p>
        </div>
      </SectionShell>

      <SectionShell bg="#FFFFFF">
        <div className="py-16 md:py-20">
          <SectionEyebrow>What changed</SectionEyebrow>
          <h2
            className="mt-5 max-w-[720px]"
            style={{
              color: INK,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 3.6vw, 42px)",
              fontWeight: 550,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            The lead record and the AppFolio resident, linked.
          </h2>
          <ol className="mt-10 grid gap-3 md:gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="p-5 md:p-6"
                style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}
              >
                <p
                  className="tabular-nums"
                  style={{
                    color: BLUE,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3
                  className="mt-3"
                  style={{
                    color: INK,
                    fontFamily: "var(--font-sans)",
                    fontSize: 18,
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    color: MUTED,
                    fontFamily: "var(--font-sans)",
                    fontSize: 15,
                    lineHeight: 1.6,
                  }}
                >
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </SectionShell>

      <SectionShell bg="#FFFFFF">
        <div className="py-16 md:py-20 max-w-[760px]">
          <SectionEyebrow>How we count</SectionEyebrow>
          <h2
            className="mt-5"
            style={{
              color: INK,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 3.2vw, 36px)",
              fontWeight: 550,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            Every number on this page can be checked.
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {METHOD.map((line) => (
              <li
                key={line}
                className="pl-4"
                style={{
                  borderLeft: `2px solid ${BLUE}`,
                  color: INK,
                  fontFamily: "var(--font-sans)",
                  fontSize: 15.5,
                  lineHeight: 1.6,
                }}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      <Proof />
    </div>
  );
}
