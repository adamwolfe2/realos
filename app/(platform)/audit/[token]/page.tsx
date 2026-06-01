import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import { BRAND_NAME, getSiteUrl } from "@/lib/brand";
import { isValidShareToken } from "@/lib/audit/token";
import { AuditPaywall } from "@/components/audit/paywall";
import {
  MentionsSection,
  type AuditMention,
} from "@/components/audit/mentions-section";
import { DpsHero } from "@/components/audit/dps-hero";
import { PillarGrid } from "@/components/audit/pillar-grid";
import { RecommendationsSection } from "@/components/audit/recommendations-section";
import { BookCallCta } from "@/components/audit/book-call-cta";
import type { DpsResult } from "@/lib/audit/scoring";
import type { ActionItem } from "@/lib/audit/recommendations";
import { OVERALL_DPS_CAP } from "@/lib/audit/quiz-questions";

interface AuditRow {
  id: string;
  shareToken: string;
  domain: string;
  brandName: string | null;
  status: ProspectAuditStatus;
  overallScore: number | null;
  sectionScores: unknown;
  claudeSummary: string | null;
  findings: unknown;
  email: string | null;
  emailCapturedAt: Date | null;
  createdAt: Date;
}

interface Finding {
  id: string;
  title: string;
  detail?: string;
}
// Audit findings JSON. Adam 2026-06-01: the new DPS shape is `dps` +
// `recommendations`. Legacy audits won't have these fields — the renderer
// branches on `findings.dps` and falls back to the legacy quick-wins /
// risks view when the new fields are absent.
interface Findings {
  quickWins: Finding[];
  risks: Finding[];
  opportunities: Finding[];
  mentions?: AuditMention[];
  // New DPS shape (post-2026-06-01 audits)
  dps?: DpsResult;
  recommendations?: ActionItem[];
}

async function loadAudit(token: string): Promise<AuditRow | null> {
  if (!isValidShareToken(token)) return null;
  return prisma.prospectAudit.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      shareToken: true,
      domain: true,
      brandName: true,
      status: true,
      overallScore: true,
      sectionScores: true,
      claudeSummary: true,
      findings: true,
      email: true,
      emailCapturedAt: true,
      createdAt: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const audit = await loadAudit(token);
  if (!audit) {
    return { title: `Audit not found | ${BRAND_NAME}` };
  }
  const subject = audit.brandName ?? audit.domain;
  return {
    title: `${subject} — Digital Performance Score | ${BRAND_NAME}`,
    description: `Personalized Digital Performance Score for ${subject}. Six pillars, capped at ${OVERALL_DPS_CAP}, with a prioritized action plan.`,
    alternates: { canonical: `/audit/${audit.shareToken}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${subject} — ${BRAND_NAME} Digital Performance Score`,
      description: `Digital Performance Score by ${BRAND_NAME}.`,
      url: `${getSiteUrl()}/audit/${audit.shareToken}`,
      type: "article",
    },
  };
}

export default async function AuditViewerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const audit = await loadAudit(token);
  if (!audit) notFound();

  // Fire-and-forget view counter. Swallow errors so a transient DB hiccup
  // never fails the render of an otherwise-good audit.
  void prisma.prospectAudit
    .update({
      where: { id: audit.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })
    .catch(() => undefined);

  if (audit.status !== ProspectAuditStatus.READY) {
    return <PendingState status={audit.status} domain={audit.domain} />;
  }

  const findings = (audit.findings as Findings | null) ?? {
    quickWins: [],
    risks: [],
    opportunities: [],
  };
  const subject = audit.brandName ?? audit.domain;
  const dps = findings.dps;
  const recommendations = findings.recommendations ?? [];
  const mentions = findings.mentions ?? [];
  const perSourceCounts = computePerSourceCounts(mentions);

  // Legacy audits (pre-2026-06-01) don't have findings.dps. Fall back to
  // the overallScore int we persist for backwards compat, with the
  // global cap applied so we never render >75 even on stale data.
  const score = dps?.score ?? Math.min(audit.overallScore ?? 0, OVERALL_DPS_CAP);
  const cap = dps?.cap ?? OVERALL_DPS_CAP;
  const capReason =
    dps?.capReason ??
    "Every property has structural ceilings on AI search, tracking, and review velocity until they're actively managed.";
  const highSeverity = recommendations.filter((r) => r.severity === "high").length;

  return (
    <ReportShell subject={subject} createdAt={audit.createdAt}>
      <DpsHero
        subject={subject}
        score={score}
        cap={cap}
        capReason={capReason}
        recommendationCount={recommendations.length}
      />

      {dps ? <PillarGrid pillars={dps.pillars} /> : null}

      <SourceBreakdown counts={perSourceCounts} totalMentions={mentions.length} />

      <AuditPaywall
        unlocked={!!audit.email}
        auditId={audit.id}
        mentionCount={mentions.length}
        findingCount={recommendations.length}
      >
        <RecommendationsSection recommendations={recommendations} />

        <MentionsSection
          mentions={mentions}
          brandName={subject}
          shareToken={audit.shareToken}
          auditCreatedAtIso={audit.createdAt.toISOString()}
        />

        {audit.claudeSummary ? (
          <section className="mt-12">
            <SectionEyebrow>What this means</SectionEyebrow>
            <p
              className="text-lg leading-relaxed mt-3 max-w-3xl"
              style={{ color: "#1E2A3A" }}
            >
              {audit.claudeSummary}
            </p>
          </section>
        ) : null}

        <section
          className="mt-16 rounded-2xl border p-8 sm:p-10"
          style={{ borderColor: "#E5E7EB", backgroundColor: "#FBFBFD" }}
        >
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
          >
            Next step
          </p>
          <h3
            className="text-2xl sm:text-3xl font-semibold mt-2 max-w-2xl"
            style={{ color: "#1E2A3A" }}
          >
            Want this monitored daily for your whole portfolio?
          </h3>
          <p
            className="text-base mt-2 max-w-2xl"
            style={{ color: "#4B5563" }}
          >
            {BRAND_NAME} runs this report every day for every property, watches
            the deltas, and tells your team what to do about it.
          </p>
          <div className="mt-5">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-medium text-white"
              style={{ backgroundColor: "#2563EB" }}
            >
              Talk to us
            </Link>
          </div>
        </section>
      </AuditPaywall>

      <BookCallCta
        subtitle={
          highSeverity > 0
            ? `${highSeverity} high-priority gap${highSeverity === 1 ? "" : "s"} identified — we can close most of them in 30 days.`
            : undefined
        }
      />
    </ReportShell>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ReportShell({
  subject,
  createdAt,
  children,
}: {
  subject: string;
  createdAt: Date;
  children: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-12 md:pt-16 pb-20">
        <p
          className="text-[11px] font-mono uppercase tracking-[0.18em]"
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
          }}
        >
          {BRAND_NAME} Digital Performance Score
        </p>
        <h1
          className="text-3xl md:text-5xl font-semibold mt-3 tracking-tight"
          style={{ color: "#1E2A3A" }}
        >
          {subject}
        </h1>
        <p className="text-sm mt-2" style={{ color: "#6B7280" }}>
          Generated {formatDate(createdAt)}.
        </p>
        {children}
        <footer
          className="mt-20 pt-6 border-t text-xs"
          style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
        >
          Generated by {BRAND_NAME} on {formatDate(createdAt)}.
        </footer>
      </div>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-mono uppercase tracking-[0.18em]"
      style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
    >
      {children}
    </p>
  );
}

