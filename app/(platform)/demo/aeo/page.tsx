import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, Calendar, Database, Zap } from "lucide-react";
import { SplitHero } from "@/components/platform/split-hero";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import { Reveal } from "@/components/platform/reveal";
import { SectionEyebrow } from "@/components/platform/section-eyebrow";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { AeoEngineCards } from "@/app/portal/seo/aeo/aeo-engine-cards";
import { ShareOfVoiceCard } from "@/components/portal/aeo/share-of-voice-card";
import { OpportunityScoreCard } from "@/components/portal/aeo/opportunity-score-card";
import { AiOverviewCard } from "@/components/portal/aeo/ai-overview-card";
import { OnPageAuditCard } from "@/components/portal/aeo/onpage-audit-card";
import type { AeoEngine } from "@prisma/client";

// ---------------------------------------------------------------------------
// /demo/aeo — public, unauthed live preview of the AI Search Visibility
// surface ("AEO"). Reuses the EXACT widgets from /portal/seo/aeo so
// prospects see the actual product, just powered by seeded
// Telegraph-Commons-style data instead of their own tenant.
//
// Demo-data philosophy: realistic numbers that tell the *gap* story —
// "you're being named in ~40% of AI answers but cited only ~15% of the
// time, and your top competitor is winning 12 of the answers where
// you're not." That's the conversation we want every prospect to want
// to have, mirrored from real client data we've collected.
//
// All numbers below are seeded constants. No DB read. No auth. No fetch.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "AI Search Visibility — live demo",
  description:
    "Watch ChatGPT, Perplexity, Claude, and Gemini answer real renter questions about a sample portfolio. See exactly what LeaseStack measures, scores, and acts on every week.",
};

// ─── Demo data ─────────────────────────────────────────────────────────────

const SCAN_TS = "2026-05-30T08:12:00.000Z";

const ENGINE_CARDS = [
  {
    engine: "CHATGPT" as AeoEngine,
    configured: true,
    mentionRate: 0.48,
    mentioned: 19,
    citationRate: 0.2,
    cited: 8,
    total: 40,
    lastScan: new Date(SCAN_TS),
    sparkline7d: [0.18, 0.22, 0.32, 0.36, 0.41, 0.46, 0.48],
  },
  {
    engine: "PERPLEXITY" as AeoEngine,
    configured: true,
    mentionRate: 0.55,
    mentioned: 22,
    citationRate: 0.28,
    cited: 11,
    total: 40,
    lastScan: new Date(SCAN_TS),
    sparkline7d: [0.32, 0.34, 0.38, 0.4, 0.46, 0.5, 0.55],
  },
  {
    engine: "CLAUDE" as AeoEngine,
    configured: true,
    mentionRate: 0.4,
    mentioned: 16,
    citationRate: 0.12,
    cited: 5,
    total: 40,
    lastScan: new Date(SCAN_TS),
    sparkline7d: [0.15, 0.2, 0.24, 0.26, 0.3, 0.36, 0.4],
  },
  {
    engine: "GEMINI" as AeoEngine,
    configured: true,
    mentionRate: 0.3,
    mentioned: 12,
    citationRate: 0.08,
    cited: 3,
    total: 40,
    lastScan: new Date(SCAN_TS),
    sparkline7d: [0.1, 0.12, 0.18, 0.2, 0.22, 0.26, 0.3],
  },
];

const TOTAL_RESPONSES = 160;
const TOTAL_MENTIONED = 69;
const TOTAL_CITED = 27;
const COMPETITORS_NAMED = 14;
const VISIBILITY_SCORE = 64;

const SOV = {
  perEngine: [
    { engine: "PERPLEXITY" as AeoEngine, avgSov: 0.34, snapshotCount: 40 },
    { engine: "CHATGPT" as AeoEngine, avgSov: 0.29, snapshotCount: 40 },
    { engine: "CLAUDE" as AeoEngine, avgSov: 0.22, snapshotCount: 40 },
    { engine: "GEMINI" as AeoEngine, avgSov: 0.15, snapshotCount: 40 },
  ],
  topEntities: [
    { name: "Park & Pearl", kind: "self" as const, count: 38 },
    { name: "The Madison", kind: "competitor" as const, count: 31 },
    { name: "Westbrook Commons", kind: "self" as const, count: 24 },
    { name: "The Asher", kind: "competitor" as const, count: 22 },
    { name: "Sage at Greenpoint", kind: "self" as const, count: 19 },
    { name: "Berkley Central", kind: "competitor" as const, count: 17 },
    { name: "The Rhodes", kind: "self" as const, count: 16 },
    { name: "The Oxford", kind: "competitor" as const, count: 14 },
  ],
  totalSnapshots: 160,
  engineSource: "dataforseo" as const,
};

