import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME, getSiteUrl } from "@/lib/brand";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
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
// /case-study: SG Real Estate at Telegraph Commons, since launch. Every
// number comes from SG_CASE_STUDY.sinceLaunch (frozen, verified by
// scripts/case-study/verify-sg-numbers.ts). The page never queries the DB.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const HAIRLINE = "#e0e0e0";
const BLUE = "#0f62fe";
const BLUE_LIGHT = "#a6c8ff";
const GRAY = "#8d8d8d";

const SL = CS.sinceLaunch;

const usd = (n: number) => `$${Math.round(n / 1000).toLocaleString()}K`;

const TITLE = `${CS.property}: ${SL.tracedLeases} signed leases traced back to the lead`;
const DESCRIPTION = `How ${CS.customer} runs ${CS.property}'s website, chatbot and AppFolio data on ${BRAND_NAME}, and traces every new lease back to where the renter came from.`;

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
    images: [{ url: "/case-study/telegraph-commons-site.jpg", width: 2880, height: 1800, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/case-study/telegraph-commons-site.jpg"],
  },
};

const STATS = [
  {
    value: String(SL.tracedLeases),
    label: "New leases traced",
    sub: "Each matched to the lead it started from",
  },
  {
    value: usd(SL.tracedAnnualRentUsd),
    label: "Annual rent on those leases",
    sub: "Monthly rent from AppFolio, times 12",
  },
  {
    value: String(SL.tracedLeasesFromChat),
    label: "Leases that began as a website chat",
    sub: `${usd(SL.tracedAnnualRentFromChatUsd)} a year in rent`,
  },
  {
    value: `${SL.searchPositionFirstMonth} → ${SL.searchPositionLatestMonth}`,
    label: "Average Google search position",
    sub: "April to October. Lower is closer to the top",
  },
];

const RUNNING = [
  {
    name: "Property website",
    what: "telegraphcommons.com, live availability and pricing, tours and applications.",
    proof: `${SL.searchClicks.toLocaleString()} clicks from Google search on ${SL.searchImpressions.toLocaleString()} impressions`,
  },
  {
    name: "Website chatbot",
    what: "Answers renters from real unit data and asks for contact details.",
    proof: `${SL.chatSessions} sessions, ${SL.chatSessionsCaptured} left contact details (${pct(SL.chatSessionsCaptured, SL.chatSessions)}%)`,
  },
  {
    name: "AppFolio sync",
    what: "Applications, residents and leases pulled in every hour. AppFolio stays the record.",
    proof: `${SL.residentsSynced} residents and ${SL.leasesSynced} leases at ${CS.property}`,
  },
  {
    name: "Lead record",
    what: "Every chat, web form and AppFolio application lands in one lead list.",
    proof: `${SL.leads} lead records since launch`,
  },
  {
    name: "Lease matching",
    what: "Residents are matched to lead records by email, phone and name, so each lease shows its source.",
    proof: `${SL.tracedLeases} new leases traced, ${SL.tracedLeasesFromChat} from the chatbot`,
  },
];

const METHOD = [
  `Window: ${SL.label}. ${BRAND_NAME} went live at ${CS.property} on April 18; the first chat is dated April 20. Numbers checked against production on October 30, 2026.`,
  `A traced lease is a lead marked signed and matched to a ${CS.property} resident whose lease starts in the window, where the lead record existed before the lease began. Matching is automatic, by email, phone and name.`,
  `Annual rent is the lease's monthly rent in AppFolio times 12. AppFolio does not send the lease term, so this is not total contract value.`,
  `"Began as a website chat" means the lead record was created by the chatbot. It says where the renter first reached the property, not everything that led to the lease.`,
  `Lead records are rows, not people: a renter who chats and then applies can appear twice. Leases are counted once per lead.`,
];

const MONTH_LABEL: Record<string, string> = {
  "2026-04": "Apr",
  "2026-05": "May",
  "2026-06": "Jun",
  "2026-07": "Jul",
  "2026-08": "Aug",
  "2026-09": "Sep",
  "2026-10": "Oct",
};

const H2_STYLE = {
  color: INK,
  fontFamily: "var(--font-display)",
  fontSize: "clamp(28px, 3.6vw, 42px)",
  fontWeight: 550,
  lineHeight: 1.1,
  letterSpacing: "-0.03em",
} as const;

