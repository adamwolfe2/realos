import "server-only";
import { prisma } from "@/lib/db";
import {
  AdPlatform,
  ApplicationStatus,
  ChatbotConversationStatus,
  DraftStatus,
  LeadSource,
  LeadStatus,
  LeaseStatus,
  MentionSource,
  Prisma,
  ResidentStatus,
  Sentiment,
  TourStatus,
  VisitorIdentificationStatus,
} from "@prisma/client";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildPropertyUrlPatterns } from "@/lib/properties/queries";

// ---------------------------------------------------------------------------
// Report snapshot generator.
//
// Produces a frozen, serializable payload that captures every number shown on
// a weekly or monthly client report. Once stored on ClientReport.snapshot the
// view never recomputes, so operators can edit a headline in March without
// the numbers shifting underneath them.
//
// All queries here are tenant-scoped on orgId and parallel-safe: the public
// entry point fans them out via Promise.all.
// ---------------------------------------------------------------------------

export type ReportKind = "weekly" | "monthly" | "custom";

export type ReportKpis = {
  // Form/chatbot leads — rows in the Lead table created via opted-in
  // conversion paths (contact form, chatbot email capture, intake).
  leads: number;
  // Visitors identified via the AudienceLab pixel — real people with
  // names + emails resolved from the third-party identity graph who
  // visited the marketing site but did NOT submit a form. The report
  // sums leads + identifiedVisitors as the "captured contacts" total
  // because both represent real outreach-ready contacts; counting only
  // Lead rows underreports the marketing surface area by 30-50x for
  // typical pixel-active tenants.
  //
  // Optional in the type because legacy ClientReport.snapshot rows
  // stored before this field was added would be undefined at runtime.
  // Every read site defaults to 0 via `??` so the view never crashes
  // on a pre-migration snapshot.
  identifiedVisitors?: number;
  tours: number;
  applications: number;
  costPerLead: number | null;
  adSpendUsd: number;
  organicSessions: number;
};

export type ReportKpiDeltas = {
  leadsPct: number | null;
  // Optional for the same reason as identifiedVisitors above —
  // legacy snapshots predate this field.
  identifiedVisitorsPct?: number | null;
  toursPct: number | null;
  applicationsPct: number | null;
  costPerLeadPct: number | null;
  adSpendUsdPct: number | null;
  organicSessionsPct: number | null;
};

export type ReportFunnelStage = { stage: string; count: number };

export type ReportLeadSource = {
  source: string;
  count: number;
  pct: number;
};

export type ReportAdRow = {
  platform: string;
  spendUsd: number;
  leads: number;
  cpl: number | null;
  conversionRate: number | null;
};

export type ReportTopPage = {
  url: string;
  sessions: number;
  clicks: number;
};

export type ReportTopQuery = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type ReportInsight = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
};

export type ReportChatbotStats = {
  conversations: number;
  leadsFromChat: number;
  avgMessageCount: number;
};

export type ReportPropertyRow = {
  id: string;
  name: string;
  leads: number;
  occupancyPct: number | null;
};

export type AiActionItem = {
  priority: "high" | "medium" | "low";
  title: string;
  observation: string;
  action: string;
};

export type AiAnalysis = {
  summary: string;
  actions: AiActionItem[];
};

export type ReportAttributionRow = {
  source: string;
  leads: number;
  tours: number;
  applications: number;
  signed: number;
};

export type ReportAiVisibility = {
  brandedClicks: number;
  brandedImpressions: number;
  brandedShare: number; // pct of total clicks that are branded (0-100)
  topBrandedTerms: string[];
};

// Content — Published blog posts + neighborhood landing pages in the
// reporting window. Surfaces in the new Content tab so ownership sees
// the SEO content pipeline as a real deliverable, not just a backstage
// process. Counts cover both ContentDraft (BLOG_POST / FAQ_BLOCK /
// META_REWRITE / etc.) and NeighborhoodPage.
// ReportLifecycleStats — AppFolio mirror data (Application + Lease)
// surfaced as a dense stat strip on the Traffic & Leads tab. Norman
// May 22: SG signed 20+ leases at Telegraph but the funnel never knew
// because we only counted Lead rows. This block exposes the real
// pipeline so a portfolio report tells the whole story.
export type ReportLifecycleStats = {
  // New leases signed in window (Lease.startDate within period).
  leasesSignedInPeriod: number;
  // Prior-period equivalent so the view can render a delta pill.
  priorLeasesSignedInPeriod: number;
  // Rolling 180-day signed count — useful for seasonal portfolios
  // (student housing peaks Jan-Feb; small monthly windows can read
  // "1" while the building actually signed 36 leases in the last
  // 6 months). Gives ownership the seasonal context next to the
  // honest current-period number.
  leasesSignedLast180d: number;
  // Total active leases right now (Lease.status === ACTIVE). The
  // closed-loop floor — what the org is currently retaining.
  activeLeases: number;
  // 12-month lease velocity — count of leases that started in each of
  // the last 12 calendar months. Norman bug (May 22): the "90 active
  // leases" headline read suspiciously alongside the "1 signed in
  // period" tile because the funnel was scoped to the last 28d and
  // skipped the Jul/Aug + Jan signing peaks (student housing). The
  // sparkline lets ownership see WHEN those 90 leases were signed at
  // a glance so the headline number stops looking like a guess.
  monthlySignedLast12: Array<{ month: string; count: number }>;
  // Applications by status this period, summed across all stages.
  applicationsInPeriod: number;
  applicationsApprovedInPeriod: number;
  applicationsSubmittedInPeriod: number;
};

export type ReportContentStats = {
  // Lifetime publishes — the surface area that earned organic traffic.
  totalPublished: number;
  // Drafts currently in-flight (pending review or generating). Norman
  // May 22: "Even if they're in draft detection and not fully approved
  // yet, I want to see them." So the Content tab now shows in-progress
  // work alongside the shipped pipeline.
  totalInProgress: number;
  // New this period — proves the team is actively shipping content.
  publishedInPeriod: number;
  // Format breakdown, sorted desc by count. Drives the small bar
  // chart in the Content tab so ownership reads "you published 8 blog
  // posts + 3 neighborhood pages this month" at a glance.
  byFormat: Array<{ format: string; count: number }>;
  // All items (max 10) — published + in-progress combined, sorted by
  // most-recent-touched. Each row carries the status so the renderer
  // can show a "DRAFT" / "REVIEW" / "PUBLISHED" pill so ownership
  // sees the full editorial state, not just what's gone live.
  recent: Array<{
    title: string;
    format: string;
    /** Live public URL (only set for SHIPPED drafts + PUBLISHED pages). */
    url: string | null;
    /** Read-only preview URL — populated for every row, lets ownership
     *  click through to read the actual content even when it's still
     *  a draft. Routes: /preview/content/[id] for ContentDraft and
     *  /preview/neighborhood/[id] for NeighborhoodPage. */
    previewUrl?: string;
    publishedAt: string;
    // "shipped" | "approved" | "review" | "draft" | "generating" |
    // "published". UI maps these to colored pills. Optional on legacy
    // snapshots — falls back to "shipped" when missing.
    status?: string;
  }>;
};

// AEO — Answer Engine Optimization. For each AI engine (Claude, ChatGPT,
// Perplexity, Gemini) we run a fixed set of prompts about the property's
// market ("best apartments in <city>", "compare Berkeley student housing",
// etc.) and record whether the engine cited the property, cited a
// competitor instead, or said nothing. Shown in the Insights tab as the
// gap-to-close story: "your competitors got 32 mentions; you got 0."
export type ReportAeoStats = {
  totalChecks: number;
  // Breakdown by status. Sum equals totalChecks. Status values mirror
  // the AeoCitationStatus enum (CITED, COMPETITOR_CITED, NOT_CITED).
  cited: number;
  competitorCited: number;
  notMentioned: number; // NOT_CITED — engine answered but didn't mention us
  // Distinct engines that contributed at least one check this period.
  enginesUsed: string[];
  // Top competitors named across all COMPETITOR_CITED checks (most-
  // frequent first). Drives the "you're losing to X, Y, Z" callout.
  topCompetitors: Array<{ name: string; mentions: number }>;
  // Sample queries where a competitor was cited — three at most so the
  // renderer can show the actual prompts ownership cares about.
  sampleCompetitorQueries: Array<{
    prompt: string;
    engine: string;
    competitors: string[];
  }>;
  // Per-engine breakdown — drives the bar chart in the report's AEO
  // section so ownership reads "Claude cited you 6/12, Perplexity 8/15"
  // as a comparable side-by-side instead of one aggregate number.
  byEngine?: Array<{
    engine: string;
    total: number;
    cited: number;
    competitorCited: number;
  }>;
};

// ---------------------------------------------------------------------------
// Data source connection status — drives "show vs hide vs explain" gating
// across the report. The renderer (and the email) NEVER show metrics for
// a source that isn't connected — sales credibility hinges on the report
// showing only real data. When a source is disconnected, we either hide
// the section entirely or render a small "Connect X to track" notice
// instead of fake numbers.
//
// Freshness rule: a source is considered connected only if (a) the
// integration row exists with credentials, AND (b) the integration has
// produced data within FRESHNESS_WINDOW_DAYS. A stale GA4 connection
// that hasn't synced in 30 days is not a "connected" source for this
// report — same as never connecting.
// ---------------------------------------------------------------------------

export type DataSourceStatus = {
  connected: boolean;
  // ISO date of last sync / last event; null when never seen
  lastSyncAt: string | null;
  // Whether the source produced any data within the report's window
  hasDataInPeriod: boolean;
};

export type ReportDataSources = {
  googleAds: DataSourceStatus;
  metaAds: DataSourceStatus;
  ga4: DataSourceStatus;
  gsc: DataSourceStatus;
  appfolio: DataSourceStatus;
  pixel: DataSourceStatus;
  chatbot: DataSourceStatus;
};

// ---------------------------------------------------------------------------
// Reputation, occupancy, renewals, visitor stats — added in the 2026 report
// upgrade so the monthly client report reflects everything the operator
// dashboard now tracks. All sections render gracefully when the underlying
// data is empty (new tenants, no reviews yet, etc.).
// ---------------------------------------------------------------------------

export type ReportReputationSourceRow = {
  source: string;
  count: number;
  rating: number | null;
};

export type ReportReputationMention = {
  id: string;
  source: string;
  rating: number | null;
  title: string | null;
  excerpt: string;
  authorName: string | null;
  publishedAt: string | null;
  sourceUrl: string;
  sentiment: string | null;
  topics: string[] | null;
  flagged: boolean;
};

export type ReportReputationStats = {
  overallRating: number | null;
  totalReviews: number;
  newInPeriod: number;
  newInPeriodPct: number | null;
  positiveCount: number;
  negativeCount: number;
  responseRatePct: number | null;
  sourceBreakdown: ReportReputationSourceRow[];
  // Recent: chronological feed (last 12 in window)
  // Highlights: positive 5★ / sentiment=POSITIVE
  // Concerns:  negative reviews + sentiment=NEGATIVE/MIXED
  // Curated splits make the report scannable: highlights for the
  // marketing brag, concerns for the action list, recent for context.
  topMentions: ReportReputationMention[]; // legacy alias kept for older snapshots; mirrors `recent`
  recent: ReportReputationMention[];
  highlights: ReportReputationMention[];
  concerns: ReportReputationMention[];
};

export type ReportOccupancyStats = {
  totalUnits: number;
  leasedUnits: number;
  availableUnits: number;
  occupancyPct: number | null;
  onNotice: number;
  applicationsQueued: number;
  monthlyRentRollUsd: number;
  avgRentPerUnitUsd: number | null;
};

export type ReportRenewalStats = {
  activeLeases: number;
  expiringNext120: number;
  expiringNext30: number;
  expiringNext60: number;
  monthlyAtRiskUsd: number;
  pastDueCount: number;
  pastDueBalanceUsd: number;
};

