import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import { healStalledProspectAudit } from "@/lib/audit/self-heal";
import { BRAND_NAME, getSiteUrl } from "@/lib/brand";
import { isValidShareToken } from "@/lib/audit/token";
import { stripChatbotMarkdown } from "@/lib/chatbot/strip-markdown";
import { AuditPaywall } from "@/components/audit/paywall";
import {
  MentionsSection,
  type AuditMention,
} from "@/components/audit/mentions-section";
import {
  VerdictFold,
  type FoldStat,
  type FoldEngine,
  type FoldPillar,
} from "@/components/audit/verdict-fold";
import { ReportSpine, type SpineItem } from "@/components/audit/report-spine";
import { PillarGrid } from "@/components/audit/pillar-grid";
import { RecommendationsSection } from "@/components/audit/recommendations-section";
import { BookCallCta } from "@/components/audit/book-call-cta";
import { AuditTrustStrip } from "@/components/audit/audit-trust-strip";
import { AeoEngineBreakdown } from "@/components/audit/aeo-engine-breakdown";
import { AeoReceiptsBlock } from "@/components/audit/aeo-receipts";
import {
  AUDIT_PROMPTS_PER_ENGINE,
  type AeoReceipt,
} from "@/lib/signals/compute";
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
  displayName,
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
  updatedAt: Date;
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
  // Discovery split (post-2026-08-13 audits). aeoDiscoveryRan false =
  // branded-only fallback on a new audit; absent = legacy audit.
  aeoDiscoveryRan?: boolean;
  aeoLocale?: { city: string | null; region: string | null } | null;
  // Verbatim receipts (post-2026-08-14 audits).
  aeoReceipts?: AeoReceipt[];
  // Ranked competitor mentions (post-2026-08-14 audits).
  aeoCompetitorsRanked?: Array<{ name: string; mentions: number }>;
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
      updatedAt: true,
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
  // Same display-casing rule as the page body — "telegraph commons." in
  // the tab title vs "Telegraph Commons" in the hero read as a typo.
  const subject = displayName(audit.brandName ?? audit.domain);
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
    // Self-heal on view (2026-08-13): share-link viewers land here
    // without ever hitting the form's status poll, so a stranded QUEUED
    // audit (dropped fire-and-forget trigger) would spin forever. The
    // 5s meta-refresh makes this render the poll loop — re-arm or
    // reap exactly like GET /api/audit/[id]. Fire-and-forget.
    void healStalledProspectAudit(audit).catch(() => undefined);
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
  // Display-scale name — shared rule with generateMetadata (brief-shell
  // displayName): title-case all-lowercase brand names, never domains.
  const displaySubject = displayName(subject);
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

  // Premium surfaces (2026-06-03). Each is gated only on whether the
  // underlying signal landed for this audit — legacy audits (no
  // aeoEngines field on findings) cleanly render as no-ops.
  const aeoEngines = findings.aeoEngines ?? [];
  const aeoCompetitorsCited = findings.aeoCompetitorsCited ?? [];
  // Verbatim receipts (2026-08-14): additive field — legacy audits lack
  // it and render exactly as before.
  const aeoReceipts: AeoReceipt[] = findings.aeoReceipts ?? [];
  const aeoDiscoveryRan = findings.aeoDiscoveryRan;
  const aeoCity = findings.aeoLocale?.city ?? null;
  const googleAio = findings.googleAiOverview ?? null;
  const aeoOnPage = findings.aeoOnPage ?? null;
  const schemaGap = findings.schemaGap ?? null;
  const detectedStack = findings.detectedStack ?? null;
  const enginesQueried = aeoEngines.length;
  const notCited = aeoEngines.filter((r) => !r.cited).length;
  // Discovery split (2026-08-13): engines that know the property exists
  // (cite its site on branded prompts) but never recommend it in
  // unbranded discovery answers. The sharpest sales wedge in the report.
  const discoveryMode =
    aeoDiscoveryRan === true &&
    aeoEngines.some((r) => r.discovered !== undefined);
  const awareNotDiscovered = discoveryMode
    ? aeoEngines.filter((r) => r.discovered === false && r.aware).length
    : 0;
  const totalAiResponses = enginesQueried * AUDIT_PROMPTS_PER_ENGINE;

  // ── Executive verdict: ONE sentence built from the report's real
  // numbers, highlighted phrase in the /ai-visibility marker style. ──────
  const verdict: ReactNode =
    enginesQueried > 0 && notCited > 0 ? (
      discoveryMode && awareNotDiscovered > 0 ? (
        <>
          AI engines know {displaySubject} exists — but{" "}
          {notCited === enginesQueried ? "none of them" : `${enginesQueried - notCited} of ${enginesQueried}`}{" "}
          recommend it when renters ask where to live
          {aeoCity ? ` in ${aeoCity}` : ""}, and what they push instead is{" "}
          <span className="ls-hl px-1">costing you leases.</span>
        </>
      ) : (
        <>
          {notCited} of {enginesQueried} major AI engines skip {displaySubject}{" "}
          when renters ask where to live, and what they recommend instead is{" "}
          <span className="ls-hl px-1">costing you leases.</span>
        </>
      )
    ) : enginesQueried > 0 ? (
      discoveryMode ? (
        <>
          Every major AI engine recommends {displaySubject} to renters
          today, and the {recommendations.length} gaps below decide whether
          that <span className="ls-hl px-1">stays true.</span>
        </>
      ) : (
        <>
          Every major AI engine names {displaySubject} today, and the{" "}
          {recommendations.length} gaps below decide whether that{" "}
          <span className="ls-hl px-1">stays true.</span>
        </>
      )
    ) : (
      <>
        Renters read the public record on {displaySubject} before they ever
        call, and the gaps below are{" "}
        <span className="ls-hl px-1">costing you leases.</span>
      </>
    );

  // Fold instrumentation (2026-08-14): per-engine 3-state minis + the
  // six-pillar bars, both from data the report already carries.
  const foldEngines: FoldEngine[] = aeoEngines.map((r) => ({
    engine: r.engine,
    state:
      r.discovered !== undefined
        ? r.discovered
          ? "recommends"
          : r.aware
            ? "aware"
            : "unknown"
        : r.cited
          ? "cited"
          : "not_cited",
  }));
  const PILLAR_ORDER: Array<{ key: string; label: string }> = [
    { key: "findability", label: "Findability" },
    { key: "reputation", label: "Reputation" },
    { key: "conversion", label: "Conversion" },
    { key: "tracking", label: "Tracking" },
    { key: "accessibility", label: "Accessibility" },
    { key: "listings", label: "Listings" },
  ];
  const foldPillars: FoldPillar[] = dps
    ? PILLAR_ORDER.map(({ key, label }) => ({
        key,
        label,
        score: dps.pillars[key as keyof typeof dps.pillars]?.score ?? 0,
      }))
    : [];

  const foldStats: FoldStat[] = [
    { value: totalAiResponses, label: "live AI answers analyzed" },
    { value: mentions.length, label: "public mentions · past 90 days" },
    { value: recommendations.length, label: "action items, ranked by impact" },
  ].filter((s) => s.value > 0);

  // ── Spine assembly: top-3 recommendations promoted to numbered claims,
  // each paired with the evidence pool its pillar maps to. Pools are
  // consumed at most once; anything left over renders in the appendix. ──
  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  const top3 = [...recommendations]
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 3);

  // Only meaningful when at least one engine actually skipped the brand —
  // when every engine cites it, the "competitors" list is fan-out noise
  // (observed: "Noise", "Broken facilities" on an all-cited audit).
  const competitorNote: ReactNode =
    notCited > 0 && aeoCompetitorsCited.length > 0 ? (
      <>
        When AI skipped you, it named{" "}
        {aeoCompetitorsCited.slice(0, 3).map((name, i, arr) => (
          <span key={name}>
            <span style={{ fontWeight: 600 }}>{name}</span>
            {i < arr.length - 2 ? ", " : i === arr.length - 2 ? " and " : ""}
          </span>
        ))}{" "}
        instead.
      </>
    ) : undefined;

  const aiEvidence: ReactNode =
    enginesQueried > 0 ? (
      <>
        <AeoEngineBreakdown
          rows={aeoEngines}
          competitorsCited={notCited > 0 ? aeoCompetitorsCited : []}
          brandName={displaySubject}
          discoveryRan={aeoDiscoveryRan}
          city={aeoCity}
          competitorsRanked={
            notCited > 0 ? (findings.aeoCompetitorsRanked ?? []) : []
          }
        />
        {aeoReceipts.length > 0 ? (
          <AeoReceiptsBlock
            receipts={aeoReceipts}
            brandName={displaySubject}
            competitors={notCited > 0 ? aeoCompetitorsCited : []}
          />
        ) : null}
        {googleAio ? (
          <GoogleAiOverviewCard findings={googleAio} brandName={displaySubject} />
        ) : null}
      </>
    ) : null;
  const reputationEvidence: ReactNode =
    mentions.length > 0 ? (
      <>
        <SourceBreakdown counts={perSourceCounts} totalMentions={mentions.length} />
        <p className="mt-3 text-[12.5px]" style={{ color: "#6f6f6f" }}>
          All {mentions.length} mentions, with links, are in the full report
          below.
        </p>
      </>
    ) : null;
  const onPageEvidence: ReactNode =
    aeoOnPage || schemaGap || detectedStack ? (
      <>
        {aeoOnPage ? <AeoOnPageCard findings={aeoOnPage} /> : null}
        {schemaGap ? <SchemaGapCard findings={schemaGap} /> : null}
        {detectedStack ? <DetectedStackCard findings={detectedStack} /> : null}
      </>
    ) : null;

  type PoolKey = "ai" | "reputation" | "onpage";
  const pools: Record<PoolKey, { node: ReactNode; label: string }> = {
    ai: { node: aiEvidence, label: "See the evidence · live engine responses" },
    reputation: {
      node: reputationEvidence,
      label: "See the evidence · where mentions come from",
    },
    onpage: {
      node: onPageEvidence,
      label: "See the evidence · your homepage, checked",
    },
  };
  const pillarPool: Record<string, PoolKey> = {
    findability: "ai",
    listings: "ai",
    reputation: "reputation",
    conversion: "onpage",
    tracking: "onpage",
    accessibility: "onpage",
  };
  const used = new Set<PoolKey>();
  const spineItems: SpineItem[] = top3.map((item) => {
    // STRICT pillar → evidence matching. A mismatched pairing ("visitor
    // pixel" claim over AI-engine evidence) reads as a broken report;
    // a claim with no evidence block reads fine. Unclaimed pools render
    // in the appendix instead.
    let pool: PoolKey | null = pillarPool[item.pillar] ?? null;
    if (!pool || used.has(pool) || !pools[pool].node) pool = null;
    if (pool) used.add(pool);
    return {
      id: item.id,
      title: item.title,
      why: item.why,
      note: pool === "ai" ? competitorNote : undefined,
      evidence: pool ? pools[pool].node : undefined,
      evidenceLabel: pool ? pools[pool].label : undefined,
      // /ai-visibility deep-links to #ai-search, /reputation-report to
      // #reputation — anchor lives on the spine item that carries the
      // matching evidence, expanded on load.
      anchorId:
        pool === "ai"
          ? "ai-search"
          : pool === "reputation"
            ? "reputation"
            : undefined,
      defaultOpen: pool === "ai" || pool === "reputation",
    };
  });
  const aiAnchorPlaced = spineItems.some((s) => s.anchorId === "ai-search");
  const repAnchorPlaced = spineItems.some((s) => s.anchorId === "reputation");

  // Shared brief-shell sources — every data provider the pipeline
  // touched, rendered as clickable cards in the appendix. Trust by
  // traceability.
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
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <BriefShellHeader
        subjectName={displaySubject}
        generatedAtIso={audit.createdAt.toISOString()}
        label="Audit"
      />

      {/* ── 1. Verdict fold ─────────────────────────────────────────── */}
      <VerdictFold
        subject={displaySubject}
        generatedAtIso={audit.createdAt.toISOString()}
        score={score}
        highSeverity={highSeverity}
        verdict={verdict}
        stats={foldStats}
        engines={foldEngines}
        pillars={foldPillars}
        secondaryCta={
          audit.email
            ? { href: "#three-things", label: "See the 3 things below" }
            : { href: "#full-report", label: "Unlock the full report" }
        }
      />

      {/* ── 2. The spine: three things costing you leases ───────────── */}
      <ReportSpine items={spineItems} />
      {/* Deep-link safety net: /ai-visibility links to #ai-search. When
          no spine item carried the engine evidence, the appendix's AI
          item is anchored + opened below; this bare anchor only covers
          audits with no engine data at all. */}
      {!aiAnchorPlaced && !aiEvidence ? (
        <span id="ai-search" className="scroll-mt-24" />
      ) : null}
      {/* Same net for /reputation-report → #reputation. */}
      {!repAnchorPlaced && !reputationEvidence ? (
        <span id="reputation" className="scroll-mt-24" />
      ) : null}

      {/* ── 3. Narrative: markdown stripped before it ever renders ──── */}
      {audit.claudeSummary ? (
        <BriefNarrativePanel heading={`Where ${displaySubject} stands today.`}>
          <p>{stripChatbotMarkdown(audit.claudeSummary)}</p>
        </BriefNarrativePanel>
      ) : null}

      <div className="mx-auto max-w-[1080px] px-4 pb-12 md:px-6">
        {/* ── 4. The full report (email-gated, unchanged mechanics) ─── */}
        <section id="full-report" className="mt-12 scroll-mt-24">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
          >
            The full report
          </p>
          <h2
            className="mt-2"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3vw, 34px)",
              fontWeight: 550,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "#161616",
            }}
          >
            Every mention. Every action item.
          </h2>

          <AuditPaywall
            unlocked={!!audit.email}
            auditId={audit.id}
            mentionCount={mentions.length}
            findingCount={recommendations.length}
          >
            <RecommendationsSection
              recommendations={recommendations}
              spineIds={top3.map((t) => t.id)}
            />

            <MentionsSection
              mentions={mentions}
              brandName={displaySubject}
              shareToken={audit.shareToken}
              auditCreatedAtIso={audit.createdAt.toISOString()}
            />

            <section
              className="mt-10 border p-5 sm:p-6"
              style={{ borderColor: "#e0e0e0", borderRadius: 2, backgroundColor: "#FBFBFD" }}
            >
              <p
                className="text-[10px] font-mono uppercase tracking-[0.16em]"
                style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
              >
                Next step
              </p>
              <h3
                className="mt-1 max-w-xl text-lg font-semibold sm:text-xl"
                style={{ color: "#161616" }}
              >
                Want this monitored daily for your whole portfolio?
              </h3>
              <p
                className="mt-1.5 max-w-xl text-[13px] sm:text-sm"
                style={{ color: "#525252" }}
              >
                {BRAND_NAME} runs this report every day for every property,
                watches the deltas, and tells your team what to do about it.
              </p>
              <div className="mt-3">
                <Link
                  href="/onboarding"
                  className="inline-flex h-10 items-center justify-center px-5 text-[13px] font-medium text-white"
                  style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
                >
                  Talk to us
                </Link>
              </div>
            </section>
          </AuditPaywall>
        </section>

        {/* ── 5. Appendix: everything demoted, one accordion ────────── */}
        <section className="mt-16">
          <style>{`
            .apx-det > summary { list-style: none; cursor: pointer; }
            .apx-det > summary::-webkit-details-marker { display: none; }
            .apx-chev { transition: transform .35s cubic-bezier(.2,.8,.2,1); }
            .apx-det[open] .apx-chev { transform: rotate(180deg); }
            @keyframes apx-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            .apx-det[open] .apx-body { animation: apx-in .4s cubic-bezier(.2,.8,.2,1) both; }
            @media (prefers-reduced-motion: reduce) {
              .apx-det[open] .apx-body { animation: none; }
              .apx-chev { transition: none; }
            }
          `}</style>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
          >
            Appendix
          </p>

          {/* Methodology first (2026-08-14): "live API calls, not stock
              copy" is the strongest trust asset in the appendix — it was
              dead last. */}
          <AppendixItem
            label="How this report was built"
            sublabel={`${totalAiResponses > 0 ? `${totalAiResponses} live API calls · ` : ""}every source, traceable`}
          >
            {enginesQueried > 0 ? (
              <AuditTrustStrip
                brandName={displaySubject}
                enginesQueried={enginesQueried}
                reputationSources={7}
                totalMentions={mentions.length}
                totalAiResponses={totalAiResponses}
                auditedAtIso={audit.createdAt.toISOString()}
                auditId={audit.id}
              />
            ) : null}
            <BriefSourcesBlock sources={sources} />
          </AppendixItem>

          {dps ? (
            <AppendixItem label="Full scorecard" sublabel="six pillars, scored">
              <PillarGrid pillars={dps.pillars} />
            </AppendixItem>
          ) : null}

          {!used.has("ai") && aiEvidence ? (
            <AppendixItem
              label="AI search visibility"
              sublabel="per-engine breakdown"
              // Carries the /ai-visibility deep link when the spine
              // didn't claim the engine evidence — open so the anchor
              // lands on visible content.
              id={!aiAnchorPlaced ? "ai-search" : undefined}
              defaultOpen={!aiAnchorPlaced}
            >
              {aiEvidence}
            </AppendixItem>
          ) : null}
          {!used.has("onpage") && onPageEvidence ? (
            <AppendixItem
              label="Homepage health"
              sublabel="on-page, schema, stack"
            >
              {onPageEvidence}
            </AppendixItem>
          ) : null}
          {!used.has("reputation") && reputationEvidence ? (
            <AppendixItem
              label="Reputation scan"
              sublabel="mention sources"
              // Carries the /reputation-report deep link when the spine
              // didn't claim the mention evidence.
              id={!repAnchorPlaced ? "reputation" : undefined}
              defaultOpen={!repAnchorPlaced}
            >
              {reputationEvidence}
            </AppendixItem>
          ) : null}

        </section>

        <BookCallCta
          subtitle={
            highSeverity > 0
              ? `${highSeverity} high-priority gap${highSeverity === 1 ? "" : "s"} identified. We can close most of them in 30 days.`
              : undefined
          }
        />
      </div>

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
// AppendixItem — one hairline-ruled accordion row. Mono summary label,
// chevron rotates open, body fades up.
// ---------------------------------------------------------------------------
function AppendixItem({
  label,
  sublabel,
  id,
  defaultOpen,
  children,
}: {
  label: string;
  sublabel?: string;
  id?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="apx-det mt-3 scroll-mt-24"
      id={id}
      open={defaultOpen}
      style={{ borderTop: "1px solid #e0e0e0" }}
    >
      <summary className="flex items-baseline justify-between gap-3 py-4">
        <span className="inline-flex items-center gap-2.5">
          <ChevronDown
            className="apx-chev h-4 w-4"
            style={{ color: "#0f62fe" }}
            aria-hidden
          />
          <span
            className="text-[14.5px] font-semibold"
            style={{ color: "#161616" }}
          >
            {label}
          </span>
        </span>
        {sublabel ? (
          <span
            className="hidden text-[11px] font-mono sm:inline"
            style={{ color: "#6f6f6f", fontFamily: "var(--font-mono)" }}
          >
            {sublabel}
          </span>
        ) : null}
      </summary>
      <div className="apx-body pb-6">{children}</div>
    </details>
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
// scan. Now lives inside the spine's reputation evidence (or the
// appendix when the spine didn't claim it).
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
                // AA: zero-count chips were #9CA3AF at 0.85 opacity —
                // 2.12:1 once the accordion default-opened (axe, 2026-08-13).
                color: has ? "#1E2A3A" : "#5f6b7c",
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 500,
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
                style={{ color: has ? "#6B7280" : "#5f6b7c" }}
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
