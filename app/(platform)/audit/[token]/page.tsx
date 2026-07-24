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
import { AuditTrustStrip } from "@/components/audit/audit-trust-strip";
import { AeoEngineBreakdown } from "@/components/audit/aeo-engine-breakdown";
import {
  GoogleAiOverviewCard,
  AeoOnPageCard,
  SchemaGapCard,
  DetectedStackCard,
} from "@/components/audit/premium-sections";
import {
  BriefShellHeader,
  BriefShellFooter,
  BriefNarrativePanel,
  BriefSourcesBlock,
  SourceBullet,
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
  GoogleMark,
  type BriefSource,
} from "@/components/audit/brief-shell";
import type { DpsResult } from "@/lib/audit/scoring";
import type { ActionItem } from "@/lib/audit/recommendations";
import type {
  AeoEngineRow,
  AeoOnPageFindings,
  DetectedStack,
  GoogleAiOverviewFindings,
  SchemaGap,
} from "@/lib/audit/synthesize";
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
// `recommendations`. Legacy audits won't have these fields. The renderer
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
  // Premium sections (post-2026-06-03 audits). All optional — legacy
  // audits render fine without these. AeoCompetitorsCited is a flat
  // list copied from the AEO fan-out; the page reads it alongside the
  // per-engine breakdown.
  aeoEngines?: AeoEngineRow[];
  aeoCompetitorsCited?: string[];
  aeoOnPage?: AeoOnPageFindings | null;
  googleAiOverview?: GoogleAiOverviewFindings | null;
  detectedStack?: DetectedStack;
  schemaGap?: SchemaGap;
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
    title: `${subject}. Digital Performance Score | ${BRAND_NAME}`,
    description: `Personalized Digital Performance Score for ${subject}. Six pillars of real-data benchmarking with a prioritized action plan.`,
    alternates: { canonical: `/audit/${audit.shareToken}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${subject}. ${BRAND_NAME} Digital Performance Score`,
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
    return (
      <PendingState
        status={audit.status}
        domain={audit.domain}
        createdAt={audit.createdAt}
      />
    );
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
  // the persisted overallScore for backwards compat, clamped to the
  // ceiling so stale audits never render >75. Adam 2026-06-01: the cap
  // is enforcement only. No UI surfacing.
  const score = dps?.score ?? Math.min(audit.overallScore ?? 0, OVERALL_DPS_CAP);
  const highSeverity = recommendations.filter((r) => r.severity === "high").length;

  // Premium pre-paywall surfaces (2026-06-03). Each is gated only on
  // whether the underlying signal landed for this audit — legacy audits
  // (no aeoEngines field on findings) cleanly render as no-ops.
  const aeoEngines = findings.aeoEngines ?? [];
  const aeoCompetitorsCited = findings.aeoCompetitorsCited ?? [];
  const googleAio = findings.googleAiOverview ?? null;
  const aeoOnPage = findings.aeoOnPage ?? null;
  const schemaGap = findings.schemaGap ?? null;
  const detectedStack = findings.detectedStack ?? null;
  const enginesQueried = aeoEngines.length;
  const totalAiResponses = enginesQueried * 5; // 5 prompts per engine

  // Shared brief-shell sources — every data provider the pipeline
  // touched, rendered as clickable cards before the footer. Trust by
  // traceability. Future audits with the verbatim-quote layer can
  // extend this list with the deep-link surfaces directly.
  const sources: BriefSource[] = [
    {
      label: "Firecrawl",
      description: aeoOnPage
        ? `Rendered homepage HTML for ${audit.domain}`
        : "Site-render API used for the homepage audit (Cloudflare-tolerant)",
      href: "https://firecrawl.dev",
      icon: <SourceBullet />,
    },
    {
      label: "ChatGPT (OpenAI)",
      description:
        enginesQueried > 0
          ? "Asked five buyer-intent prompts for this brand"
          : "Engine queried during the AEO scan",
      href: "https://chatgpt.com",
      icon: <ChatGPTMark size={18} />,
    },
    {
      label: "Perplexity",
      description: "Engine queried during the AEO scan",
      href: "https://www.perplexity.ai",
      icon: <PerplexityMark size={18} />,
    },
    {
      label: "Claude (Anthropic)",
      description: "Engine queried during the AEO scan",
      href: "https://claude.ai",
      icon: <ClaudeMark size={18} />,
    },
    {
      label: "Gemini",
      description: "Engine queried during the AEO scan",
      href: "https://gemini.google.com",
      icon: <GeminiMark size={18} />,
    },
    {
      label: "Google AI Overview · DataForSEO",
      description: googleAio
        ? "Captured the verbatim AI Overview for the brand-name query"
        : "Search-intelligence API used for ranked keywords, Lighthouse, backlinks, and AI Overview",
      href: "https://dataforseo.com",
      icon: <GoogleMark size={18} />,
    },
    {
      label: "Tavily",
      description: `${mentions.length} public mention${mentions.length === 1 ? "" : "s"} sourced across Reddit, Yelp, BBB, ApartmentRatings, Facebook, and the open web`,
      href: "https://tavily.com",
      icon: <SourceBullet inner="#475569" />,
    },
    {
      label: "schema.org",
      description: "Reference vocabulary for AI-readable structured data",
      href: "https://schema.org",
      icon: <SourceBullet inner="#475569" />,
    },
    {
      label: `https://${audit.domain}`,
      description: aeoOnPage?.url
        ? "Live homepage we audited"
        : "Target domain audited",
      href: aeoOnPage?.url ?? `https://${audit.domain}`,
      icon: <SourceBullet />,
    },
  ];

  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <BriefShellHeader
        subjectName={subject}
        generatedAtIso={audit.createdAt.toISOString()}
        label="Audit"
      />

      <div className="max-w-[1080px] mx-auto px-4 md:px-6 pt-10 md:pt-12 pb-12">
        <DpsHero
          subject={subject}
          score={score}
          recommendationCount={recommendations.length}
        />

        {/* Premium trust strip — engine logos + audit counts. Lives
            between the hero and the pillar grid so the prospect's
            first scroll establishes credibility. */}
        {enginesQueried > 0 ? (
          <AuditTrustStrip
            brandName={subject}
            enginesQueried={enginesQueried}
            reputationSources={7}
            totalMentions={mentions.length}
            totalAiResponses={totalAiResponses}
            auditedAtIso={audit.createdAt.toISOString()}
            auditId={audit.id}
          />
        ) : null}

        {dps ? <PillarGrid pillars={dps.pillars} /> : null}

        {/* Per-engine AEO breakdown — branded marks for ChatGPT,
            Perplexity, Claude, Gemini. The verdict surface. */}
        {aeoEngines.length > 0 ? (
          <AeoEngineBreakdown
            rows={aeoEngines}
            competitorsCited={aeoCompetitorsCited}
            brandName={subject}
          />
        ) : null}

        {/* Verbatim Google AI Overview for the brand-name query. */}
        {googleAio ? (
          <GoogleAiOverviewCard findings={googleAio} brandName={subject} />
        ) : null}

        {/* 8-check AEO Page Health scorecard on the homepage. */}
        {aeoOnPage ? <AeoOnPageCard findings={aeoOnPage} /> : null}

        {/* Schema markup gap — present vs missing types. */}
        {schemaGap ? <SchemaGapCard findings={schemaGap} /> : null}

        {/* Observed conversion stack from the rendered homepage HTML. */}
        {detectedStack ? <DetectedStackCard findings={detectedStack} /> : null}

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

          <section
            className="mt-10 rounded-xl border p-5 sm:p-6"
            style={{ borderColor: "#E5E7EB", backgroundColor: "#FBFBFD" }}
          >
            <p
              className="text-[10px] font-mono uppercase tracking-[0.16em]"
              style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
            >
              Next step
            </p>
            <h3
              className="text-lg sm:text-xl font-semibold mt-1 max-w-xl"
              style={{ color: "#1E2A3A" }}
            >
              Want this monitored daily for your whole portfolio?
            </h3>
            <p
              className="text-[13px] sm:text-sm mt-1.5 max-w-xl"
              style={{ color: "#4B5563" }}
            >
              {BRAND_NAME} runs this report every day for every property,
              watches the deltas, and tells your team what to do about it.
            </p>
            <div className="mt-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center h-10 px-5 rounded-md text-[13px] font-medium text-white"
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
              ? `${highSeverity} high-priority gap${highSeverity === 1 ? "" : "s"} identified. We can close most of them in 30 days.`
              : undefined
          }
        />
      </div>

      {/* Light brand-blue narrative panel — replaces the old inline
          "What this means" paragraph. Lives outside the max-width
          container so the panel goes full-bleed like /brief. */}
      {audit.claudeSummary ? (
        <BriefNarrativePanel
          heading={`Where ${subject} stands today.`}
        >
          <p>{audit.claudeSummary}</p>
        </BriefNarrativePanel>
      ) : null}

      {/* Sources block — every data provider that produced a number on
          this audit, with a clickable link to verify. */}
      <BriefSourcesBlock sources={sources} />

      {/* Light footer with audit id + traceability metadata. */}
      <BriefShellFooter
        reportId={audit.id}
        generatedAtIso={audit.createdAt.toISOString()}
        liveApiCalls={totalAiResponses}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