const OPPORTUNITY_ROWS = [
  {
    keyword: "best luxury apartments in Greenpoint Brooklyn",
    score: 84,
    gscClicks28d: 142,
    gscImpressions28d: 4820,
    aiSearchVolume: 2400,
    yourMentionCount: 6,
    competitorMentionCount: 14,
    breakdown: {
      aiVolumeBand: 0.88,
      mentionGap: 0.7,
      gscPotential: 0.72,
      competitorPresence: 0.95,
      onPageHealth: 0.5,
    },
  },
  {
    keyword: "pet friendly apartments Berkeley",
    score: 78,
    gscClicks28d: 96,
    gscImpressions28d: 3210,
    aiSearchVolume: 1900,
    yourMentionCount: 4,
    competitorMentionCount: 11,
    breakdown: {
      aiVolumeBand: 0.82,
      mentionGap: 0.73,
      gscPotential: 0.66,
      competitorPresence: 0.88,
      onPageHealth: 0.62,
    },
  },
  {
    keyword: "student housing near UC Berkeley furnished",
    score: 72,
    gscClicks28d: 211,
    gscImpressions28d: 6140,
    aiSearchVolume: 1600,
    yourMentionCount: 9,
    competitorMentionCount: 12,
    breakdown: {
      aiVolumeBand: 0.74,
      mentionGap: 0.57,
      gscPotential: 0.81,
      competitorPresence: 0.85,
      onPageHealth: 0.68,
    },
  },
  {
    keyword: "2 bedroom apartment Williamsburg with rooftop",
    score: 69,
    gscClicks28d: 74,
    gscImpressions28d: 2980,
    aiSearchVolume: 1300,
    yourMentionCount: 3,
    competitorMentionCount: 9,
    breakdown: {
      aiVolumeBand: 0.7,
      mentionGap: 0.75,
      gscPotential: 0.6,
      competitorPresence: 0.8,
      onPageHealth: 0.55,
    },
  },
  {
    keyword: "modern apartments north Brooklyn under 4000",
    score: 64,
    gscClicks28d: 58,
    gscImpressions28d: 2210,
    aiSearchVolume: 900,
    yourMentionCount: 4,
    competitorMentionCount: 7,
    breakdown: {
      aiVolumeBand: 0.62,
      mentionGap: 0.64,
      gscPotential: 0.58,
      competitorPresence: 0.7,
      onPageHealth: 0.65,
    },
  },
  {
    keyword: "newly built apartments East Bay",
    score: 58,
    gscClicks28d: 41,
    gscImpressions28d: 1740,
    aiSearchVolume: 720,
    yourMentionCount: 5,
    competitorMentionCount: 6,
    breakdown: {
      aiVolumeBand: 0.56,
      mentionGap: 0.55,
      gscPotential: 0.5,
      competitorPresence: 0.65,
      onPageHealth: 0.7,
    },
  },
  {
    keyword: "long term furnished rentals Berkeley",
    score: 54,
    gscClicks28d: 36,
    gscImpressions28d: 1560,
    aiSearchVolume: 640,
    yourMentionCount: 6,
    competitorMentionCount: 6,
    breakdown: {
      aiVolumeBand: 0.5,
      mentionGap: 0.5,
      gscPotential: 0.5,
      competitorPresence: 0.6,
      onPageHealth: 0.72,
    },
  },
  {
    keyword: "best apartments near downtown Brooklyn",
    score: 51,
    gscClicks28d: 28,
    gscImpressions28d: 1240,
    aiSearchVolume: 580,
    yourMentionCount: 4,
    competitorMentionCount: 5,
    breakdown: {
      aiVolumeBand: 0.48,
      mentionGap: 0.55,
      gscPotential: 0.46,
      competitorPresence: 0.55,
      onPageHealth: 0.68,
    },
  },
];

