import type { Metadata } from "next";
import type { ReactNode } from "react";
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
    value: String(SL.searchPositionLatestMonth),
    label: "Average Google search position",
    sub: `Up from ${SL.searchPositionFirstMonth} in April. Lower is better`,
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
      className="min-w-0 flex flex-col items-center gap-2 px-3 py-6 sm:px-5 md:py-8 text-center"
      style={{ backgroundColor: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}
    >
      <p
        className="tabular-nums"
        style={{
          color: INK,
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(30px, 3.4vw, 48px)",
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
      <p style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.45, maxWidth: 220 }}>
        {sub}
      </p>
    </div>
  );
}

function SectionIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[720px] text-center">
      <h2 style={{ ...H2_STYLE, textWrap: "balance" }}>{title}</h2>
      <p className="mt-5" style={BODY_STYLE}>
        {children}
      </p>
    </div>
  );
}

function runningTotal(values: ReadonlyArray<number>): number[] {
  return values.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);
}

// Line chart drawn in a 0-100 SVG box stretched to the card, so the line
// stays crisp at any width while labels stay real HTML text.
function TrendCard({
  title,
  note,
  points,
  invert = false,
  decimals = 0,
}: {
  title: string;
  note: string;
  points: number[];
  /** Lower is better (search position): draw improvement as going up. */
  invert?: boolean;
  decimals?: number;
}) {
  const months = SL.monthly.map((m) => MONTH_LABEL[m.month] ?? m.month);
  const min = invert ? Math.min(...points) - 1 : 0;
  const max = Math.max(...points) + (invert ? 1 : 0);
  const span = max - min || 1;
  const xy = points.map((v, i) => {
    const x = (i / (points.length - 1)) * 100;
    const t = (v - min) / span;
    return [x, invert ? t * 100 : 100 - t * 100] as const;
  });
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
  const first = points[0] ?? 0;
  const last = points.at(-1) ?? 0;
  return (
    <figure
      className="min-w-0 flex flex-col p-6 md:p-7"
      style={{ backgroundColor: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}
    >
      <figcaption>
        <span className="block" style={{ color: INK, fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600 }}>
          {title}
        </span>
        <span className="block mt-1" style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 13 }}>
          {note}
        </span>
      </figcaption>
      <p className="mt-5 flex items-baseline gap-2 tabular-nums" style={{ fontFamily: "var(--font-sans)" }}>
        <span style={{ color: INK, fontSize: 40, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em" }}>
          {fmt(last)}
        </span>
        <span style={{ color: MUTED, fontSize: 14 }}>
          from {fmt(first)} in {months[0]}
        </span>
      </p>
      <div className="relative mt-6" style={{ height: 140 }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <polygon points={`0,100 ${line} 100,100`} fill={BLUE} fillOpacity={0.08} />
          <polyline
            points={line}
            fill="none"
            stroke={BLUE}
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {xy.map(([x, y], i) => (
          <span
            key={months[i]}
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: 7,
              height: 7,
              transform: "translate(-50%, -50%)",
              backgroundColor: i === xy.length - 1 ? BLUE : "#FFFFFF",
              border: `2px solid ${BLUE}`,
            }}
          />
        ))}
      </div>
      <div
        className="mt-3 flex justify-between"
        style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 12 }}
      >
        {months.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <p className="sr-only">
        {title}: {points.map((v, i) => `${months[i]} ${fmt(v)}`).join(", ")}.
      </p>
    </figure>
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
    <figure className="mt-12">
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
        className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-center"
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
        <div className="pt-16 md:pt-24 pb-12 md:pb-16 mx-auto max-w-[920px] text-center">
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
          <p className="mt-6 mx-auto" style={{ ...BODY_STYLE, fontSize: 18, maxWidth: 660 }}>
            {CS.property} is student housing a three-minute walk from UC Berkeley, with{" "}
            {SL.residentsSynced} residents. Since April, {BRAND_NAME} has run its website and chatbot,
            synced AppFolio every hour, and matched each new lease to the chat, form or application it
            started from. {CS.customer} can now see which channel brought in each signed lease.
          </p>
          <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-center gap-3">
            <BookDemoLink className="btn-primary sm:w-auto">Book a demo</BookDemoLink>
            <Link href="/audit" className="btn-secondary sm:w-auto">
              Run a free property audit
            </Link>
          </div>
        </div>

        <div className="pb-16 md:pb-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {STATS.map((s) => (
              <StatTile key={s.label} {...s} />
            ))}
          </div>
          <p className="mt-5 text-center" style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: 13 }}>
            {CS.property}, {SL.label}. How we count is at the bottom of the page.
          </p>
        </div>
      </SectionShell>

      <SectionShell bg="#f4f4f4">
        <div className="py-16 md:py-24">
          <SectionIntro title="Six months of growth since launch.">
            Running totals from the day {BRAND_NAME} went live. Leads build through the leasing season,
            leases follow them, and the site now ranks higher in Google than it did in April.
          </SectionIntro>
          <div className="mt-12 grid gap-4 md:gap-5 lg:grid-cols-3">
            <TrendCard
              title="Lead records"
              note="Running total, all channels"
              points={runningTotal(SL.monthly.map((m) => m.chatbot + m.appfolio + m.webForm))}
            />
            <TrendCard
              title="Leases traced to a lead"
              note="Running total. Most student leases start in August"
              points={runningTotal(SL.monthly.map((m) => m.leasesTraced))}
            />
            <TrendCard
              title="Google search position"
              note="Monthly average. Lower is better"
              points={SL.monthly.map((m) => m.searchPosition)}
              invert
              decimals={1}
            />
          </div>
        </div>
      </SectionShell>

      <SectionShell bg="#FFFFFF">
        <div className="py-16 md:py-24">
          <SectionIntro title="The website renters actually use.">
            telegraphcommons.com runs on {BRAND_NAME}: availability, pricing, tours and applications,
            with a chatbot that greets every visitor. {SL.chatSessions} renters opened the chat and{" "}
            {SL.chatSessionsCaptured} of them ({pct(SL.chatSessionsCaptured, SL.chatSessions)}%) left a
            name and contact details. The site has earned {SL.searchClicks.toLocaleString()} clicks
            from Google search since launch.
          </SectionIntro>
          <a
            href="https://www.telegraphcommons.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-12 mx-auto block max-w-[1080px] overflow-hidden"
            style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2, boxShadow: "0 16px 40px rgba(22,22,22,0.10)" }}
          >
            <Image
              src="/case-study/telegraph-commons-site.jpg"
              alt="The Telegraph Commons website home page, with the chatbot open in the corner"
              width={2880}
              height={1800}
              sizes="(min-width: 1120px) 1080px, 100vw"
              className="block h-auto w-full"
            />
          </a>
        </div>
      </SectionShell>

      <SectionShell bg="#f4f4f4">
        <div className="py-16 md:py-24">
          <SectionIntro title={`${SL.leads} lead records, every channel, one list.`}>
            {SL.leadsFromChatbot} came from the website chatbot, {SL.leadsFromAppfolioApplications} from
            AppFolio applications and {SL.leadsFromWebForm} from the website form, added in October.
            Each one is a record {BRAND_NAME} can match to a lease when the renter signs.
          </SectionIntro>
          <div className="mx-auto max-w-[920px]">
            <LeadsChart />
          </div>
        </div>
      </SectionShell>

      <SectionShell bg="#FFFFFF">
        <div className="py-16 md:py-24">
          <SectionIntro title="From first chat to a signed lease.">
            When AppFolio syncs a new resident, {BRAND_NAME} matches them to the lead record they started
            as. {SL.tracedLeasesFromChat} of the {SL.tracedLeases} traced leases began as a conversation
            with the website chatbot, {usd(SL.tracedAnnualRentFromChatUsd)} a year in rent, about{" "}
            {SL.avgDaysChatToLeaseStart} days from first chat to lease start on average.
          </SectionIntro>
          <dl className="mt-12 mx-auto max-w-[880px]" style={{ borderTop: `1px solid ${INK}` }}>
            {RUNNING.map((r) => (
              <div
                key={r.name}
                className="grid gap-1 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8"
                style={{ borderBottom: `1px solid ${HAIRLINE}` }}
              >
                <dt style={{ color: INK, fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 600 }}>
                  {r.name}
                </dt>
                <dd style={{ fontFamily: "var(--font-sans)" }}>
                  <span className="block" style={{ color: MUTED, fontSize: 15, lineHeight: 1.55 }}>
                    {r.what}
                  </span>
                  <span className="mt-1.5 block tabular-nums" style={{ color: BLUE, fontSize: 14, fontWeight: 500 }}>
                    {r.proof}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </SectionShell>

      <SectionShell bg="#FFFFFF">
        <div className="pt-4 pb-16 md:pb-24">
          <div className="mx-auto max-w-[720px] pt-12 md:pt-16">
            <h2 className="text-center" style={{ ...H2_STYLE, fontSize: "clamp(24px, 2.4vw, 30px)" }}>
              How we count
            </h2>
            <ul className="mt-8 flex flex-col gap-5">
              {METHOD.map((m) => (
                <li key={m.slice(0, 40)} style={{ ...BODY_STYLE, fontSize: 15 }}>
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionShell>

      <Proof />
    </div>
  );
}