// Staged progress copy for the pending screen. The pipeline runs
// crawl → AI-engine fan-out → scoring; we don't get granular progress
// events, so the active stage is estimated from elapsed time since the
// audit was queued. Each meta-refresh re-renders and advances the stage.
const PENDING_STAGES = [
  { label: "Crawling your site", hint: "Rendering the homepage and reading structure, schema, and copy." },
  { label: "Querying AI engines", hint: "Asking ChatGPT, Perplexity, Claude, and Gemini the questions your prospects ask." },
  { label: "Scoring and writing recommendations", hint: "Weighting six pillars and prioritizing the action plan." },
] as const;

function estimateStage(status: ProspectAuditStatus, createdAt: Date): number {
  if (status === ProspectAuditStatus.QUEUED) return 0;
  const elapsedSec = (Date.now() - createdAt.getTime()) / 1000;
  if (elapsedSec < 25) return 0;
  if (elapsedSec < 75) return 1;
  return 2;
}

function PendingState({
  status,
  domain,
  createdAt,
}: {
  status: ProspectAuditStatus;
  domain: string;
  createdAt: Date;
}) {
  const isFailed = status === ProspectAuditStatus.FAILED;
  const activeStage = isFailed ? -1 : estimateStage(status, createdAt);
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
              ? "The most common cause is a domain that's behind a login or returning server errors. Start a fresh audit and we'll run the full scan again."
              : "This page refreshes itself every few seconds. You can also bookmark this URL and come back later."}
          </p>
          {isFailed ? (
            <div className="mt-6">
              <Link
                href="/audit"
                className="inline-flex items-center justify-center h-10 px-5 text-[13px] font-medium text-white"
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "2px",
                }}
              >
                Start a new audit
              </Link>
            </div>
          ) : (
            <ol className="mt-8 max-w-lg" aria-label="Audit progress">
              {PENDING_STAGES.map((stage, i) => {
                const state =
                  i < activeStage ? "done" : i === activeStage ? "active" : "pending";
                return (
                  <li
                    key={stage.label}
                    className="flex items-start gap-3 py-3"
                    style={{
                      borderBottom:
                        i < PENDING_STAGES.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                    }}
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block h-2 w-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          state === "pending"
                            ? "var(--color-muted)"
                            : "var(--color-primary)",
                        opacity: state === "done" ? 0.45 : 1,
                      }}
                    />
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{
                          color:
                            state === "pending" ? "#6B7280" : "#1E2A3A",
                        }}
                      >
                        {stage.label}
                        {state === "active" ? "…" : ""}
                      </p>
                      {state === "active" ? (
                        <p className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
                          {stage.hint}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SourceBreakdown. Chip row that exposes the breadth of the reputation
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
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p
          className="text-[10px] font-mono uppercase tracking-[0.16em]"
          style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
        >
          Reputation scan · past 90 days
        </p>
        <p
          className="text-[10px]"
          style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
        >
          {totalMentions} mention{totalMentions === 1 ? "" : "s"} · {SOURCE_DISPLAY.length} sources
        </p>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {SOURCE_DISPLAY.map(({ source, label, color }) => {
          const count = counts[source] ?? 0;
          const has = count > 0;
          return (
            <li
              key={source}
              className="inline-flex items-center gap-1.5 rounded-full h-7 px-2.5"
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