const AI_OVERVIEW_ROWS = [
  {
    query: "best luxury apartments in Greenpoint Brooklyn",
    summary:
      "Greenpoint offers several highly-rated luxury rentals along the East River waterfront. Top picks include The Madison (riverfront views, full-floor amenity deck), Park & Pearl (newer construction, pet spa, work-from-home suites), and The Rhodes (renovated lofts with private terraces). All three feature concierge service and proximity to G-train transit.",
    citedUrls: [
      "https://themadison.com/about",
      "https://parkandpearl.com/amenities",
      "https://therhodes.com/floor-plans",
    ],
    cited: true,
    capturedAt: "2026-05-28T14:10:00.000Z",
  },
  {
    query: "pet friendly apartments Berkeley",
    summary:
      "Berkeley has a strong selection of pet-welcoming apartment communities. Berkley Central and The Asher both allow dogs and cats with no weight limit and include on-site pet relief areas. The Oxford offers a dedicated dog wash station. Most properties charge a one-time pet fee plus monthly pet rent.",
    citedUrls: [
      "https://berkleycentral.com/pet-policy",
      "https://theasher.com/amenities",
    ],
    cited: false,
    capturedAt: "2026-05-27T11:42:00.000Z",
  },
  {
    query: "student housing near UC Berkeley furnished",
    summary:
      "Several furnished options serve UC Berkeley students within a 10-minute walk of campus. Sage at Greenpoint provides fully furnished units with utilities included. The Asher offers per-bedroom leases popular with international students. Berkley Central includes a study lounge and 24/7 package room.",
    citedUrls: [
      "https://sageatgreenpoint.com/student-housing",
      "https://theasher.com/leasing",
    ],
    cited: true,
    capturedAt: "2026-05-26T09:18:00.000Z",
  },
  {
    query: "2 bedroom apartment Williamsburg with rooftop",
    summary:
      "Williamsburg's newer luxury buildings typically feature rooftop amenities. The Madison's two-bedroom layouts start in the mid-$5,000s and include access to a 23rd-floor terrace with grills. The Oxford offers a similar tier with a pool. Both buildings are within walking distance of the Bedford Avenue L stop.",
    citedUrls: [
      "https://themadison.com/two-bedroom",
      "https://theoxford.com/rooftop",
    ],
    cited: false,
    capturedAt: "2026-05-25T16:30:00.000Z",
  },
  {
    query: "modern apartments north Brooklyn under 4000",
    summary:
      "North Brooklyn has growing inventory in the $3,200–$3,900 range. Look at Park & Pearl studios (from $3,250), Westbrook Commons one-bedrooms (from $3,550), and Berkley Central junior one-bedrooms (from $3,400). All three offer in-unit laundry and modern finishes.",
    citedUrls: [
      "https://parkandpearl.com/studios",
      "https://westbrookcommons.com/floor-plans",
      "https://berkleycentral.com/units",
    ],
    cited: true,
    capturedAt: "2026-05-24T13:55:00.000Z",
  },
];

const ONPAGE_DEMO = {
  hasAddon: true,
  defaultUrl: "https://parkandpearl.com",
  latest: {
    url: "https://parkandpearl.com/amenities",
    score: 87,
    excerpt:
      "Park & Pearl Amenities — A full-floor amenity deck with co-working suites, fitness center, pet spa, and rooftop lounge. Walk to G-train transit.",
    capturedAt: "2026-05-30T08:12:00.000Z",
    checks: [
      {
        key: "faq-schema",
        label: "FAQPage JSON-LD",
        pass: true,
        reason: "Structured FAQ block detected — 6 Q&A entries marked up.",
      },
      {
        key: "org-schema",
        label: "Organization JSON-LD",
        pass: true,
        reason: "ApartmentComplex schema present with name + address.",
      },
      {
        key: "article-schema",
        label: "Article JSON-LD",
        pass: false,
        reason: "No Article markup — add one for editorial-style pages.",
      },
      {
        key: "canonical",
        label: "Canonical URL",
        pass: true,
        reason: "Self-canonical — engines won't dedupe to a wrong URL.",
      },
      {
        key: "meta-description",
        label: "Meta description (50-300 chars)",
        pass: true,
        reason: "171 chars — within the AI quote-target range.",
      },
      {
        key: "content-depth",
        label: "Content depth (≥800 words)",
        pass: true,
        reason: "1,240 visible words — strong quotable surface area.",
      },
      {
        key: "qa-structure",
        label: "Q&A structure (questions in H2/H3)",
        pass: true,
        reason: "4 question-form headings detected — AI engines love these.",
      },
      {
        key: "freshness",
        label: "Freshness (date < 1 year)",
        pass: false,
        reason: "Last updated date is missing — add dateModified.",
      },
    ],
  },
  history: [
    {
      id: "1",
      url: "https://parkandpearl.com/amenities",
      score: 87,
      capturedAt: "2026-05-30T08:12:00.000Z",
    },
    {
      id: "2",
      url: "https://parkandpearl.com/floor-plans",
      score: 72,
      capturedAt: "2026-05-23T08:12:00.000Z",
    },
    {
      id: "3",
      url: "https://parkandpearl.com/about",
      score: 64,
      capturedAt: "2026-05-16T08:12:00.000Z",
    },
    {
      id: "4",
      url: "https://sageatgreenpoint.com/student-housing",
      score: 81,
      capturedAt: "2026-05-09T08:12:00.000Z",
    },
  ],
};