const BODY_STYLE = {
  color: MUTED,
  fontFamily: "var(--font-sans)",
  fontSize: 17,
  lineHeight: 1.6,
} as const;

function StatTile({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div
      className="min-w-0 flex flex-col gap-2 p-4 md:p-6"
      style={{ backgroundColor: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}
    >
      <p
        className="tabular-nums"
        style={{
          color: INK,
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(32px, 4.2vw, 52px)",
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </p>
      <p style={{ color: INK, fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500 }}>
        {label}
      </p>
      <p style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 13 }}>{sub}</p>
    </div>
  );
}

function LeadsChart() {
  const max = Math.max(...SL.monthly.map((m) => m.chatbot + m.appfolio + m.webForm));
  const series = [
    { key: "chatbot", label: "Website chatbot", color: BLUE },
    { key: "appfolio", label: "AppFolio application", color: BLUE_LIGHT },
    { key: "webForm", label: "Website form", color: GRAY },
  ] as const;
  return (
    <figure className="mt-10">
      <div
        className="grid items-end gap-3 md:gap-6"
        style={{ gridTemplateColumns: `repeat(${SL.monthly.length}, minmax(0, 1fr))`, height: 260 }}
        role="img"
        aria-label={`Lead records by month and source, ${SL.label}`}
      >
        {SL.monthly.map((m) => {
          const total = m.chatbot + m.appfolio + m.webForm;
          return (
            <div key={m.month} className="flex h-full flex-col justify-end">
              <span
                className="mb-2 text-center tabular-nums"
                style={{ color: INK, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600 }}
              >
                {total}
              </span>
              <div
                className="flex w-full flex-col-reverse overflow-hidden"
                style={{ height: `${(total / max) * 200}px`, minHeight: total > 0 ? 2 : 0 }}
              >
                {series.map((s) =>
                  m[s.key] > 0 ? (
                    <div key={s.key} style={{ height: `${(m[s.key] / total) * 100}%`, backgroundColor: s.color }} />
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="grid gap-3 md:gap-6 pt-3 mt-0"
        style={{ gridTemplateColumns: `repeat(${SL.monthly.length}, minmax(0, 1fr))`, borderTop: `1px solid ${HAIRLINE}` }}
      >
        {SL.monthly.map((m) => (
          <div key={m.month} className="text-center" style={{ fontFamily: "var(--font-sans)" }}>
            <span className="block" style={{ color: INK, fontSize: 14 }}>
              {MONTH_LABEL[m.month] ?? m.month}
            </span>
            <span className="block tabular-nums" style={{ color: MUTED, fontSize: 12 }}>
              {m.chats} chats
            </span>
          </div>
        ))}
      </div>
      <figcaption
        className="mt-6 flex flex-wrap gap-x-6 gap-y-2"
        style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 13 }}
      >
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span aria-hidden="true" style={{ width: 10, height: 10, backgroundColor: s.color, display: "inline-block" }} />
            {s.label}
          </span>
        ))}
        <span>Lead records per month. Student leasing peaks in summer.</span>
      </figcaption>
    </figure>
  );
}

export default function CaseStudyPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK }}>
      <SectionShell bg="#FFFFFF">
        <div className="pt-16 md:pt-20 pb-12 md:pb-14 max-w-[900px]">
          <p style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 15 }}>
            {CS.customer} · {CS.property}, Berkeley
          </p>
          <h1
            className="mt-4"
            style={{
              color: INK,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(38px, 6vw, 72px)",
              fontWeight: 550,
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
              textWrap: "balance",
            }}
          >
            {SL.tracedLeases} new leases, <Mark>each traced back to the lead.</Mark>
          </h1>
          <p className="mt-6" style={{ ...BODY_STYLE, fontSize: 18, maxWidth: 660 }}>
            {CS.property} is student housing a three-minute walk from UC Berkeley, with{" "}
            {SL.residentsSynced} residents. Since April, {BRAND_NAME} has run its website and chatbot,
            synced AppFolio every hour, and matched each new lease to the chat, form or application it
            started from. {CS.customer} can now see which channel brought in each signed lease.
          </p>
          <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center gap-3">
            <BookDemoLink className="btn-primary sm:w-auto">Book a demo</BookDemoLink>
            <Link href="/audit" className="btn-secondary sm:w-auto">
              Run a free property audit
            </Link>
          </div>
        </div>

        <div className="pb-16 md:pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {STATS.map((s) => (
              <StatTile key={s.label} {...s} />
            ))}
          </div>
          <p className="mt-4" style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 13 }}>
            {CS.property}, {SL.label}. How we count is at the bottom of the page.
          </p>
        </div>
      </SectionShell>

      <SectionShell bg="#f4f4f4">
        <div className="py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
            <div>
              <h2 style={H2_STYLE}>The website renters actually use.</h2>
              <p className="mt-5" style={BODY_STYLE}>
                telegraphcommons.com runs on {BRAND_NAME}: availability, pricing, tours and
                applications, with a chatbot that greets every visitor. Its average position in Google
                search went from {SL.searchPositionFirstMonth} in April to {SL.searchPositionLatestMonth}{" "}
                in October, and it has earned {SL.searchClicks.toLocaleString()} clicks from search since
                launch.
              </p>
              <p className="mt-4" style={BODY_STYLE}>
                {SL.chatSessions} renters opened the chat and {SL.chatSessionsCaptured} of them (
                {pct(SL.chatSessionsCaptured, SL.chatSessions)}%) left a name and contact details. Those
                records go straight into the same lead list as AppFolio applications.
              </p>
            </div>
            <a
              href="https://www.telegraphcommons.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden"
              style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2, boxShadow: "0 12px 32px rgba(22,22,22,0.10)" }}
            >
              <Image
                src="/case-study/telegraph-commons-site.jpg"
                alt="The Telegraph Commons website home page, with the chatbot open in the corner"
                width={2880}
                height={1800}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="block h-auto w-full"
              />
            </a>
          </div>
        </div>
      </SectionShell>

      <SectionShell bg="#FFFFFF">
        <div className="py-16 md:py-20">
          <h2 className="max-w-[760px]" style={H2_STYLE}>
            {SL.leads} lead records, from every channel, in one list.
          </h2>
          <p className="mt-5 max-w-[680px]" style={BODY_STYLE}>
            {SL.leadsFromChatbot} came from the website chatbot, {SL.leadsFromAppfolioApplications} from
            AppFolio applications and {SL.leadsFromWebForm} from the website form, added in October. Each
            one is a record {BRAND_NAME} can match to a lease when the renter signs.
          </p>
          <LeadsChart />
        </div>
      </SectionShell>

      <SectionShell bg="#FFFFFF">
        <div className="pb-16 md:pb-20" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <div className="pt-16 md:pt-20 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <h2 style={H2_STYLE}>From first chat to a signed lease.</h2>
              <p className="mt-5" style={BODY_STYLE}>
                When AppFolio syncs a new resident, {BRAND_NAME} matches them to the lead record they
                started as. {SL.tracedLeases} new leases at {CS.property} now show where the renter came
                from, worth {usd(SL.tracedAnnualRentUsd)} a year in rent.
              </p>
              <p className="mt-4" style={BODY_STYLE}>
                {SL.tracedLeasesFromChat} of them began as a conversation with the website chatbot,{" "}
                {usd(SL.tracedAnnualRentFromChatUsd)} a year in rent, about {SL.avgDaysChatToLeaseStart}{" "}
                days from first chat to lease start on average. That is rent the website produced,
                reported next to every other channel.
              </p>
            </div>
            <dl style={{ borderTop: `1px solid ${INK}` }}>
              {RUNNING.map((r) => (
                <div
                  key={r.name}
                  className="grid gap-1 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6"
                  style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                >
                  <dt style={{ color: INK, fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600 }}>
                    {r.name}
                  </dt>
                  <dd style={{ fontFamily: "var(--font-sans)" }}>
                    <span className="block" style={{ color: MUTED, fontSize: 15, lineHeight: 1.5 }}>
                      {r.what}
                    </span>
                    <span className="mt-1 block tabular-nums" style={{ color: BLUE, fontSize: 14, fontWeight: 500 }}>
                      {r.proof}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </SectionShell>

      <SectionShell bg="#FFFFFF">
        <div className="pb-16 md:pb-20 max-w-[760px]">
          <h2 style={{ ...H2_STYLE, fontSize: "clamp(22px, 2.4vw, 28px)" }}>How we count</h2>
          <ul className="mt-6 flex flex-col gap-4">
            {METHOD.map((m) => (
              <li key={m.slice(0, 40)} style={{ ...BODY_STYLE, fontSize: 15 }}>
                {m}
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      <Proof />
    </div>
  );
}
