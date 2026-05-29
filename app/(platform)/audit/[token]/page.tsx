import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import { BRAND_NAME, getSiteUrl } from "@/lib/brand";
import { isValidShareToken } from "@/lib/audit/token";
import { ScoreCard, toneForScore } from "@/components/audit/score-card";
import { CountUp } from "@/components/audit/count-up";
import { EmailGate } from "@/components/audit/email-gate";
import {
  MentionsSection,
  type AuditMention,
} from "@/components/audit/mentions-section";

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
interface Findings {
  quickWins: Finding[];
  risks: Finding[];
  opportunities: Finding[];
  mentions?: AuditMention[];
}
interface SectionScores {
  seo?: number;
  aeo?: number;
  reputation?: number;
  traffic?: number;
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
    title: `${subject} — ${BRAND_NAME} property marketing audit`,
    description: `Free SEO, AEO, and reputation audit for ${subject}. Overall score, top findings, and what's at risk.`,
    alternates: { canonical: `/audit/${audit.shareToken}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${subject} — ${BRAND_NAME} audit`,
      description: `Property marketing audit by ${BRAND_NAME}.`,
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

  const sectionScores = (audit.sectionScores as SectionScores | null) ?? {};
  const findings = (audit.findings as Findings | null) ?? {
    quickWins: [],
    risks: [],
    opportunities: [],
  };
  const subject = audit.brandName ?? audit.domain;
  const overall = audit.overallScore ?? 0;
  const tone = toneForScore(overall);
  const accent =
    tone === "green"
      ? "#0E9F6E"
      : tone === "blue"
        ? "#2563EB"
        : tone === "amber"
          ? "#B45309"
          : "#B91C1C";

  if (!audit.email) {
    return (
      <ReportShell subject={subject} createdAt={audit.createdAt}>
        <TopLine
          subject={subject}
          overall={overall}
          accent={accent}
          sections={sectionScores}
        />
        <div className="mt-10">
          <EmailGate auditId={audit.id} />
        </div>
      </ReportShell>
    );
  }

  return (
    <ReportShell subject={subject} createdAt={audit.createdAt}>
      <TopLine
        subject={subject}
        overall={overall}
        accent={accent}
        sections={sectionScores}
      />

      <MentionsSection
        mentions={findings.mentions ?? []}
        brandName={subject}
        shareToken={audit.shareToken}
        auditCreatedAtIso={audit.createdAt.toISOString()}
      />

      <Findings findings={findings} />

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
          {BRAND_NAME} property marketing audit
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

function TopLine({
  subject,
  overall,
  accent,
  sections,
}: {
  subject: string;
  overall: number;
  accent: string;
  sections: SectionScores;
}) {
  return (
    <section className="mt-10">
      <div
        className="rounded-2xl border p-8 sm:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
          >
            Overall score
          </p>
          <div className="flex items-baseline gap-3 mt-2">
            <CountUp
              to={overall}
              className="text-7xl sm:text-8xl font-semibold tabular-nums leading-none"
            />
            <span className="text-2xl" style={{ color: "#9CA3AF" }}>
              / 100
            </span>
          </div>
          <p className="mt-3 text-base max-w-md" style={{ color: "#4B5563" }}>
            How {subject} stacks up across the four marketing surfaces every
            property is now judged on.
          </p>
        </div>
        <div
          className="h-32 w-32 sm:h-40 sm:w-40 rounded-full flex items-center justify-center"
          style={{
            background: `conic-gradient(${accent} ${overall * 3.6}deg, #F3F4F6 0deg)`,
          }}
          aria-hidden
        >
          <div
            className="h-24 w-24 sm:h-32 sm:w-32 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <span
              className="text-2xl font-semibold"
              style={{ color: accent }}
            >
              {overall}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard title="SEO" score={sections.seo} />
        <ScoreCard title="AEO" score={sections.aeo} />
        <ScoreCard title="Reputation" score={sections.reputation} />
        <ScoreCard title="Traffic" score={sections.traffic} />
      </div>
    </section>
  );
}

function Findings({ findings }: { findings: Findings }) {
  const quickWins = (findings.quickWins ?? []).slice(0, 5);
  const risks = (findings.risks ?? []).slice(0, 3);
  const opportunities = (findings.opportunities ?? []).slice(0, 5);

  return (
    <>
      {quickWins.length ? (
        <section className="mt-14">
          <SectionEyebrow>What we found</SectionEyebrow>
          <h2 className="text-2xl sm:text-3xl font-semibold mt-2" style={{ color: "#1E2A3A" }}>
            Top {quickWins.length} quick wins
          </h2>
          <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {quickWins.map((f) => (
              <FindingCard key={f.id} title={f.title} detail={f.detail} accent="#0E9F6E" />
            ))}
          </ul>
        </section>
      ) : null}

      {risks.length ? (
        <section className="mt-12">
          <SectionEyebrow>What&apos;s at risk</SectionEyebrow>
          <ul className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {risks.map((f) => (
              <FindingCard key={f.id} title={f.title} detail={f.detail} accent="#B91C1C" />
            ))}
          </ul>
        </section>
      ) : null}

      {opportunities.length ? (
        <section className="mt-12">
          <SectionEyebrow>Top opportunities</SectionEyebrow>
          <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {opportunities.map((f) => (
              <FindingCard key={f.id} title={f.title} detail={f.detail} accent="#2563EB" />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function FindingCard({
  title,
  detail,
  accent,
}: {
  title: string;
  detail?: string;
  accent: string;
}) {
  return (
    <li
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "#E5E7EB" }}
    >
      <div
        className="h-1 w-10 rounded-full mb-3"
        style={{ backgroundColor: accent }}
      />
      <p className="text-sm font-semibold" style={{ color: "#1E2A3A" }}>
        {title}
      </p>
      {detail ? (
        <p className="text-sm mt-1" style={{ color: "#4B5563" }}>
          {detail}
        </p>
      ) : null}
    </li>
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
    // Phase-1 auto-refresh until READY. Phase-2 spec calls for SSE.
    // Skip the meta refresh on FAILED so the user isn't stuck in a loop.
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