const COMPETITOR_ROLLUP = [
  { name: "The Madison", count: 12 },
  { name: "The Asher", count: 9 },
  { name: "Berkley Central", count: 7 },
  { name: "The Oxford", count: 6 },
  { name: "Riverline Lofts", count: 5 },
  { name: "Hudson Yards East", count: 4 },
  { name: "1100 Greenpoint", count: 4 },
  { name: "The Greenpoint", count: 3 },
  { name: "Eastline Tower", count: 3 },
  { name: "The Brooklyner", count: 2 },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DemoAeoPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Product demo · AI Search Visibility"
        headline="See your buildings the way"
        headlineAccent="ChatGPT, Perplexity, Claude, and Gemini do."
        subhead="Every Monday morning, LeaseStack asks the same questions your prospects type into AI search — and shows you who got named, who got cited, and which competitor won the answer instead. This is the real dashboard, powered by a sample portfolio."
        ctas={[
          { label: "Run this on my portfolio", href: "/onboarding" },
          { label: "Talk to us", href: "/onboarding", variant: "secondary" },
        ]}
        caption="Updated weekly · 4 engines · per-property + per-keyword scoring"
        artifact={
          <SoftFramedArtifact tone="lavender" padding="md" pillLabel="Example data" bare>
            <PreviewCard />
          </SoftFramedArtifact>
        }
      />

      <SampleNotice />

      <DemoDashboard />

      <AeoBoostBand />

      <BackgroundBand />

      <FinalCta />
    </div>
  );
}

// ─── Hero artifact: a compact preview tile of the score + engines ─────────