function PendingState({
  status,
  domain,
}: {
  status: ProspectAuditStatus;
  domain: string;
}) {
  const isFailed = status === ProspectAuditStatus.FAILED;
  return (
    <>
      {!isFailed ? (
        <meta httpEquiv="refresh" content="5" />
      ) : null}
      <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
        <div className="max-w-[800px] mx-auto px-4 md:px-8 pt-24 pb-24">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
          >
            {BRAND_NAME} audit
          </p>
          <h1
            className="text-3xl md:text-4xl font-semibold mt-3"
            style={{ color: "#1E2A3A" }}
          >
            {isFailed
              ? "We couldn't finish this audit."
              : `Still scanning ${domain}…`}
          </h1>
          <p className="text-base mt-3 max-w-lg" style={{ color: "#4B5563" }}>
            {isFailed
              ? "Try again from /audit. The most common cause is a domain that's behind a login or returning 5xx."
              : "This page refreshes itself every few seconds. You can also bookmark this URL and come back later."}
          </p>
        </div>
      </div>
    </>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// SourceBreakdown — chip row that exposes the breadth of the reputation
// scan above the email gate. Preserved from the legacy result page.
// ---------------------------------------------------------------------------

type AuditSource = AuditMention["source"];

const SOURCE_DISPLAY: Array<{
  source: AuditSource;
  label: string;
  color: string;
}> = [
  { source: "REDDIT",            label: "Reddit",          color: "#FF4500" },
  { source: "YELP",              label: "Yelp",            color: "#D32323" },
  { source: "GOOGLE_REVIEW",     label: "Google",          color: "#4285F4" },
  { source: "APARTMENT_RATINGS", label: "ApartmentRatings", color: "#0E9F6E" },
  { source: "BBB",               label: "BBB",             color: "#0F4C81" },
  { source: "FACEBOOK",          label: "Facebook",        color: "#1877F2" },
  { source: "TAVILY_WEB",        label: "Open web",        color: "#6B7280" },
];

function computePerSourceCounts(
  mentions: AuditMention[],
): Record<AuditSource, number> {
  const counts: Record<AuditSource, number> = {
    REDDIT: 0,
    YELP: 0,
    BBB: 0,
    APARTMENT_RATINGS: 0,
    FACEBOOK: 0,
    GOOGLE_REVIEW: 0,
    TAVILY_WEB: 0,
  };
  for (const m of mentions) {
    if (m && m.source && counts[m.source] !== undefined) {
      counts[m.source] += 1;
    }
  }
  return counts;
}

function SourceBreakdown({
  counts,
  totalMentions,
}: {
  counts: Record<AuditSource, number>;
  totalMentions: number;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p
          className="text-[11px] font-mono uppercase tracking-[0.18em]"
          style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
        >
          Reputation scan · past 90 days
        </p>
        <p
          className="text-xs"
          style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
        >
          {totalMentions} mention{totalMentions === 1 ? "" : "s"} across{" "}
          {SOURCE_DISPLAY.length} source
          {SOURCE_DISPLAY.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {SOURCE_DISPLAY.map(({ source, label, color }) => {
          const count = counts[source] ?? 0;
          const has = count > 0;
          return (
            <li
              key={source}
              className="inline-flex items-center gap-2 rounded-full h-8 px-3"
              style={{
                backgroundColor: has ? "#FFFFFF" : "#FBFBFD",
                border: `1px solid ${has ? "#E5E7EB" : "#F3F4F6"}`,
                color: has ? "#1E2A3A" : "#9CA3AF",
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 500,
                opacity: has ? 1 : 0.85,
              }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: has ? color : "#D1D5DB",
                }}
              />
              <span>{label}</span>
              <span
                className="tabular-nums"
                style={{ color: has ? "#6B7280" : "#9CA3AF" }}
              >
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