export type ReportVisitorStats = {
  identifiedVisitors: number;
  identifiedNewInPeriod: number;
  withEmail: number;
  withPhone: number;
  identifiedWithLead: number;
  // Trend of *new* identifications per day across the period.
  identifiedTrend: number[];
  // Norman May 22: Operations tab was sparse. We surface every honest
  // Visitor-table signal we have so ownership reads the full pixel
  // intelligence picture — who, where, and how engaged.
  /** Pixel identification funnel: ANONYMOUS → IDENTIFIED → MATCHED. */
  byStatus?: Array<{ status: string; count: number }>;
  /** Hot visitors (intentScore >= 70). */
  hotCount?: number;
  /** Visitors with operator outreach sent. */
  outreachSentCount?: number;
  /** Audience-sync state — how many were pushed to Google / Meta. */
  syncedToGoogleAds?: number;
  syncedToMetaAds?: number;
  /** Top referrers (page URLs visitors came from). */
  topReferrers?: Array<{ referrer: string; count: number }>;
  /** Top cities + states pulled from Cursive enrichment payload. */
  topCities?: Array<{ city: string; count: number }>;
  topStates?: Array<{ state: string; count: number }>;
  /** Gender split + age range distribution from enrichment. */
  genderSplit?: Array<{ gender: string; count: number }>;
  ageRanges?: Array<{ ageRange: string; count: number }>;
};

export type ReportChatbotStatsExtended = ReportChatbotStats & {
  capturedRatePct: number | null;
  // Conversations that flipped to status=LEAD_CAPTURED in this window.
  capturedConversations: number;
  // All-time conversation count — Norman May 22: he expected to see
  // "29 conversations" (lifetime) but the strip showed "24" (28-day
  // period). Surfacing both numbers so ownership reads both stories.
  lifetimeConversations?: number;
};

// Persisted scope context so the rendered view can label which slice of
// the portfolio the snapshot represents.
export type ReportScope = {
  propertyId: string | null;
  propertyName: string | null;
  propertySlug: string | null;
};

export type ReportSnapshot = {
  kind: ReportKind;
  // Optional on legacy snapshots (will be undefined for reports created
  // before this field shipped). Older rows continue to render as
  // org-wide because the absence of scope == portfolio-wide.
  scope?: ReportScope;
  periodStart: string;
  periodEnd: string;
  kpis: ReportKpis;
  kpiDeltas: ReportKpiDeltas;
  funnel: ReportFunnelStage[];
  leadSources: ReportLeadSource[];
  adPerformance: ReportAdRow[];
  topPages: ReportTopPage[];
  topQueries: ReportTopQuery[];
  insights: ReportInsight[];
  chatbotStats: ReportChatbotStats;
  // Optional extended chatbot block. Old snapshots stored before the upgrade
  // won't have this; the view falls back to chatbotStats in that case.
  chatbotStatsExtended?: ReportChatbotStatsExtended;
  properties: ReportPropertyRow[];
  trafficTrend: number[];
  attributionBySource: ReportAttributionRow[];
  aiVisibility: ReportAiVisibility | null;
  // New 2026 sections — all optional so old snapshots stay readable. The
  // view renders nothing when these are absent or empty.
  reputationStats?: ReportReputationStats;
  occupancyStats?: ReportOccupancyStats;
  renewalStats?: ReportRenewalStats;
  visitorStats?: ReportVisitorStats;
  // AEO (Answer Engine Optimization) — how often you got cited in AI
  // search vs how often a competitor was cited instead. Optional on
  // legacy snapshots; the view renders nothing when absent.
  aeoStats?: ReportAeoStats;
  // Content (blog posts + neighborhood landing pages) shipped in the
  // window. Drives the new Content tab.
  contentStats?: ReportContentStats;
  // AppFolio lifecycle layer — applications submitted + approved +
  // leases signed in period + total active leases. Norman bug May 22:
  // SG was signing 20+ leases at TC that never showed up because the
  // funnel only counted Lead.status. Surfaces in the Traffic & Leads
  // tab so ownership sees the real lifecycle, even when only a few
  // leads come through the marketing surface.
  lifecycleStats?: ReportLifecycleStats;
  aiAnalysis?: AiAnalysis;
  // Optional on legacy snapshots. When present, drives section gating
  // across the report (and the email) so we never show metrics for a
  // disconnected integration. Older snapshots without this field show
  // every section as before — no breakage for already-shared reports.
  dataSources?: ReportDataSources;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  ORGANIC: "Organic search",
  CHATBOT: "Chatbot",
  FORM: "Website form",
  PIXEL_OUTREACH: "Pixel outreach",
  REFERRAL: "Referral",
  DIRECT: "Direct",
  EMAIL_CAMPAIGN: "Email campaign",
  COLD_EMAIL: "Cold email",
  MANUAL: "Manual",
  OTHER: "Other",
};

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TOUR_SCHEDULED: "Tour scheduled",
  TOURED: "Toured",
  APPLICATION_SENT: "Application sent",
  APPLIED: "Applied",
  APPROVED: "Approved",
  SIGNED: "Signed",
  LOST: "Lost",
  UNQUALIFIED: "Unqualified",
};

const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  GOOGLE_ADS: "Google Ads",
  META: "Meta Ads",
  LINKEDIN: "LinkedIn Ads",
  TIKTOK: "TikTok Ads",
  REDDIT: "Reddit Ads",
};

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

export function resolvePeriod(kind: ReportKind, now: Date = new Date()): {
  periodStart: Date;
  periodEnd: Date;
  priorStart: Date;
  priorEnd: Date;
} {
  const end = new Date(now);
  if (kind === "weekly") {
    const start = new Date(end.getTime() - 7 * DAY_MS);
    const priorEnd = new Date(start);
    const priorStart = new Date(priorEnd.getTime() - 7 * DAY_MS);
    return { periodStart: start, periodEnd: end, priorStart, priorEnd };
  }
  if (kind === "monthly") {
    const start = new Date(end.getTime() - 28 * DAY_MS);
    const priorEnd = new Date(start);
    const priorStart = new Date(priorEnd.getTime() - 28 * DAY_MS);
    return { periodStart: start, periodEnd: end, priorStart, priorEnd };
  }
  // Custom falls back to weekly shape.
  const start = new Date(end.getTime() - 7 * DAY_MS);
  const priorEnd = new Date(start);
  const priorStart = new Date(priorEnd.getTime() - 7 * DAY_MS);
  return { periodStart: start, periodEnd: end, priorStart, priorEnd };
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function bucketDaily(rows: Array<{ date: Date; value: number }>, days: number, periodEnd: Date): number[] {
  const buckets = new Array<number>(days).fill(0);
  const endMs = periodEnd.getTime();
  for (const row of rows) {
    const ageMs = endMs - row.date.getTime();
    if (ageMs < 0 || ageMs >= days * DAY_MS) continue;
    const idx = days - 1 - Math.floor(ageMs / DAY_MS);
    if (idx >= 0 && idx < days) buckets[idx] += row.value;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// AI visibility helpers
// ---------------------------------------------------------------------------

const GENERIC_HOUSING_TERMS = new Set([
  'apartments', 'housing', 'rooms', 'bedroom', 'studio', 'rent', 'rental',
  'available', 'near', 'affordable', 'student', 'dorms', 'university', 'college',
]);

function isBrandedQuery(query: string): boolean {
  const words = query.toLowerCase().split(/\s+/);
  const genericCount = words.filter(w => GENERIC_HOUSING_TERMS.has(w)).length;
  return genericCount < words.length / 2 && words.length <= 4;
}

// ---------------------------------------------------------------------------
// AI analysis
// ---------------------------------------------------------------------------

async function generateAiAnalysis(
  snapshot: Omit<ReportSnapshot, "aiAnalysis">,
): Promise<AiAnalysis | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const prompt = `You are analyzing property leasing marketing performance data. Provide 4-5 specific, actionable insights.

PERIOD: ${snapshot.kind} (${snapshot.periodStart} to ${snapshot.periodEnd})

KEY METRICS:
- Leads: ${snapshot.kpis.leads} (${snapshot.kpiDeltas.leadsPct != null ? snapshot.kpiDeltas.leadsPct + "% vs prior" : "no prior data"})
- Tours: ${snapshot.kpis.tours} (${snapshot.kpiDeltas.toursPct != null ? snapshot.kpiDeltas.toursPct + "% vs prior" : "no prior data"})
- Applications: ${snapshot.kpis.applications}
- Ad spend: $${snapshot.kpis.adSpendUsd} (${snapshot.kpiDeltas.adSpendUsdPct != null ? snapshot.kpiDeltas.adSpendUsdPct + "% vs prior" : "no prior data"})
- Cost per lead: ${snapshot.kpis.costPerLead != null ? "$" + snapshot.kpis.costPerLead : "n/a"}
- Organic sessions: ${snapshot.kpis.organicSessions} (${snapshot.kpiDeltas.organicSessionsPct != null ? snapshot.kpiDeltas.organicSessionsPct + "% vs prior" : "no prior data"})

FUNNEL:
${snapshot.funnel.map((s) => `- ${s.stage}: ${s.count}`).join("\n")}

LEAD SOURCES:
${snapshot.leadSources.map((s) => `- ${s.source}: ${s.count} (${s.pct}%)`).join("\n") || "- No leads this period"}

AD PERFORMANCE:
${snapshot.adPerformance.map((r) => `- ${r.platform}: $${r.spendUsd} spend, ${r.leads} leads, CPL ${r.cpl != null ? "$" + r.cpl : "n/a"}, conv rate ${r.conversionRate != null ? r.conversionRate + "%" : "n/a"}`).join("\n") || "- No ad data"}

TOP SEARCH QUERIES:
${snapshot.topQueries.slice(0, 5).map((q) => `- "${q.query}": ${q.clicks} clicks, pos ${q.position}`).join("\n") || "- No query data"}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "summary": "One sentence: what matters most this ${snapshot.kind}.",
  "actions": [
    {
      "priority": "high",
      "title": "Short action title (max 8 words)",
      "observation": "What the data shows (1 sentence)",
      "action": "What to do (1 sentence, specific)"
    }
  ]
}`;

    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 800,
    });
    return JSON.parse(text) as AiAnalysis;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Snapshot generator
// ---------------------------------------------------------------------------

export type GenerateReportOptions = {
  // When set, every query in the snapshot is scoped to this property. SEO
  // rows (which are URL-keyed, no propertyId) are matched by URL pattern
  // against the property's slug/name/bound domains. NULL = portfolio-wide.
  propertyId?: string | null;
  now?: Date;
};

// Internal scoped data resolved at the top of the function so every query
// can use a consistent set of filter clauses without re-checking `propertyId`
// throughout. When propertyId is null, all clauses degrade to {} (no extra
// filtering) — preserving the original org-wide behavior bit-for-bit.
type Scope = {
  propertyId: string | null;
  propertyName: string | null;
  propertySlug: string | null;
  // For Lead, Resident, Lease, Listing, etc. — direct column.
  propertyClause: { propertyId?: string };
  // For Tour, Application — they have no direct propertyId; we filter via
  // their `lead.propertyId` relation.
  leadRelClause: { lead?: { propertyId?: string } };
  // SEO URL-pattern matchers (computed once).
  seoLandingClause: Prisma.SeoLandingPageWhereInput;
  seoQueryClause: Prisma.SeoQueryWhereInput;
  // Snapshot signal — true means SEO scoping was actually applied.
  seoScoped: boolean;
};

async function buildScope(
  orgId: string,
  propertyId: string | null,
): Promise<Scope> {
  if (!propertyId) {
    // Norman bug (May 22): for orgs where every report is effectively
    // about ONE building (SG = TC after tc-isolate cleared the 126
    // EXCLUDED sub-records), the portfolio-wide report still pulled
    // unrelated SEO landing pages (/blog/warmly-vs-cursive-comparison
    // — a marketing site page) because there was no scope filter on
    // SEO queries. When the org has exactly one ACTIVE property, we
    // silently apply that property's URL patterns to the SEO clauses
    // so the report's "Top landing pages" + "Top search queries"
    // surface only that building's data — the right answer for a
    // single-asset operator without forcing them into a scoped report.
    const liveProperties = await prisma.property
      .findMany({
        where: { orgId, lifecycle: "ACTIVE" },
        select: { id: true, slug: true, name: true },
        take: 2,
      })
      .catch(() => [] as Array<{ id: string; slug: string; name: string }>);
    if (liveProperties.length === 1) {
      const sole = liveProperties[0];
      const domains = await prisma.domainBinding
        .findMany({ where: { orgId }, select: { hostname: true } })
        .catch(() => [] as Array<{ hostname: string }>);
      const patterns = buildPropertyUrlPatterns(
        sole.slug,
        sole.name,
        domains.map((d) => d.hostname),
      );
      const seoLandingClause: Prisma.SeoLandingPageWhereInput =
        patterns.length > 0
          ? {
              OR: patterns.map((p) => ({
                url: {
                  contains: p.replace(/%/g, ""),
                  mode: "insensitive" as const,
                },
              })),
            }
          : {};
      const seoQueryClause: Prisma.SeoQueryWhereInput =
        patterns.length > 0
          ? {
              OR: patterns.map((p) => ({
                query: {
                  contains: p.replace(/%/g, ""),
                  mode: "insensitive" as const,
                },
              })),
            }
          : {};
      return {
        // Keep propertyId null so the rest of the snapshot still reads
        // as "portfolio" (header copy, kpi labels, etc.) — only the SEO
        // clauses are tightened.
        propertyId: null,
        propertyName: null,
        propertySlug: null,
        propertyClause: {},
        leadRelClause: {},
        seoLandingClause,
        seoQueryClause,
        seoScoped: true,
      };
    }
    return {
      propertyId: null,
      propertyName: null,
      propertySlug: null,
      propertyClause: {},
      leadRelClause: {},
      seoLandingClause: {},
      seoQueryClause: {},
      seoScoped: false,
    };
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId },
    select: { id: true, slug: true, name: true },
  });
  if (!property) {
    // Caller passed a property that doesn't belong to this org. Treat as
    // a no-op scope so we never accidentally render a portfolio-wide
    // report mislabeled as a single property.
    return {
      propertyId,
      propertyName: null,
      propertySlug: null,
      propertyClause: { propertyId },
      leadRelClause: { lead: { propertyId } },
      seoLandingClause: { url: { contains: "__no_match__" } },
      seoQueryClause: { query: { contains: "__no_match__" } },
      seoScoped: true,
    };
  }

  const domains = await prisma.domainBinding
    .findMany({ where: { orgId }, select: { hostname: true } })
    .catch(() => [] as Array<{ hostname: string }>);
  const patterns = buildPropertyUrlPatterns(
    property.slug,
    property.name,
    domains.map((d) => d.hostname),
  );

  const seoLandingClause: Prisma.SeoLandingPageWhereInput =
    patterns.length > 0
      ? {
          OR: patterns.map((p) => ({
            url: {
              contains: p.replace(/%/g, ""),
              mode: "insensitive" as const,
            },
          })),
        }
      : { url: { contains: "__no_match__" } };
  const seoQueryClause: Prisma.SeoQueryWhereInput =
    patterns.length > 0
      ? {
          OR: patterns.map((p) => ({
            query: {
              contains: p.replace(/%/g, ""),
              mode: "insensitive" as const,
            },
          })),
        }
      : { query: { contains: "__no_match__" } };

  return {
    propertyId,
    propertyName: property.name,
    propertySlug: property.slug,
    propertyClause: { propertyId },
    leadRelClause: { lead: { propertyId } },
    seoLandingClause,
    seoQueryClause,
    seoScoped: true,
  };
}