function PreviewCard() {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 2,
        boxShadow:
          "0 0 0 1px #e0e0e0",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#6f6f6f",
            fontWeight: 600,
          }}
        >
          AI Visibility Score
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#0f62fe",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Last scan · 2 days ago
        </span>
      </div>
      <div className="px-6 py-6 flex items-baseline gap-3">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1,
            color: "#161616",
            letterSpacing: "-0.02em",
          }}
        >
          {VISIBILITY_SCORE}
        </span>
        <span
          style={{
            fontSize: 18,
            color: "#8d8d8d",
            fontFamily: "var(--font-display)",
          }}
        >
          / 100
        </span>
      </div>
      <div className="px-6 pb-5">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 2,
                backgroundColor: i < 6 ? "#0f62fe" : "#e0e0e0",
              }}
            />
          ))}
        </div>
        <p
          className="mt-3"
          style={{
            fontSize: 12.5,
            color: "#6f6f6f",
            lineHeight: 1.5,
          }}
        >
          You are regularly named, with room to be cited more. Strong moat on
          branded queries; growth gap on discovery prompts.
        </p>
      </div>
      <div
        style={{ borderTop: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
        className="px-5 py-3 grid grid-cols-4 gap-3"
      >
        {[
          { mark: <ChatGPTMark size={16} />, rate: "48%" },
          { mark: <PerplexityMark size={16} />, rate: "55%" },
          { mark: <ClaudeMark size={16} />, rate: "40%" },
          { mark: <GeminiMark size={16} />, rate: "30%" },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-1.5">
            {row.mark}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "#161616",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {row.rate}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sample notice strip ──────────────────────────────────────────────────

function SampleNotice() {
  return (
    <section
      style={{ backgroundColor: "#f4f4f4", borderTop: "1px solid #e0e0e0", borderBottom: "1px solid #e0e0e0" }}
    >
      <div className="max-w-[1180px] mx-auto px-4 md:px-10 py-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#0f62fe" }} />
          <p style={{ fontSize: 13.5, color: "#161616", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>This is the real product.</span>{" "}
            Same widgets your team uses inside LeaseStack, populated with a
            sample portfolio (4 properties · 4 engines · 160 weekly AI
            responses). Your live dashboard fills in within 24 hours of
            connecting your sites.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="btn-primary shrink-0 inline-flex items-center gap-1.5"
          style={{ fontSize: 13, padding: "8px 14px" }}
        >
          Get my live dashboard
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}

// ─── The dashboard itself ────────────────────────────────────────────────

function DemoDashboard() {
  return (
    <section className="bg-white">
      <div className="max-w-[1180px] mx-auto px-4 md:px-10 py-12 md:py-16">
        <PageHeader
          eyebrow="AI ENGINE OPTIMIZATION · EXAMPLE DATA"
          title="AI search visibility"
          description="When prospective renters ask ChatGPT, Perplexity, Claude, or Gemini for apartment recommendations in your market, do they get your property? Scans run automatically every Monday."
          meta="last scan 2 days ago"
        />

        <div className="space-y-6">
          {/* Visibility Score hero */}
          <Annotation copy="The headline. A weighted blend of branded mention rate (45 pts), overall mention rate (30), citation rate (20), and a position bonus (5). Reads as 'are you in the AI conversation at all?'">
            <VisibilityScoreHero />
          </Annotation>

          {/* 3-up KPI strip */}
          <Annotation copy="The three numbers that actually matter under the hood: how often you got named, how often the engine linked your URL, and how many *different* competing buildings the AI surfaced instead.">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MicroStat
                label="Mention rate (30d)"
                value={fmtPct(TOTAL_MENTIONED / TOTAL_RESPONSES)}
                hint={`${TOTAL_MENTIONED} of ${TOTAL_RESPONSES} AI responses named you`}
              />
              <MicroStat
                label="Citation rate (30d)"
                value={fmtPct(TOTAL_CITED / TOTAL_RESPONSES)}
                hint={`${TOTAL_CITED} of ${TOTAL_RESPONSES} responses linked your URL`}
              />
              <MicroStat
                label="Competitors named (30d)"
                value={String(COMPETITORS_NAMED)}
                hint="Unique buildings the AI named instead of you"
              />
            </div>
          </Annotation>

          {/* Per-engine cards */}
          <Annotation copy="One card per engine — mention rate, citation rate, and a 7-day sparkline. The split tells you whether the AI knows who you are (mention) vs whether it sends prospects to your site (citation).">
            <AeoEngineCards rows={ENGINE_CARDS} />
          </Annotation>

          {/* Share of Voice */}
          <Annotation copy="Which buildings own the airwaves. Per-engine share of voice plus the top entities AI engines named in the last 30 days — yours in bold, competitors named alongside.">
            <ShareOfVoiceCard {...SOV} />
          </Annotation>

          {/* Opportunity Score */}
          <Annotation copy="Top keywords ranked by the gap between AI demand and your AI presence. Five inputs: AI volume (30), mention gap (25), GSC potential (20), competitor density (15), on-page health (10). Click any row to draft a counter page.">
            <OpportunityScoreCard
              rows={OPPORTUNITY_ROWS}
              engineSource="dataforseo"
            />
          </Annotation>

          {/* AI Overview */}
          <Annotation copy="What Google's AI Overview is literally saying for your top-ranked queries. Two of these five cite a property in this portfolio — three don't. That's the work.">
            <AiOverviewCard
              rows={AI_OVERVIEW_ROWS}
              engineSource="dataforseo"
            />
          </Annotation>

          {/* On-page Audit (AEO Boost) */}
          <Annotation copy="AEO Boost add-on. 8-check scorecard for FAQ schema, JSON-LD, canonical, content depth, Q&A structure, freshness — run on any URL. Daily refresh vs the weekly default.">
            <OnPageAuditCard
              hasAddon={ONPAGE_DEMO.hasAddon}
              defaultUrl={ONPAGE_DEMO.defaultUrl}
              latest={ONPAGE_DEMO.latest}
              history={ONPAGE_DEMO.history}
            />
          </Annotation>

          {/* Competitors rollup */}
          <Annotation copy="The buildings the AI surfaced when your properties weren't. Each row deep-links into the Content Drafter pre-filled with that competitor's name so your team can ship a comparison page.">
            <SectionCard
              label="Competitors cited"
              description="Buildings the AI surfaced when your properties weren't (last 30 days). Click any row to draft a counter-page."
            >
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                {COMPETITOR_ROLLUP.map(({ name, count }) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 text-[13px] border-b border-[var(--hair)] last:border-b-0 py-1.5"
                  >
                    <span className="truncate text-foreground" title={name}>
                      {name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {count}×
                      </span>
                      <span className="text-[11px] font-medium" style={{ color: "#0f62fe" }}>
                        Counter →
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </Annotation>
        </div>
      </div>
    </section>
  );
}

// ─── Visibility Score hero (rebuilt for the demo page) ───────────────────

function VisibilityScoreHero() {
  const segments = 10;
  const filled = Math.round((VISIBILITY_SCORE / 100) * segments);
  return (
    <div className="ls-card p-5 md:p-6 flex flex-col md:flex-row gap-5 md:items-center">
      <div className="flex items-baseline gap-3 md:min-w-[200px]">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          AI Visibility Score
        </div>
        <div className="text-5xl font-semibold tabular-nums tracking-tight text-foreground leading-none">
          {VISIBILITY_SCORE}
          <span className="text-xl text-muted-foreground"> / 100</span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-1">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className={
                "flex-1 h-1.5 rounded-sm " +
                (i < filled ? "bg-primary" : "bg-muted")
              }
            />
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">
          Strong — you are regularly named, with growth room on discovery
          prompts.
          <span className="text-muted-foreground/70">
            {" "}
            · Based on {TOTAL_RESPONSES} AI responses (last 30 days)
          </span>
        </p>
      </div>
    </div>
  );
}

function MicroStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="ls-card p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground mt-1.5 leading-none">
        {value}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>
    </div>
  );
}

// ─── Annotation wrapper ──────────────────────────────────────────────────

function Annotation({
  copy,
  children,
}: {
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <div className="space-y-2.5">
        <div className="flex items-start gap-2">
          <div
            aria-hidden
            style={{
              width: 3,
              borderRadius: 2,
              backgroundColor: "#0f62fe",
              alignSelf: "stretch",
              marginTop: 4,
              marginBottom: 4,
              flexShrink: 0,
            }}
          />
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "#525252",
              fontFamily: "var(--font-sans)",
              maxWidth: 760,
              paddingLeft: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#0f62fe",
                fontWeight: 600,
                marginRight: 8,
              }}
            >
              What you&apos;re seeing
            </span>
            {copy}
          </p>
        </div>
        {children}
      </div>
    </Reveal>
  );
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

// ─── AEO Boost showcase band ─────────────────────────────────────────────

function AeoBoostBand() {
  const features: Array<{ title: string; body: string }> = [
    {
      title: "Daily scans across all four engines",
      body: "Standard plans scan every Monday. AEO Boost runs daily so a content release in the morning is measurable by Tuesday.",
    },
    {
      title: "On-page AEO audits on any URL",
      body: "Eight signals AI engines reward: FAQPage JSON-LD, Organization schema, Article schema, canonical, meta description, content depth, Q&A structure, freshness. Each check scored, each fix actionable.",
    },
    {
      title: "Content Drafter routing for every gap",
      body: "When a recommendation fires — 'engines name you but don't link' or 'competitor X beats you 12×' — one click drafts the counter page or FAQ block. We stage the change, you ship.",
    },
    {
      title: "Per-prompt citation history",
      body: "Every single prompt and every engine's full response, archived. Search by keyword or competitor. Quote it in your asset review.",
    },
  ];
  return (
    <section
      style={{
        backgroundColor: "#f4f4f4",
        borderTop: "1px solid #e0e0e0",
        borderBottom: "1px solid #e0e0e0",
      }}
    >
      <div className="max-w-[1180px] mx-auto px-4 md:px-10 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-5">
            <SectionEyebrow>AEO BOOST · $199 / MONTH</SectionEyebrow>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 400,
                letterSpacing: "-0.025em",
                lineHeight: 1.08,
                color: "#161616",
              }}
            >
              The managed AI search add-on.
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.6,
                color: "#525252",
                maxWidth: 480,
              }}
            >
              Everything above is your standard surface. AEO Boost is the
              add-on for portfolios that want LeaseStack actively closing
              the AI gap every week — daily scans, on-page audits, and
              content drafted for every recommendation the scanner fires.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/onboarding" className="btn-primary">
                Add AEO Boost
              </Link>
              <Link href="/pricing" className="btn-secondary">
                See pricing
              </Link>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "#8d8d8d",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
                paddingTop: 14,
              }}
            >
              Activates inside the in-product billing portal. Cancel any time.
            </p>
          </div>
          <div className="lg:col-span-7">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((f) => (
                <li
                  key={f.title}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #e0e0e0",
                    borderRadius: 2,
                    padding: 18,
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 15.5,
                      fontWeight: 600,
                      color: "#161616",
                      letterSpacing: "-0.01em",
                      lineHeight: 1.3,
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "#6f6f6f",
                      marginTop: 8,
                    }}
                  >
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── "What runs in the background" trust band ─────────────────────────────

function BackgroundBand() {
  const tiles: Array<{
    icon: React.ReactNode;
    label: string;
    title: string;
    body: string;
  }> = [
    {
      icon: <Calendar className="w-4 h-4" style={{ color: "#0f62fe" }} />,
      label: "Weekly cron · Mondays 02:00 UTC",
      title: "Your visibility is never stale.",
      body:
        "Every Monday morning we sample 5 prompts × 4 engines × every marketable property. AEO Boost runs the same loop daily.",
    },
    {
      icon: <Database className="w-4 h-4" style={{ color: "#0f62fe" }} />,
      label: "DataForSEO",
      title: "10 search-intelligence APIs, billed in one place.",
      body:
        "LLM Responses, AI Overview capture, AI keyword volume, SERP, on-page Lighthouse, backlinks, keyword suggestions. We absorb the cost; you see the answers.",
    },
    {
      icon: <Zap className="w-4 h-4" style={{ color: "#0f62fe" }} />,
      label: "Per-prompt logging",
      title: "Every AI answer, archived.",
      body:
        "Full transcript per prompt per engine, with the cited URL and the competitor names extracted. Search any keyword across 90 days of history.",
    },
  ];
  return (
    <section className="bg-white">
      <div className="max-w-[1180px] mx-auto px-4 md:px-10 py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <SectionEyebrow>WHAT RUNS IN THE BACKGROUND</SectionEyebrow>
          <h2
            className="mt-4"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 4vw, 38px)",
              fontWeight: 400,
              letterSpacing: "-0.022em",
              lineHeight: 1.1,
              color: "#161616",
            }}
          >
            The plumbing that makes the dashboard honest.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <div
              key={t.title}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #e0e0e0",
                borderRadius: 2,
                padding: 22,
                boxShadow: "0 1px 2px rgba(22, 22, 22, 0.03)",
              }}
            >
              <div className="flex items-center gap-2">
                {t.icon}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#0f62fe",
                    fontWeight: 600,
                  }}
                >
                  {t.label}
                </span>
              </div>
              <h3
                className="mt-3"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#161616",
                  letterSpacing: "-0.012em",
                  lineHeight: 1.3,
                }}
              >
                {t.title}
              </h3>
              <p
                className="mt-2"
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: "#6f6f6f",
                }}
              >
                {t.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #e0e0e0" }}>
      <div className="max-w-[1180px] mx-auto px-4 md:px-10 py-16 md:py-24">
        <div
          style={{
            backgroundColor: "#f4f4f4",
            border: "1px solid #e0e0e0",
            borderRadius: 2,
            padding: "56px 32px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 280,
              height: 4,
              background: "linear-gradient(90deg, transparent, #0f62fe, transparent)",
              opacity: 0.6,
            }}
          />
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4.5vw, 46px)",
              fontWeight: 400,
              letterSpacing: "-0.028em",
              lineHeight: 1.08,
              color: "#161616",
              maxWidth: 820,
              margin: "0 auto",
            }}
          >
            Want this live for your portfolio?
          </h2>
          <p
            className="mt-5"
            style={{
              fontSize: 16.5,
              lineHeight: 1.6,
              color: "#6f6f6f",
              maxWidth: 600,
              margin: "20px auto 0",
            }}
          >
            We&apos;ll connect your properties, run the first AI scan tonight, and
            send the first weekly report at 7am Monday. No commitment, cancel
            anytime.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/onboarding" className="btn-primary inline-flex items-center justify-center gap-2">
              Start free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="btn-secondary">
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