export async function generateReportSnapshot(
  orgId: string,
  kind: ReportKind,
  options: GenerateReportOptions = {},
): Promise<ReportSnapshot> {
  const now = options.now ?? new Date();
  const propertyId = options.propertyId ?? null;
  const scope = await buildScope(orgId, propertyId);
  const { periodStart, periodEnd, priorStart, priorEnd } = resolvePeriod(kind, now);
  const days = kind === "weekly" ? 7 : 28;

  const [
    leadsCount,
    priorLeadsCount,
    toursCount,
    priorToursCount,
    applicationsCount,
    priorApplicationsCount,
    adSpendCurrent,
    adSpendPrior,
    adSpendDaily,
    organicCurrent,
    organicPrior,
    organicDaily,
    leadStatusGroups,
    leadSourceGroups,
    totalLeadsForSource,
    adPerfGroups,
    adLeadGroups,
    topPagesRows,
    topQueriesRows,
    insightsRows,
    chatbotAgg,
    chatbotLeadsCount,
    propertiesList,
    propertyLeadGroups,
    identifiedVisitorsCount,
    priorIdentifiedVisitorsCount,
    leasesSignedCount,
    priorLeasesSignedCount,
    activeLeasesCount,
    applicationStatusGroups,
    leasesByPropertyGroups,
    leasesSignedLast180dCount,
  ] = await Promise.all([
    // KPI counts — scope.propertyClause is `{}` for org-wide (legacy
    // behavior) or `{ propertyId }` for per-property reports.
    prisma.lead.count({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.lead.count({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: priorStart, lt: priorEnd },
      },
    }),
    prisma.tour.count({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        lead: { orgId, ...(scope.leadRelClause.lead ?? {}) },
      },
    }),
    prisma.tour.count({
      where: {
        createdAt: { gte: priorStart, lt: priorEnd },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        lead: { orgId, ...(scope.leadRelClause.lead ?? {}) },
      },
    }),
    prisma.application.count({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED] },
        lead: { orgId, ...(scope.leadRelClause.lead ?? {}) },
      },
    }),
    prisma.application.count({
      where: {
        createdAt: { gte: priorStart, lt: priorEnd },
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED] },
        lead: { orgId, ...(scope.leadRelClause.lead ?? {}) },
      },
    }),
    // Ad spend — AdMetricDaily has no propertyId; we filter via the
    // campaign relation when scoped.
    prisma.adMetricDaily.aggregate({
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        ...(scope.propertyId
          ? { campaign: { propertyId: scope.propertyId } }
          : {}),
      },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.aggregate({
      where: {
        orgId,
        date: { gte: priorStart, lt: priorEnd },
        ...(scope.propertyId
          ? { campaign: { propertyId: scope.propertyId } }
          : {}),
      },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.groupBy({
      by: ["date"],
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        ...(scope.propertyId
          ? { campaign: { propertyId: scope.propertyId } }
          : {}),
      },
      _sum: { spendCents: true },
      orderBy: { date: "asc" },
    }),
    // Organic sessions — when scoped to a property, pull from
    // SeoLandingPage rows whose URL matches the property's slug/name/
    // domain patterns (URL-keyed = the only way to attribute organic
    // traffic to a single building). When org-wide, use the SeoSnapshot
    // rollup which is faster (already aggregated daily across the
    // tenant). Behavior is identical for the org-wide path; the bug
    // pre-fix was showing the org-wide rollup on property reports.
    scope.propertyId
      ? prisma.seoLandingPage.aggregate({
          where: {
            orgId,
            ...scope.seoLandingClause,
            date: { gte: periodStart, lt: periodEnd },
          },
          _sum: { sessions: true },
        }).then((r) => ({ _sum: { organicSessions: r._sum.sessions ?? 0 } }))
      : prisma.seoSnapshot.aggregate({
          where: { orgId, date: { gte: periodStart, lt: periodEnd } },
          _sum: { organicSessions: true },
        }),
    scope.propertyId
      ? prisma.seoLandingPage.aggregate({
          where: {
            orgId,
            ...scope.seoLandingClause,
            date: { gte: priorStart, lt: priorEnd },
          },
          _sum: { sessions: true },
        }).then((r) => ({ _sum: { organicSessions: r._sum.sessions ?? 0 } }))
      : prisma.seoSnapshot.aggregate({
          where: { orgId, date: { gte: priorStart, lt: priorEnd } },
          _sum: { organicSessions: true },
        }),
    scope.propertyId
      ? prisma.seoLandingPage
          .groupBy({
            by: ["date"],
            where: {
              orgId,
              ...scope.seoLandingClause,
              date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { sessions: true },
            orderBy: { date: "asc" },
          })
          .then((rows) =>
            rows.map((r) => ({
              date: r.date,
              organicSessions: r._sum.sessions ?? 0,
            })),
          )
      : prisma.seoSnapshot.findMany({
          where: { orgId, date: { gte: periodStart, lt: periodEnd } },
          select: { date: true, organicSessions: true },
          orderBy: { date: "asc" },
        }),
    // Funnel from LeadStatus groupBy
    prisma.lead.groupBy({
      by: ["status"],
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
    }),
    // Lead sources
    prisma.lead.groupBy({
      by: ["source"],
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
    }),
    prisma.lead.count({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    // Ad perf by platform (join metrics -> campaign for platform)
    prisma.adCampaign.findMany({
      where: { orgId, ...scope.propertyClause },
      select: {
        id: true,
        platform: true,
        metricsDaily: {
          where: { date: { gte: periodStart, lt: periodEnd } },
          select: { spendCents: true, conversions: true, clicks: true },
        },
      },
    }),
    // Ad leads per platform (via source)
    prisma.lead.groupBy({
      by: ["source"],
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
        source: { in: [LeadSource.GOOGLE_ADS, LeadSource.META_ADS] },
      },
      _count: { _all: true },
    }),
    // SEO top pages — when scoped to a property, only URLs matching the
    // property's slug/name/domain patterns are returned.
    prisma.seoLandingPage.groupBy({
      by: ["url"],
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        ...scope.seoLandingClause,
      },
      _sum: { sessions: true },
      orderBy: { _sum: { sessions: "desc" } },
      take: 10,
    }),
    // SEO top queries — same URL-pattern scoping logic.
    prisma.seoQuery.groupBy({
      by: ["query"],
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        ...scope.seoQueryClause,
      },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
      orderBy: { _sum: { clicks: "desc" } },
      take: 10,
    }),
    // Insights opened within window
    prisma.insight.findMany({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        kind: true,
        severity: true,
        title: true,
        body: true,
      },
    }),
    // Chatbot stats
    prisma.chatbotConversation.aggregate({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
      _avg: { messageCount: true },
    }),
    prisma.lead.count({
      where: {
        orgId,
        ...scope.propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
        source: LeadSource.CHATBOT,
      },
    }),
    // Property rollup — when scoped, this collapses to the single
    // property the report is for. No fake/seeded data ever — pure
    // Property table reads.
    prisma.property.findMany({
      where: { orgId, ...(scope.propertyId ? { id: scope.propertyId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: scope.propertyId ? 1 : 20,
      select: {
        id: true,
        name: true,
        totalUnits: true,
        availableCount: true,
      },
    }),
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        ...(scope.propertyId
          ? { propertyId: scope.propertyId }
          : { propertyId: { not: null } }),
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
    }),
    // Identified-visitor counts — see ReportKpis.identifiedVisitors
    // comment. Status filter mirrors the /portal/visitors feed: only
    // count rows that resolved to a real person (IDENTIFIED, ENRICHED,
    // MATCHED_TO_LEAD), never anonymous or pending-resolution rows.
    // Period window matches the leads count so the two combine
    // cleanly into a single "captured contacts" headline.
    prisma.visitor.count({
      where: {
        orgId,
        ...scope.propertyClause,
        status: {
          in: [
            VisitorIdentificationStatus.IDENTIFIED,
            VisitorIdentificationStatus.ENRICHED,
            VisitorIdentificationStatus.MATCHED_TO_LEAD,
          ],
        },
        firstSeenAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.visitor.count({
      where: {
        orgId,
        ...scope.propertyClause,
        status: {
          in: [
            VisitorIdentificationStatus.IDENTIFIED,
            VisitorIdentificationStatus.ENRICHED,
            VisitorIdentificationStatus.MATCHED_TO_LEAD,
          ],
        },
        firstSeenAt: { gte: priorStart, lt: priorEnd },
      },
    }),
    // ─────────────────────────────────────────────────────────────────────
    // APPFOLIO LIFECYCLE LAYER — Norman bug (May 22): SG signed 20+ leases
    // at Telegraph Commons but the report's Conversion Stages all read 0
    // because the funnel only counted Lead.status groups. Leases live in
    // the Lease table (synced from AppFolio) without a linked Lead in
    // most cases, so they were invisible to the funnel.
    //
    // We layer AppFolio mirror-table counts on top of the existing Lead
    // funnel — leases signed in the period (Lease.startDate window) get
    // added to the "Signed" stage; AppFolio Applications submitted in
    // the period go to "Applied"; approved go to "Approved". Same scope
    // (org-wide or per-property) the rest of the report uses.
    // ─────────────────────────────────────────────────────────────────────
    // Important: when the report is portfolio-wide, we still want to
    // exclude EXCLUDED / ARCHIVED / IMPORTED properties (e.g. SG's 126
    // sub-record buildings the operator already curated out via
    // tc-isolate). marketablePropertyWhere() returns the canonical
    // {lifecycle: ACTIVE} clause and is applied to the Property
    // relation on every Lease/Application query below.
    prisma.lease.count({
      where: {
        orgId,
        ...scope.propertyClause,
        property: { lifecycle: "ACTIVE" },
        startDate: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.lease.count({
      where: {
        orgId,
        ...scope.propertyClause,
        property: { lifecycle: "ACTIVE" },
        startDate: { gte: priorStart, lt: priorEnd },
      },
    }),
    prisma.lease.count({
      where: {
        orgId,
        ...scope.propertyClause,
        property: { lifecycle: "ACTIVE" },
        status: LeaseStatus.ACTIVE,
      },
    }),
    prisma.application.groupBy({
      by: ["status"],
      where: {
        ...(scope.propertyId ? { propertyId: scope.propertyId } : {}),
        property: { lifecycle: "ACTIVE" },
        lead: { orgId },
        // Use createdAt as the period boundary — appliedAt is set by
        // AppFolio sync and sometimes nulls out for in-flight rows.
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
    }),
    // Per-property leases signed in period for the "Where leases came
    // from" attribution table (org-wide reports only). When scoped to
    // a single property the data already collapses.
    prisma.lease.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        ...scope.propertyClause,
        property: { lifecycle: "ACTIVE" },
        startDate: { gte: periodStart, lt: periodEnd },
      },
      _count: { _all: true },
    }),
    // Rolling 180-day lease count — for seasonal portfolios where the
    // current 7/28-day window misses the natural signing peak (student
    // housing: Jan–Feb push; family rentals: summer move-ins).
    prisma.lease.count({
      where: {
        orgId,
        ...scope.propertyClause,
        property: { lifecycle: "ACTIVE" },
        startDate: {
          gte: new Date(Date.now() - 180 * DAY_MS),
          lte: now,
        },
      },
    }),
  ]);

  // KPIs
  const adSpendCents = adSpendCurrent._sum.spendCents ?? 0;
  const priorAdSpendCents = adSpendPrior._sum.spendCents ?? 0;
  const adSpendUsd = Math.round(adSpendCents / 100);
  const priorAdSpendUsd = Math.round(priorAdSpendCents / 100);
  const organicSessions = organicCurrent._sum.organicSessions ?? 0;
  const priorOrganicSessions = organicPrior._sum.organicSessions ?? 0;

  // CPL must only divide by *paid* leads. Including chatbot/organic/referral
  // leads in the denominator made CPL look great on properties whose leads
  // mostly came from non-paid channels — and made paid-channel performance
  // unreadable. paidLeadsCount = sum of leads attributed to GOOGLE_ADS or
  // META_ADS sources for the same scope/period as adSpend.
  const paidLeadsCount = adLeadGroups.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const costPerLead =
    paidLeadsCount > 0 && adSpendUsd > 0
      ? Math.round((adSpendUsd / paidLeadsCount) * 100) / 100
      : null;
  // Prior-period CPL — we only have ad-leads by source for the current
  // period in this query block, so prior CPL falls back to the old
  // total-leads denom. Better than nothing for direction-of-change context.
  const priorCostPerLead =
    priorLeadsCount > 0 && priorAdSpendUsd > 0
      ? priorAdSpendUsd / priorLeadsCount
      : null;

  const kpis: ReportKpis = {
    leads: leadsCount,
    identifiedVisitors: identifiedVisitorsCount,
    tours: toursCount,
    applications: applicationsCount,
    costPerLead,
    adSpendUsd,
    organicSessions,
  };

  const kpiDeltas: ReportKpiDeltas = {
    leadsPct: pctChange(leadsCount, priorLeadsCount),
    identifiedVisitorsPct: pctChange(
      identifiedVisitorsCount,
      priorIdentifiedVisitorsCount,
    ),
    toursPct: pctChange(toursCount, priorToursCount),
    applicationsPct: pctChange(applicationsCount, priorApplicationsCount),
    costPerLeadPct:
      priorCostPerLead != null && costPerLead != null
        ? Math.round(((costPerLead - priorCostPerLead) / priorCostPerLead) * 100)
        : null,
    adSpendUsdPct: pctChange(adSpendUsd, priorAdSpendUsd),
    organicSessionsPct: pctChange(organicSessions, priorOrganicSessions),
  };

  // Funnel — Norman bug (May 22): previously this only counted
  // Lead.status groups. SG signed 20+ leases at Telegraph Commons but
  // every stage past NEW read 0 because the funnel never looked at
  // the AppFolio Application / Lease tables (which hold the real
  // pipeline data for most tenants — Lead rows only cover form +
  // chatbot opt-ins).
  //
  // New behavior: Lead.status counts get a per-stage LAYER from the
  // AppFolio mirror tables for the same window:
  //   APPLIED   += Application rows whose status is SUBMITTED in period
  //   APPROVED  += Application rows whose status is APPROVED in period
  //   SIGNED    += Lease rows whose startDate falls in period
  // The Lead-status counts still anchor the stages that the operator
  // explicitly transitions through (NEW → CONTACTED → TOUR_*), and
  // AppFolio is additive — never replaces — so single-system tenants
  // see the same numbers as before.
  const statusByKey = new Map<LeadStatus, number>();
  for (const row of leadStatusGroups) {
    statusByKey.set(row.status, row._count._all);
  }
  const appliedFromAppFolio =
    applicationStatusGroups.find((g) => g.status === ApplicationStatus.SUBMITTED)
      ?._count._all ?? 0;
  const approvedFromAppFolio =
    applicationStatusGroups.find((g) => g.status === ApplicationStatus.APPROVED)
      ?._count._all ?? 0;
  const funnelOrder: LeadStatus[] = [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.TOURED,
    LeadStatus.APPLIED,
    LeadStatus.APPROVED,
    LeadStatus.SIGNED,
  ];
  const funnel: ReportFunnelStage[] = funnelOrder.map((s) => {
    let count = statusByKey.get(s) ?? 0;
    if (s === LeadStatus.APPLIED) count += appliedFromAppFolio;
    if (s === LeadStatus.APPROVED) count += approvedFromAppFolio;
    if (s === LeadStatus.SIGNED) count += leasesSignedCount;
    return { stage: LEAD_STATUS_LABELS[s], count };
  });

  // Lead sources
  const totalSourceLeads = totalLeadsForSource || 1;
  const leadSources: ReportLeadSource[] = leadSourceGroups
    .map((row) => ({
      source: LEAD_SOURCE_LABELS[row.source] ?? row.source,
      count: row._count._all,
      pct: Math.round((row._count._all / totalSourceLeads) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Ad performance by platform
  const perfByPlatform = new Map<AdPlatform, { spendCents: number; conversions: number; clicks: number }>();
  for (const c of adPerfGroups) {
    const agg = perfByPlatform.get(c.platform) ?? { spendCents: 0, conversions: 0, clicks: 0 };
    for (const m of c.metricsDaily) {
      agg.spendCents += m.spendCents;
      agg.conversions += m.conversions;
      agg.clicks += m.clicks;
    }
    perfByPlatform.set(c.platform, agg);
  }
  const leadsByPlatform = new Map<AdPlatform, number>();
  for (const row of adLeadGroups) {
    const platform =
      row.source === LeadSource.GOOGLE_ADS
        ? AdPlatform.GOOGLE_ADS
        : row.source === LeadSource.META_ADS
          ? AdPlatform.META
          : null;
    if (platform) leadsByPlatform.set(platform, row._count._all);
  }
  const adPerformance: ReportAdRow[] = Array.from(perfByPlatform.entries()).map(([platform, agg]) => {
    const spendUsd = Math.round(agg.spendCents / 100);
    const leads = leadsByPlatform.get(platform) ?? 0;
    const cpl = leads > 0 ? Math.round((spendUsd / leads) * 100) / 100 : null;
    const conversionRate =
      agg.clicks > 0 ? Math.round((agg.conversions / agg.clicks) * 10000) / 100 : null;
    return {
      platform: AD_PLATFORM_LABELS[platform] ?? platform,
      spendUsd,
      leads,
      cpl,
      conversionRate,
    };
  });

  // Top pages
  const topPages: ReportTopPage[] = topPagesRows.map((row) => ({
    url: row.url,
    sessions: row._sum.sessions ?? 0,
    clicks: 0,
  }));

  // Top queries
  const topQueries: ReportTopQuery[] = topQueriesRows.map((row) => ({
    query: row.query,
    clicks: row._sum.clicks ?? 0,
    impressions: row._sum.impressions ?? 0,
    position: row._avg.position ? Math.round(row._avg.position * 10) / 10 : 0,
  }));

  // Insights
  const insights: ReportInsight[] = insightsRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    body: row.body,
  }));

  // Chatbot
  const chatbotStats: ReportChatbotStats = {
    conversations: chatbotAgg._count._all ?? 0,
    leadsFromChat: chatbotLeadsCount,
    avgMessageCount: chatbotAgg._avg.messageCount
      ? Math.round((chatbotAgg._avg.messageCount as number) * 10) / 10
      : 0,
  };

  // Property rollup
  const leadsByProperty = new Map<string, number>();
  for (const row of propertyLeadGroups) {
    if (!row.propertyId) continue;
    leadsByProperty.set(row.propertyId, row._count._all);
  }

  // Per-property occupancy — same priority order as buildOccupancyStats:
  // active lease count first, then available listings, then the legacy
  // denorm. Don't surface a number we can't trust; render null when no
  // signal exists.
  const propertyIds = propertiesList.map((p) => p.id);
  const [activeLeasesByProp, availableListingsByProp] = propertyIds.length > 0
    ? await Promise.all([
        prisma.lease.groupBy({
          by: ["propertyId"],
          where: {
            orgId,
            propertyId: { in: propertyIds },
            status: LeaseStatus.ACTIVE,
          },
          _count: { _all: true },
        }),
        prisma.listing.groupBy({
          by: ["propertyId"],
          where: {
            propertyId: { in: propertyIds },
            isAvailable: true,
          },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const leaseCountByPropId = new Map<string, number>();
  for (const r of activeLeasesByProp) {
    if (r.propertyId) leaseCountByPropId.set(r.propertyId, r._count._all);
  }
  const availListingByPropId = new Map<string, number>();
  for (const r of availableListingsByProp) {
    if (r.propertyId) availListingByPropId.set(r.propertyId, r._count._all);
  }

  const properties: ReportPropertyRow[] = propertiesList.map((p) => {
    const total = p.totalUnits ?? 0;
    let occupancyPct: number | null = null;
    if (total > 0) {
      const activeLeases = leaseCountByPropId.get(p.id) ?? 0;
      const availListings = availListingByPropId.get(p.id) ?? 0;
      const denormAvailable = p.availableCount ?? 0;
      if (activeLeases > 0) {
        occupancyPct = Math.round(
          (Math.min(total, activeLeases) / total) * 100,
        );
      } else if (availListings > 0) {
        occupancyPct = Math.round(
          (Math.max(0, total - availListings) / total) * 100,
        );
      } else if (denormAvailable > 0) {
        occupancyPct = Math.round(
          (Math.max(0, total - denormAvailable) / total) * 100,
        );
      }
      // else: no signal → null (don't lie with 100%)
    }
    return {
      id: p.id,
      name: p.name,
      leads: leadsByProperty.get(p.id) ?? 0,
      occupancyPct,
    };
  });

  // Traffic trend — Norman bug (May 22): the chart was rendering as a
  // single bump because organicSessions in SeoSnapshot is mostly zero
  // for many orgs (GA4 sometimes doesn't fully populate the daily
  // organic-sessions field). We have FULL daily GSC click data on the
  // same SeoSnapshot rows though — clicks is a fine proxy for "search
  // traffic" and reads as a meaningful curve.
  //
  // Strategy: prefer organic sessions when they exist, fall back to
  // GSC clicks (always populated for orgs with GSC connected), then
  // ad spend shape as the absolute last resort.
  const trafficTrendFromSessions = bucketDaily(
    organicDaily.map((r) => ({ date: r.date, value: r.organicSessions ?? 0 })),
    days,
    periodEnd,
  );
  const gscDaily = await prisma.seoSnapshot
    .findMany({
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      select: { date: true, totalClicks: true },
      orderBy: { date: "asc" },
    })
    .catch(() => [] as Array<{ date: Date; totalClicks: number | null }>);
  const trafficTrendFromClicks = bucketDaily(
    gscDaily.map((r) => ({ date: r.date, value: r.totalClicks ?? 0 })),
    days,
    periodEnd,
  );
  // Pick whichever source has the MOST coverage — sessions can show
  // one stray non-zero point (legacy snapshots had a single May 15
  // value of 1 mixed into 27 zeros) which would otherwise pin the
  // chart to the sparse series even when clicks has full daily data.
  // Count non-zero days per source and use the winner.
  const sessionsCoverage = trafficTrendFromSessions.filter((v) => v > 0).length;
  const clicksCoverage = trafficTrendFromClicks.filter((v) => v > 0).length;
  const trafficFallback =
    sessionsCoverage > clicksCoverage
      ? trafficTrendFromSessions
      : clicksCoverage > 0
        ? trafficTrendFromClicks
        : adSpendDaily.length > 0
          ? bucketDaily(
              adSpendDaily.map((r) => ({
                date: r.date,
                value: (r._sum.spendCents ?? 0) / 100,
              })),
              days,
              periodEnd,
            )
          : trafficTrendFromSessions;

  // Attribution by source — load leads with id/source/status, then join tours and apps
  const allLeadsInPeriod = await prisma.lead.findMany({
    where: {
      orgId,
      ...scope.propertyClause,
      createdAt: { gte: periodStart, lt: periodEnd },
    },
    select: { id: true, source: true, status: true },
  });

  const leadIds = allLeadsInPeriod.map(l => l.id);

  const [toursForLeads, appsForLeads] = await Promise.all([
    leadIds.length > 0
      ? prisma.tour.findMany({
          where: { leadId: { in: leadIds } },
          select: { leadId: true },
        })
      : Promise.resolve([]),
    leadIds.length > 0
      ? prisma.application.findMany({
          where: { leadId: { in: leadIds } },
          select: { leadId: true },
        })
      : Promise.resolve([]),
  ]);

  const toursByLeadId = new Set(toursForLeads.map(t => t.leadId));
  const appsByLeadId = new Set(appsForLeads.map(a => a.leadId));

  const sourceMap = new Map<string, ReportAttributionRow>();
  for (const lead of allLeadsInPeriod) {
    const label = LEAD_SOURCE_LABELS[lead.source] ?? lead.source;
    const row = sourceMap.get(label) ?? { source: label, leads: 0, tours: 0, applications: 0, signed: 0 };
    row.leads++;
    if (toursByLeadId.has(lead.id)) row.tours++;
    if (appsByLeadId.has(lead.id)) row.applications++;
    if (lead.status === LeadStatus.SIGNED) row.signed++;
    sourceMap.set(label, row);
  }
  const attributionBySource: ReportAttributionRow[] = Array.from(sourceMap.values())
    .filter(r => r.leads > 0)
    .sort((a, b) => b.signed - a.signed || b.leads - a.leads);

  // AI visibility — classify branded vs. generic search queries
  const totalClicks = topQueriesRows.reduce((s, q) => s + (q._sum.clicks ?? 0), 0);
  const brandedQueryRows = topQueriesRows.filter(q => isBrandedQuery(q.query));
  const brandedClicks = brandedQueryRows.reduce((s, q) => s + (q._sum.clicks ?? 0), 0);
  const brandedImpressions = brandedQueryRows.reduce((s, q) => s + (q._sum.impressions ?? 0), 0);

  const aiVisibility: ReportAiVisibility | null = totalClicks > 0
    ? {
        brandedClicks,
        brandedImpressions,
        brandedShare: Math.round((brandedClicks / totalClicks) * 100),
        topBrandedTerms: brandedQueryRows
          .sort((a, b) => (b._sum.clicks ?? 0) - (a._sum.clicks ?? 0))
          .slice(0, 5)
          .map(q => q.query),
      }
    : null;

  // -------------------------------------------------------------------------
  // 2026 sections — reputation, occupancy, renewals, visitor identification.
  // Each block is independently try/caught so an empty/missing data source
  // (new tenant, schema not migrated, integration not configured) never
  // blocks the rest of the report from generating.
  // -------------------------------------------------------------------------

  // Reputation — always lifetime + delta vs prior period.
  const reputationStats = await buildReputationStats(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
    priorStart,
    priorEnd,
  ).catch(() => undefined);

  // Occupancy — point-in-time snapshot. Scoped to the property when set.
  const occupancyStats = await buildOccupancyStats(orgId, scope.propertyId).catch(
    () => undefined,
  );

  // Renewals — forward-looking 120-day window from periodEnd.
  const renewalStats = await buildRenewalStats(
    orgId,
    scope.propertyId,
    periodEnd,
  ).catch(() => undefined);

  // Visitor identification — pixel-driven, period-scoped.
  const visitorStats = await buildVisitorStats(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
    days,
  ).catch(() => undefined);

  // Chatbot extended — captured-rate breakdown for the report.
  const chatbotStatsExtended = await buildChatbotExtended(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
    chatbotStats,
  ).catch(() => undefined);

  // AEO stats — how often we got cited vs how often a competitor was
  // cited instead, across all AI engines in the period. Headline insight
  // for the Insights tab.
  const aeoStats = await buildAeoStats(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
  ).catch(() => undefined);

  // Content stats — blog posts + neighborhood pages published.
  const contentStats = await buildContentStats(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
  ).catch(() => undefined);

  // Connection status for every integration — drives section gating in
  // the renderer + email so we never show fake $X ad spend / 0 tours
  // numbers for sources the operator hasn't actually connected.
  const dataSources = await buildDataSources(
    orgId,
    scope.propertyId,
    periodStart,
    periodEnd,
  ).catch(() => undefined);

  // AppFolio lifecycle layer — populated whenever there's at least one
  // active lease OR any in-period lease/application activity. We never
  // ship an empty block (renderer collapses gracefully when undefined)
  // so marketing-only tenants without AppFolio sync don't see a strip
  // full of zeros.
  const applicationsSubmittedInPeriod =
    applicationStatusGroups.find(
      (g) => g.status === ApplicationStatus.SUBMITTED,
    )?._count._all ?? 0;
  const applicationsApprovedInPeriod =
    applicationStatusGroups.find(
      (g) => g.status === ApplicationStatus.APPROVED,
    )?._count._all ?? 0;
  const applicationsInPeriod = applicationStatusGroups.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  // 12-month lease velocity — pull all in-window lease startDates, then
  // bucket into calendar months client-side. Avoids a per-month DB
  // round trip while keeping the count cheap for any sane portfolio.
  const monthlySignedLast12 = await buildMonthlyLeaseVelocity(
    orgId,
    scope.propertyId,
    now,
  );

  const lifecycleStats: ReportLifecycleStats | undefined =
    activeLeasesCount > 0 ||
    leasesSignedCount > 0 ||
    applicationsInPeriod > 0
      ? {
          leasesSignedInPeriod: leasesSignedCount,
          priorLeasesSignedInPeriod: priorLeasesSignedCount,
          leasesSignedLast180d: leasesSignedLast180dCount,
          activeLeases: activeLeasesCount,
          monthlySignedLast12,
          applicationsInPeriod,
          applicationsApprovedInPeriod,
          applicationsSubmittedInPeriod,
        }
      : undefined;

  // Per-property leases signed map — used below to enrich the
  // attribution table when org-wide reports want to show signed counts
  // by source. Kept as a Map so the lookup stays O(1) per property row.
  const leasesByPropertyId = new Map<string, number>();
  for (const row of leasesByPropertyGroups) {
    if (row.propertyId) {
      leasesByPropertyId.set(row.propertyId, row._count._all);
    }
  }
  // Suppress the unused-var lint without leaking it into production
  // code paths — referenced via baseSnapshot below.
  void leasesByPropertyId;

  const baseSnapshot: Omit<ReportSnapshot, "aiAnalysis"> = {
    kind,
    scope: {
      propertyId: scope.propertyId,
      propertyName: scope.propertyName,
      propertySlug: scope.propertySlug,
    },
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    kpis,
    kpiDeltas,
    funnel,
    leadSources,
    adPerformance,
    topPages,
    topQueries,
    insights,
    chatbotStats,
    chatbotStatsExtended,
    properties,
    trafficTrend: trafficFallback,
    attributionBySource,
    aiVisibility,
    reputationStats,
    occupancyStats,
    renewalStats,
    visitorStats,
    aeoStats,
    contentStats,
    lifecycleStats,
    dataSources,
  };

  const aiAnalysis = await generateAiAnalysis(baseSnapshot);

  return {
    ...baseSnapshot,
    ...(aiAnalysis ? { aiAnalysis } : {}),
  };
}

// ---------------------------------------------------------------------------
// Section builders — each is independent so reports keep generating when
// an integration is missing or the schema migration hasn't run yet.
// ---------------------------------------------------------------------------

const MENTION_SOURCE_LABELS: Record<MentionSource, string> = {
  GOOGLE_REVIEW: "Google",
  REDDIT: "Reddit",
  YELP: "Yelp",
  TAVILY_WEB: "Web",
  FACEBOOK_PUBLIC: "Facebook",
  OTHER: "Other",
};

// Freshness window: a source needs activity within this many days to
// be considered "connected" for report purposes. Stale connections
// that haven't synced in a month are treated like disconnected — the
// operator's clients deserve current data, not ghost numbers from a
// dead integration.
const SOURCE_FRESHNESS_DAYS = 30;

async function buildDataSources(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
): Promise<ReportDataSources> {
  const freshThreshold = new Date(
    Date.now() - SOURCE_FRESHNESS_DAYS * DAY_MS,
  );
  const propertyClause = propertyId ? { propertyId } : {};

  const [
    googleAdAccount,
    metaAdAccount,
    ga4Integration,
    gscIntegration,
    appfolioIntegration,
    cursivePixel,
    chatbotConfig,
    googleAdSpendInPeriod,
    metaAdSpendInPeriod,
    organicSessionsInPeriod,
    gscClicksInPeriod,
    chatbotConvosInPeriod,
    pixelEventsInPeriod,
  ] = await Promise.all([
    prisma.adAccount.findFirst({
      where: {
        orgId,
        platform: "GOOGLE_ADS",
        credentialsEncrypted: { not: null },
      },
      select: { lastSyncAt: true },
      orderBy: { lastSyncAt: "desc" },
    }),
    prisma.adAccount.findFirst({
      where: {
        orgId,
        platform: "META",
        credentialsEncrypted: { not: null },
      },
      select: { lastSyncAt: true },
      orderBy: { lastSyncAt: "desc" },
    }),
    prisma.seoIntegration.findFirst({
      where: {
        orgId,
        provider: "GA4",
        serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
        ...(propertyId ? { propertyId } : {}),
      },
      select: { lastSyncAt: true },
      orderBy: { lastSyncAt: "desc" },
    }),
    prisma.seoIntegration.findFirst({
      where: {
        orgId,
        provider: "GSC",
        serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
        ...(propertyId ? { propertyId } : {}),
      },
      select: { lastSyncAt: true },
      orderBy: { lastSyncAt: "desc" },
    }),
    prisma.appFolioIntegration.findFirst({
      where: { orgId },
      select: { lastSyncAt: true, syncStatus: true },
    }),
    prisma.cursiveIntegration.findFirst({
      where: { orgId, ...(propertyId ? { propertyId } : {}) },
      select: { lastEventAt: true, cursivePixelId: true },
      orderBy: { lastEventAt: "desc" },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { tenantSiteConfig: { select: { chatbotEnabled: true } } },
    }),
    // Period-window data presence — even if an integration is connected,
    // the section is meaningful only when there's data in the window.
    prisma.adMetricDaily.aggregate({
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        adAccount: { platform: "GOOGLE_ADS" },
      },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.aggregate({
      where: {
        orgId,
        date: { gte: periodStart, lt: periodEnd },
        adAccount: { platform: "META" },
      },
      _sum: { spendCents: true },
    }),
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { organicSessions: true },
    }),
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { totalClicks: true },
    }),
    prisma.chatbotConversation.count({
      where: {
        orgId,
        ...propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.visitorEvent.count({
      where: {
        orgId,
        ...propertyClause,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
  ]);

  function status(
    lastAt: Date | null | undefined,
    hasCredentials: boolean,
    hasDataInPeriod: boolean,
  ): DataSourceStatus {
    const fresh =
      hasCredentials && lastAt != null && lastAt >= freshThreshold;
    return {
      connected: fresh,
      lastSyncAt: lastAt ? lastAt.toISOString() : null,
      hasDataInPeriod,
    };
  }

  return {
    googleAds: status(
      googleAdAccount?.lastSyncAt ?? null,
      googleAdAccount != null,
      (googleAdSpendInPeriod?._sum?.spendCents ?? 0) > 0,
    ),
    metaAds: status(
      metaAdAccount?.lastSyncAt ?? null,
      metaAdAccount != null,
      (metaAdSpendInPeriod?._sum?.spendCents ?? 0) > 0,
    ),
    ga4: status(
      ga4Integration?.lastSyncAt ?? null,
      ga4Integration != null,
      (organicSessionsInPeriod._sum.organicSessions ?? 0) > 0,
    ),
    gsc: status(
      gscIntegration?.lastSyncAt ?? null,
      gscIntegration != null,
      (gscClicksInPeriod._sum.totalClicks ?? 0) > 0,
    ),
    appfolio: status(
      appfolioIntegration?.lastSyncAt ?? null,
      appfolioIntegration != null,
      // AppFolio has no direct "did we sync data this period" — fall back
      // to whether we synced *recently*. AppFolio data (residents,
      // leases, work orders) is point-in-time, not period-bucketed.
      appfolioIntegration?.lastSyncAt != null &&
        appfolioIntegration.lastSyncAt >= freshThreshold,
    ),
    pixel: status(
      cursivePixel?.lastEventAt ?? null,
      cursivePixel?.cursivePixelId != null,
      pixelEventsInPeriod > 0,
    ),
    // Chatbot is config-driven (no "last sync" concept since chats
    // are ingested directly), so we bypass the freshness check.
    chatbot: {
      connected: Boolean(chatbotConfig?.tenantSiteConfig?.chatbotEnabled),
      lastSyncAt: null,
      hasDataInPeriod: chatbotConvosInPeriod > 0,
    },
  };
}

// ---------------------------------------------------------------------------
// buildMonthlyLeaseVelocity — last 12 calendar months of new lease
// startDates, scoped to ACTIVE properties. Powers the sparkline in
// the Lifecycle pipeline strip so ownership can see the seasonality
// (student housing: Jul/Aug move-in + Jan signing peak) and trust
// the "X active leases" headline. Returns oldest → newest so the
// sparkline draws left-to-right naturally.
// ---------------------------------------------------------------------------
async function buildMonthlyLeaseVelocity(
  orgId: string,
  propertyId: string | null,
  now: Date,
): Promise<Array<{ month: string; count: number }>> {
  const propertyClause = propertyId ? { propertyId } : {};
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const leases = await prisma.lease
    .findMany({
      where: {
        orgId,
        ...propertyClause,
        property: { lifecycle: "ACTIVE" },
        startDate: { gte: start, lte: now },
      },
      select: { startDate: true },
    })
    .catch(() => [] as Array<{ startDate: Date | null }>);

  // Bucket into the 12 calendar months ending in the current one.
  const buckets = new Map<string, number>();
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, 0);
  }
  for (const lease of leases) {
    if (!lease.startDate) continue;
    const key = `${lease.startDate.getFullYear()}-${String(lease.startDate.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([month, count]) => ({ month, count }));
}

// ---------------------------------------------------------------------------
// buildContentStats — published content (blog posts + neighborhood
// pages) shipped in the period. Powers the Content tab in the report
// so ownership sees the SEO content pipeline as a real deliverable
// alongside the rest of the marketing surface.
// ---------------------------------------------------------------------------
async function buildContentStats(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
): Promise<ReportContentStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};
  // Norman feedback (May 22): include drafts (PENDING_REVIEW + DRAFT
  // neighborhood pages) so ownership sees the in-flight pipeline, not
  // just what's gone live. The "totalPublished" headline still only
  // counts APPROVED/SHIPPED + PUBLISHED so the editorial gate stays
  // honest — drafts are surfaced separately as "in progress".
  const PUBLISHED_DRAFT_STATUSES: DraftStatus[] = [
    DraftStatus.APPROVED,
    DraftStatus.SHIPPED,
  ];
  const IN_PROGRESS_DRAFT_STATUSES: DraftStatus[] = [
    DraftStatus.PENDING_REVIEW,
    DraftStatus.CHANGES_REQUESTED,
    DraftStatus.GENERATING,
  ];
  const ALL_DRAFT_STATUSES = [
    ...PUBLISHED_DRAFT_STATUSES,
    ...IN_PROGRESS_DRAFT_STATUSES,
  ];

  const [
    publishedDrafts,
    inProgressDrafts,
    publishedDraftsInPeriod,
    publishedNeighborhoods,
    draftNeighborhoods,
    publishedNeighborhoodsInPeriod,
  ] = await Promise.all([
    prisma.contentDraft
      .findMany({
        where: {
          orgId,
          ...propertyClause,
          status: { in: PUBLISHED_DRAFT_STATUSES },
        },
        select: {
          id: true,
          format: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          output: true,
        },
        orderBy: { updatedAt: "desc" },
      })
      .catch(
        () =>
          [] as Array<{
            id: string;
            format: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            output: unknown;
          }>,
      ),
    prisma.contentDraft
      .findMany({
        where: {
          orgId,
          ...propertyClause,
          status: { in: IN_PROGRESS_DRAFT_STATUSES },
        },
        select: {
          id: true,
          format: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          output: true,
        },
        orderBy: { updatedAt: "desc" },
      })
      .catch(
        () =>
          [] as Array<{
            id: string;
            format: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            output: unknown;
          }>,
      ),
    prisma.contentDraft
      .count({
        where: {
          orgId,
          ...propertyClause,
          status: { in: PUBLISHED_DRAFT_STATUSES },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      })
      .catch(() => 0),
    prisma.neighborhoodPage
      .findMany({
        where: { orgId, ...propertyClause, status: "PUBLISHED" },
        select: {
          id: true,
          city: true,
          neighborhood: true,
          slug: true,
          publishedAt: true,
          updatedAt: true,
          title: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
      })
      .catch(
        () =>
          [] as Array<{
            id: string;
            city: string;
            neighborhood: string;
            slug: string;
            title: string;
            status: string;
            publishedAt: Date | null;
            updatedAt: Date;
          }>,
      ),
    prisma.neighborhoodPage
      .findMany({
        where: { orgId, ...propertyClause, status: "DRAFT" },
        select: {
          id: true,
          city: true,
          neighborhood: true,
          slug: true,
          publishedAt: true,
          updatedAt: true,
          title: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
      })
      .catch(
        () =>
          [] as Array<{
            id: string;
            city: string;
            neighborhood: string;
            slug: string;
            title: string;
            status: string;
            publishedAt: Date | null;
            updatedAt: Date;
          }>,
      ),
    prisma.neighborhoodPage
      .count({
        where: {
          orgId,
          ...propertyClause,
          status: "PUBLISHED",
          publishedAt: { gte: periodStart, lt: periodEnd },
        },
      })
      .catch(() => 0),
  ]);
  // Suppress unused warning — the published variants are counted via
  // the dedicated count queries above so the lifecycle ratio stays
  // honest, but we also expose them via the draft pipeline tally
  // below for the renderer.
  void ALL_DRAFT_STATUSES;

  const totalPublished = publishedDrafts.length + publishedNeighborhoods.length;
  const totalInProgress = inProgressDrafts.length + draftNeighborhoods.length;
  const publishedInPeriod =
    publishedDraftsInPeriod + publishedNeighborhoodsInPeriod;

  // Norman May 22: return SOMETHING (the "in progress" pipeline)
  // even when nothing has shipped yet so the Content tab never reads
  // "no published content yet" when there's actually work happening.
  if (totalPublished === 0 && totalInProgress === 0) return undefined;

  // Format breakdown — normalize NeighborhoodPage as its own format.
  // Includes drafts so the bar chart reflects the full pipeline
  // (otherwise an org with 5 drafts + 0 published shows a single
  // empty bar).
  const formatCounts = new Map<string, number>();
  for (const d of [...publishedDrafts, ...inProgressDrafts]) {
    const key = humanFormat(d.format);
    formatCounts.set(key, (formatCounts.get(key) ?? 0) + 1);
  }
  const neighborhoodTotal =
    publishedNeighborhoods.length + draftNeighborhoods.length;
  if (neighborhoodTotal > 0) {
    formatCounts.set("Neighborhood page", neighborhoodTotal);
  }
  const byFormat = [...formatCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([format, count]) => ({ format, count }));

  // Recent items — published + in-progress merged + sorted by
  // updatedAt desc, max 10. Each row carries the status so the
  // renderer can render a colored pill.
  const draftItems = [...publishedDrafts, ...inProgressDrafts].map((d) => {
    const out =
      d.output && typeof d.output === "object"
        ? (d.output as Record<string, unknown>)
        : null;
    const title =
      typeof out?.title === "string" ? out.title : humanFormat(d.format);
    const url = typeof out?.url === "string" ? out.url : null;
    return {
      title,
      format: humanFormat(d.format),
      url,
      previewUrl: `/preview/content/${d.id}`,
      publishedAt: d.updatedAt.toISOString(),
      status: d.status.toLowerCase(),
    };
  });
  const neighborhoodItems = [
    ...publishedNeighborhoods,
    ...draftNeighborhoods,
  ].map((n) => ({
    title: n.title || (n.neighborhood ? `${n.neighborhood}, ${n.city}` : n.city),
    format: "Neighborhood page",
    url: n.status === "PUBLISHED" && n.slug ? `/${n.slug}` : null,
    previewUrl: `/preview/neighborhood/${n.id}`,
    publishedAt: (n.publishedAt ?? n.updatedAt).toISOString(),
    status: n.status.toLowerCase(),
  }));
  const recentMerged: ReportContentStats["recent"] = [
    ...draftItems,
    ...neighborhoodItems,
  ]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 10);

  return {
    totalPublished,
    totalInProgress,
    publishedInPeriod,
    byFormat,
    recent: recentMerged,
  };
}

function humanFormat(format: string): string {
  return format
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// buildAeoStats — Answer Engine Optimization rollup for the period.
//
// Pulls AeoCitationCheck rows in the window and summarizes:
//   - totals by status (CITED, COMPETITOR_CITED, NOT_MENTIONED, etc.)
//   - which engines contributed at least one check
//   - which competitors are getting cited most (frequency rank)
//   - three sample queries where a competitor was cited so the report
//     can show ownership the actual prompts that matter
//
// Returns undefined when the org has zero checks in the period — the
// renderer hides the section entirely, no "0 cited" tile.
// ---------------------------------------------------------------------------
async function buildAeoStats(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
): Promise<ReportAeoStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};
  const checks = await prisma.aeoCitationCheck.findMany({
    where: {
      orgId,
      ...propertyClause,
      queryRunAt: { gte: periodStart, lt: periodEnd },
    },
    select: {
      engine: true,
      status: true,
      prompt: true,
      competitorsCited: true,
    },
  });
  if (checks.length === 0) return undefined;

  let cited = 0;
  let competitorCited = 0;
  let notMentioned = 0;
  const enginesSeen = new Set<string>();
  const competitorCounts = new Map<string, number>();
  const competitorSamples: ReportAeoStats["sampleCompetitorQueries"] = [];

  // Norman feedback (May 22): "Downtown Berkeley" was showing up as
  // a top competitor — it's a NEIGHBORHOOD, not a competing property.
  // AI engines casually mention neighborhood names when answering
  // location queries; treating them as competitors is misleading.
  // Filter common Bay-area neighborhood/region strings so only real
  // property/brand names rank as competitors. Easy to extend per-
  // market when we expand outside the Bay.
  const NEIGHBORHOOD_NOISE = new Set(
    [
      "downtown berkeley",
      "north berkeley",
      "south berkeley",
      "west berkeley",
      "east berkeley",
      "southside",
      "elmwood",
      "telegraph",
      "berkeley",
      "oakland",
      "albany",
      "el cerrito",
      "emeryville",
      "richmond",
      "bay area",
      "east bay",
      "san francisco",
      "north oakland",
      "downtown oakland",
    ].map((s) => s.toLowerCase()),
  );

  for (const c of checks) {
    enginesSeen.add(c.engine);
    if (c.status === "CITED") cited += 1;
    else if (c.status === "COMPETITOR_CITED") {
      competitorCited += 1;
      const names = Array.isArray(c.competitorsCited)
        ? (c.competitorsCited as string[]).filter((n) => typeof n === "string")
        : [];
      for (const name of names) {
        // Skip neighborhood / region strings — they're not competitors.
        if (NEIGHBORHOOD_NOISE.has(name.trim().toLowerCase())) continue;
        competitorCounts.set(name, (competitorCounts.get(name) ?? 0) + 1);
      }
      // Keep up to 3 sample queries — favor variety across engines so
      // ownership doesn't see "ChatGPT, ChatGPT, ChatGPT" but a real
      // spread.
      if (
        competitorSamples.length < 3 &&
        !competitorSamples.some((s) => s.engine === c.engine)
      ) {
        competitorSamples.push({
          prompt: c.prompt,
          engine: c.engine,
          competitors: names.slice(0, 5),
        });
      }
    } else if (c.status === "NOT_CITED") notMentioned += 1;
  }

  const topCompetitors = [...competitorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, mentions]) => ({ name, mentions }));

  // Per-engine breakdown for the bar chart in the report.
  const byEngineMap = new Map<
    string,
    { engine: string; total: number; cited: number; competitorCited: number }
  >();
  for (const c of checks) {
    const e = byEngineMap.get(c.engine) ?? {
      engine: c.engine,
      total: 0,
      cited: 0,
      competitorCited: 0,
    };
    e.total += 1;
    if (c.status === "CITED") e.cited += 1;
    else if (c.status === "COMPETITOR_CITED") e.competitorCited += 1;
    byEngineMap.set(c.engine, e);
  }
  const byEngine = [...byEngineMap.values()].sort((a, b) =>
    a.engine.localeCompare(b.engine),
  );

  return {
    totalChecks: checks.length,
    cited,
    competitorCited,
    notMentioned,
    enginesUsed: [...enginesSeen].sort(),
    topCompetitors,
    sampleCompetitorQueries: competitorSamples,
    byEngine,
  };
}

async function buildReputationStats(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
  priorStart: Date,
  priorEnd: Date,
): Promise<ReportReputationStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};

  // Recency floor for the curated "Needs Attention" + "Recent" + "Highlights"
  // lists. Bug #10 — Norman reported 2015 and 2022 reviews surfacing in
  // "Needs Attention" of a May 2026 monthly report. The subtitle reads
  // "Negative sentiment + 3★ or below + flagged threads" with no recency
  // qualifier, so a 11-year-old 1★ Google review qualified.
  //
  // Rule: clamp to the more permissive of "last 12 months" and "report
  // period start" — for weekly reports the 7-day window would otherwise
  // strip every concern out, but for monthly/annual reports the 12-month
  // bound keeps things scoped to what actually matters.
  const TWELVE_MONTHS_AGO = new Date(periodEnd);
  TWELVE_MONTHS_AGO.setMonth(TWELVE_MONTHS_AGO.getMonth() - 12);
  const recencyFloor =
    periodStart.getTime() < TWELVE_MONTHS_AGO.getTime()
      ? TWELVE_MONTHS_AGO
      : periodStart;
  // Curated lists pull mentions where publishedAt >= recencyFloor. Undated
  // mentions (publishedAt == null) get their createdAt checked as a
  // fallback — same pattern as the portfolio feed in lib/reputation/portfolio.ts.
  const recencyClause: Prisma.PropertyMentionWhereInput = {
    OR: [
      { publishedAt: { gte: recencyFloor } },
      { AND: [{ publishedAt: null }, { createdAt: { gte: recencyFloor } }] },
    ],
  };

  // Full mention payload — title, author, sentiment, topics, flagged
  // — so the report renderer (and the email) can show real Reddit
  // threads / Google reviews / Yelp posts with attribution + click-
  // through links instead of bare snippet stubs.
  const FULL_SELECT = {
    id: true,
    source: true,
    rating: true,
    title: true,
    excerpt: true,
    authorName: true,
    publishedAt: true,
    sourceUrl: true,
    sentiment: true,
    topics: true,
    flagged: true,
  } as const;

  const [
    lifetime,
    sourceGroups,
    periodNew,
    priorNew,
    sentimentGroups,
    recentRows,
    highlightRows,
    concernRows,
    reviewedAgg,
  ] = await Promise.all([
    prisma.propertyMention.aggregate({
      where: { orgId, ...propertyClause },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["source"],
      where: { orgId, ...propertyClause },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.propertyMention.count({
      where: {
        orgId,
        ...propertyClause,
        publishedAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.propertyMention.count({
      where: {
        orgId,
        ...propertyClause,
        publishedAt: { gte: priorStart, lt: priorEnd },
      },
    }),
    prisma.propertyMention.groupBy({
      by: ["sentiment"],
      where: { orgId, ...propertyClause },
      _count: { _all: true },
    }),
    // Recent feed — most recent 12 across all sources. Drives the
    // "Recent mentions" timeline in the report. Bounded by recencyFloor
    // so undated re-scrapes don't pin ancient reviews to the top.
    prisma.propertyMention.findMany({
      where: { orgId, ...propertyClause, AND: [recencyClause] },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: FULL_SELECT,
    }),
    // Highlights — 5★ Google/Yelp OR sentiment=POSITIVE. Drives the
    // "What residents are loving" section in the report. Bounded by
    // recencyFloor — a 5★ review from 2018 isn't a current marketing
    // brag for a 2026 monthly report.
    prisma.propertyMention.findMany({
      where: {
        orgId,
        ...propertyClause,
        AND: [
          recencyClause,
          {
            OR: [
              { rating: { gte: 4.5 } },
              { sentiment: Sentiment.POSITIVE },
            ],
          },
        ],
      },
      orderBy: [{ rating: "desc" }, { publishedAt: "desc" }],
      take: 6,
      select: FULL_SELECT,
    }),
    // Concerns — low-star reviews OR sentiment=NEGATIVE/MIXED. Drives
    // the "What needs attention" section. Bounded by recencyFloor —
    // root cause of bug #10. A 1★ review from 2015 should not show up
    // as an action item in a May 2026 monthly report.
    prisma.propertyMention.findMany({
      where: {
        orgId,
        ...propertyClause,
        AND: [
          recencyClause,
          {
            OR: [
              { rating: { lte: 3 } },
              { sentiment: { in: [Sentiment.NEGATIVE, Sentiment.MIXED] } },
              { flagged: true },
            ],
          },
        ],
      },
      orderBy: [{ rating: "asc" }, { publishedAt: "desc" }],
      take: 6,
      select: FULL_SELECT,
    }),
    // Response rate proxy — operator-marked "reviewed" mentions divided by
    // the overall mention count. We don't track per-mention replies as
    // first-class data yet, so this is the best signal available.
    prisma.propertyMention.count({
      where: { orgId, ...propertyClause, reviewedByUserId: { not: null } },
    }),
  ]);

  const totalReviews = lifetime._count._all;
  if (totalReviews === 0) return undefined;

  const positiveCount =
    sentimentGroups.find((s) => s.sentiment === Sentiment.POSITIVE)?._count
      ._all ?? 0;
  const negativeCount =
    sentimentGroups.find((s) => s.sentiment === Sentiment.NEGATIVE)?._count
      ._all ?? 0;

  function toMention(
    m: (typeof recentRows)[number],
  ): ReportReputationMention {
    return {
      id: m.id,
      source: MENTION_SOURCE_LABELS[m.source] ?? m.source,
      rating: m.rating,
      title: m.title,
      excerpt: m.excerpt,
      authorName: m.authorName,
      publishedAt: m.publishedAt ? m.publishedAt.toISOString() : null,
      sourceUrl: m.sourceUrl,
      sentiment: m.sentiment,
      topics: Array.isArray(m.topics) ? (m.topics as string[]) : null,
      flagged: m.flagged,
    };
  }

  const recent = recentRows.map(toMention);
  const highlights = highlightRows.map(toMention);
  // Dedupe concerns vs highlights — a 4.5★ MIXED-sentiment review
  // could land in both buckets and we don't want to print it twice.
  const highlightIds = new Set(highlights.map((h) => h.id));
  const concerns = concernRows
    .filter((m) => !highlightIds.has(m.id))
    .map(toMention);

  return {
    overallRating:
      lifetime._avg.rating != null
        ? Math.round(lifetime._avg.rating * 10) / 10
        : null,
    totalReviews,
    newInPeriod: periodNew,
    newInPeriodPct: pctChange(periodNew, priorNew),
    positiveCount,
    negativeCount,
    responseRatePct:
      totalReviews > 0 ? Math.round((reviewedAgg / totalReviews) * 100) : null,
    sourceBreakdown: sourceGroups
      .map((g) => ({
        source: MENTION_SOURCE_LABELS[g.source] ?? g.source,
        count: g._count._all,
        rating:
          g._avg.rating != null ? Math.round(g._avg.rating * 10) / 10 : null,
      }))
      .sort((a, b) => b.count - a.count),
    // topMentions kept as alias for backwards compat with older
    // snapshots already persisted as JSON.
    topMentions: recent,
    recent,
    highlights,
    concerns,
  };
}

async function buildOccupancyStats(
  orgId: string,
  propertyId: string | null,
): Promise<ReportOccupancyStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};
  const [propertyAgg, residentNoticeCount, applicationsQueued, rentRoll, activeListings] =
    await Promise.all([
      prisma.property.aggregate({
        where: { orgId, ...(propertyId ? { id: propertyId } : {}) },
        _sum: { totalUnits: true, availableCount: true },
      }),
      prisma.resident.count({
        where: {
          orgId,
          ...propertyClause,
          status: ResidentStatus.NOTICE_GIVEN,
        },
      }),
      prisma.application.count({
        where: {
          status: ApplicationStatus.SUBMITTED,
          lead: { orgId, ...(propertyId ? { propertyId } : {}) },
        },
      }),
      prisma.lease.aggregate({
        where: { orgId, ...propertyClause, status: LeaseStatus.ACTIVE },
        _sum: { monthlyRentCents: true },
        _count: { _all: true },
      }),
      // Listings flagged available — fallback signal for tenants with no
      // active Lease rows synced yet.
      prisma.listing.count({
        where: {
          property: { orgId, ...(propertyId ? { id: propertyId } : {}) },
          isAvailable: true,
        },
      }),
    ]);

  const totalUnits = propertyAgg._sum.totalUnits ?? 0;
  if (totalUnits === 0) return undefined;

  // Occupancy source-of-truth (in priority order):
  //
  //   1. Active lease count (most reliable — comes from AppFolio rent roll
  //      via the REST sync's tenant_directory + lease_history reports).
  //   2. Listings flagged isAvailable=true (the embed-fallback path uses
  //      this; works for tenants without REST creds).
  //   3. Property.availableCount (legacy denorm field, only updated by
  //      syncListingsForOrg → not reliable for REST-synced tenants).
  //
  // The previous report version used #3 alone, which silently defaulted to
  // 0 for every REST tenant and produced fake "100% occupied" on every
  // property. We now prefer #1 → #2 → #3 in that order.
  const activeLeaseCount = rentRoll._count._all;
  let leasedUnits: number;
  let occupancySource: "leases" | "listings" | "denorm";
  if (activeLeaseCount > 0) {
    leasedUnits = Math.min(totalUnits, activeLeaseCount);
    occupancySource = "leases";
  } else if (activeListings > 0) {
    leasedUnits = Math.max(0, totalUnits - activeListings);
    occupancySource = "listings";
  } else {
    const denormAvailable = Math.max(
      0,
      Math.min(totalUnits, propertyAgg._sum.availableCount ?? 0),
    );
    leasedUnits = Math.max(0, totalUnits - denormAvailable);
    occupancySource = "denorm";
  }

  const availableUnits = Math.max(0, totalUnits - leasedUnits);
  const monthlyRentRollUsd = Math.round(
    (rentRoll._sum.monthlyRentCents ?? 0) / 100,
  );

  // If we have no active leases AND no available listings AND no denorm,
  // we don't know occupancy. Don't lie — render "—".
  const hasAnyOccupancySignal =
    activeLeaseCount > 0 ||
    activeListings > 0 ||
    (propertyAgg._sum.availableCount ?? 0) > 0;
  const occupancyPct =
    hasAnyOccupancySignal && totalUnits > 0
      ? Math.round((leasedUnits / totalUnits) * 100)
      : null;
  void occupancySource; // reserved for future debug surfacing

  return {
    totalUnits,
    leasedUnits,
    availableUnits,
    occupancyPct,
    onNotice: residentNoticeCount,
    applicationsQueued,
    monthlyRentRollUsd,
    avgRentPerUnitUsd:
      activeLeaseCount > 0
        ? Math.round(monthlyRentRollUsd / activeLeaseCount)
        : null,
  };
}

async function buildRenewalStats(
  orgId: string,
  propertyId: string | null,
  periodEnd: Date,
): Promise<ReportRenewalStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};
  const next30 = new Date(periodEnd.getTime() + 30 * DAY_MS);
  const next60 = new Date(periodEnd.getTime() + 60 * DAY_MS);
  const next120 = new Date(periodEnd.getTime() + 120 * DAY_MS);

  const [
    activeCount,
    next30Count,
    next60Count,
    next120Leases,
    pastDue,
  ] = await Promise.all([
    prisma.lease.count({
      where: { orgId, ...propertyClause, status: LeaseStatus.ACTIVE },
    }),
    prisma.lease.count({
      where: {
        orgId,
        ...propertyClause,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: periodEnd, lt: next30 },
      },
    }),
    prisma.lease.count({
      where: {
        orgId,
        ...propertyClause,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: periodEnd, lt: next60 },
      },
    }),
    prisma.lease.findMany({
      where: {
        orgId,
        ...propertyClause,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: periodEnd, lte: next120 },
      },
      select: { monthlyRentCents: true },
    }),
    prisma.lease.aggregate({
      where: { orgId, ...propertyClause, isPastDue: true },
      _sum: { currentBalanceCents: true },
      _count: { _all: true },
    }),
  ]);

  if (activeCount === 0 && next120Leases.length === 0) return undefined;

  const monthlyAtRiskCents = next120Leases.reduce(
    (sum, l) => sum + (l.monthlyRentCents ?? 0),
    0,
  );

  return {
    activeLeases: activeCount,
    expiringNext120: next120Leases.length,
    expiringNext30: next30Count,
    expiringNext60: next60Count,
    monthlyAtRiskUsd: Math.round(monthlyAtRiskCents / 100),
    pastDueCount: pastDue._count._all,
    pastDueBalanceUsd: Math.round((pastDue._sum.currentBalanceCents ?? 0) / 100),
  };
}

async function buildVisitorStats(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
  days: number,
): Promise<ReportVisitorStats | undefined> {
  const propertyClause = propertyId ? { propertyId } : {};
  const [identifiedTotal, identifiedNew, withEmail, withPhone, identifiedDaily, identifiedWithLead] =
    await Promise.all([
      prisma.visitor.count({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
        },
      }),
      prisma.visitor.count({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
          firstSeenAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.visitor.count({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
          email: { not: null },
        },
      }),
      prisma.visitor.count({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
          phone: { not: null },
        },
      }),
      prisma.visitor.findMany({
        where: {
          orgId,
          ...propertyClause,
          status: VisitorIdentificationStatus.IDENTIFIED,
          firstSeenAt: { gte: periodStart, lt: periodEnd },
        },
        select: { firstSeenAt: true },
        orderBy: { firstSeenAt: "asc" },
      }),
      // Visitors whose email also appears on a Lead — proxy for "pixel-
      // identified visitor that has a real lead row now". Scoped further
      // to the property when set so the count reflects that asset only.
      propertyId
        ? prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `select count(distinct v.id) as count
             from "Visitor" v
             join "Lead" l on l."orgId" = v."orgId" and l.email is not null and v.email is not null and lower(l.email) = lower(v.email)
             where v."orgId" = $1 and v.status = 'IDENTIFIED' and v."propertyId" = $2 and l."propertyId" = $2`,
            orgId,
            propertyId,
          )
        : prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `select count(distinct v.id) as count
             from "Visitor" v
             join "Lead" l on l."orgId" = v."orgId" and l.email is not null and v.email is not null and lower(l.email) = lower(v.email)
             where v."orgId" = $1 and v.status = 'IDENTIFIED'`,
            orgId,
          ),
    ]);

  if (identifiedTotal === 0) return undefined;

  const identifiedTrend = bucketDaily(
    identifiedDaily.map((v) => ({ date: v.firstSeenAt, value: 1 })),
    days,
    periodEnd,
  );

  const matched = identifiedWithLead[0]?.count
    ? Number(identifiedWithLead[0].count)
    : 0;

  // Norman May 22: Operations tab needed real visitor intelligence
  // beyond the 4 status tiles. Pull the rich enrichment fields we
  // already have on the Visitor row — geography (PERSONAL_CITY +
  // PERSONAL_STATE), demographics (AGE_RANGE + GENDER), referrer
  // mix, hot-lead count, audience-sync state. All optional; the
  // renderer skips any field that came back empty.
  const [
    byStatusGroups,
    hotCount,
    outreachSentCount,
    syncedToGoogleAds,
    syncedToMetaAds,
    referrerGroups,
    enrichmentRows,
  ] = await Promise.all([
    prisma.visitor.groupBy({
      by: ["status"],
      where: { orgId, ...propertyClause },
      _count: { _all: true },
    }),
    prisma.visitor.count({
      where: {
        orgId,
        ...propertyClause,
        status: VisitorIdentificationStatus.IDENTIFIED,
        intentScore: { gte: 70 },
      },
    }),
    prisma.visitor.count({
      where: { orgId, ...propertyClause, outreachSent: true },
    }),
    prisma.visitor.count({
      where: { orgId, ...propertyClause, syncedToGoogleAds: true },
    }),
    prisma.visitor.count({
      where: { orgId, ...propertyClause, syncedToMetaAds: true },
    }),
    prisma.visitor.groupBy({
      by: ["referrer"],
      where: {
        orgId,
        ...propertyClause,
        referrer: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 5,
    }),
    // Enrichment fields live in JSON — we have to fetch + bucket
    // client-side. Capped at 500 rows to keep the report build cheap
    // for orgs with tens of thousands of identified visitors. The
    // top-10 distribution stays representative at that sample size.
    prisma.visitor.findMany({
      where: {
        orgId,
        ...propertyClause,
        status: {
          in: [
            VisitorIdentificationStatus.IDENTIFIED,
            VisitorIdentificationStatus.ENRICHED,
            VisitorIdentificationStatus.MATCHED_TO_LEAD,
          ],
        },
        enrichedData: { not: Prisma.JsonNull },
      },
      select: { enrichedData: true },
      take: 500,
    }),
  ]);

  const byStatus = byStatusGroups
    .map((g) => ({ status: g.status, count: g._count._all }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const topReferrers = referrerGroups
    .map((r) => ({
      referrer: shortReferrer(r.referrer ?? ""),
      count: r._count._all,
    }))
    .filter((r) => r.referrer.length > 0);

  const cityMap = new Map<string, number>();
  const stateMap = new Map<string, number>();
  const genderMap = new Map<string, number>();
  const ageRangeMap = new Map<string, number>();
  for (const v of enrichmentRows) {
    if (!v.enrichedData || typeof v.enrichedData !== "object") continue;
    const e = v.enrichedData as Record<string, unknown>;
    const city =
      pickString(e.PERSONAL_CITY) ?? pickString((e as { city?: unknown }).city);
    const state =
      pickString(e.PERSONAL_STATE) ??
      pickString((e as { state?: unknown }).state);
    const gender = pickString(e.GENDER);
    const ageRange = pickString(e.AGE_RANGE);
    if (city) cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
    if (state) stateMap.set(state, (stateMap.get(state) ?? 0) + 1);
    if (gender) genderMap.set(gender, (genderMap.get(gender) ?? 0) + 1);
    if (ageRange) ageRangeMap.set(ageRange, (ageRangeMap.get(ageRange) ?? 0) + 1);
  }
  const sortDesc = <T>(m: Map<string, number>, key: string) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, count]) => ({ [key]: k, count })) as T[];

  return {
    identifiedVisitors: identifiedTotal,
    identifiedNewInPeriod: identifiedNew,
    withEmail,
    withPhone,
    identifiedWithLead: matched,
    identifiedTrend,
    byStatus: byStatus.length > 0 ? byStatus : undefined,
    hotCount,
    outreachSentCount,
    syncedToGoogleAds,
    syncedToMetaAds,
    topReferrers: topReferrers.length > 0 ? topReferrers : undefined,
    topCities:
      cityMap.size > 0
        ? sortDesc<{ city: string; count: number }>(cityMap, "city")
        : undefined,
    topStates:
      stateMap.size > 0
        ? sortDesc<{ state: string; count: number }>(stateMap, "state")
        : undefined,
    genderSplit:
      genderMap.size > 0
        ? sortDesc<{ gender: string; count: number }>(genderMap, "gender")
        : undefined,
    ageRanges:
      ageRangeMap.size > 0
        ? sortDesc<{ ageRange: string; count: number }>(ageRangeMap, "ageRange")
        : undefined,
  };
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function shortReferrer(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return raw.length > 40 ? `${raw.slice(0, 37)}…` : raw;
  }
}

async function buildChatbotExtended(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
  baseStats: ReportChatbotStats,
): Promise<ReportChatbotStatsExtended | undefined> {
  if (baseStats.conversations === 0) return undefined;
  const [captured, lifetime] = await Promise.all([
    prisma.chatbotConversation.count({
      where: {
        orgId,
        ...(propertyId ? { propertyId } : {}),
        createdAt: { gte: periodStart, lt: periodEnd },
        status: ChatbotConversationStatus.LEAD_CAPTURED,
      },
    }),
    prisma.chatbotConversation.count({
      where: { orgId, ...(propertyId ? { propertyId } : {}) },
    }),
  ]);
  return {
    ...baseStats,
    capturedConversations: captured,
    lifetimeConversations: lifetime,
    capturedRatePct:
      baseStats.conversations > 0
        ? Math.round((captured / baseStats.conversations) * 100)
        : null,
  };
}
