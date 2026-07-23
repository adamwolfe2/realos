import type { ReportSnapshot } from "@/lib/reports/generate";
import type { PropertyMeta } from "@/components/portal/reports/snapshot-shared";

// ---------------------------------------------------------------------------
// Sample report data (landing v3 item 1) — a fully-typed demo ReportSnapshot
// so the homepage renders the REAL PropertyOnePager artifact instead of a
// hand-built mock. Numbers are the canonical demo set used across the site
// (funnel 12,480 → 168 → 31 → 11 → 4; sources 36/27/18/10/9) and are always
// labeled as sample. organicSessions is 0 on purpose: it drives the honest
// blue "GA4 and Search Console: indexing" coverage state in the footer.
// ---------------------------------------------------------------------------

export const SAMPLE_PROPERTY: PropertyMeta = {
  name: "Student Central (Sample)",
  addressLine1: "2400 College Ave",
  city: "Berkeley",
  state: "CA",
};

export const SAMPLE_SNAPSHOT: ReportSnapshot = {
  kind: "monthly",
  periodStart: "2026-06-22",
  periodEnd: "2026-07-20",
  kpis: {
    leads: 168,
    identifiedVisitors: 312,
    tours: 31,
    applications: 11,
    costPerLead: 109,
    adSpendUsd: 18240,
    organicSessions: 0,
  },
  kpiDeltas: {
    leadsPct: 14,
    identifiedVisitorsPct: 9,
    toursPct: 8,
    applicationsPct: 12,
    costPerLeadPct: -9,
    adSpendUsdPct: -6,
    organicSessionsPct: null,
  },
  funnel: [
    { stage: "Visitors", count: 12480 },
    { stage: "Leads", count: 168 },
    { stage: "Tours", count: 31 },
    { stage: "Applications", count: 11 },
    { stage: "Signed leases", count: 4 },
  ],
  leadSources: [
    { source: "Google Ads", count: 60, pct: 36 },
    { source: "Meta", count: 45, pct: 27 },
    { source: "Organic search", count: 30, pct: 18 },
    { source: "Resident referral", count: 17, pct: 10 },
    { source: "Direct / brand", count: 16, pct: 9 },
  ],
  adPerformance: [
    { platform: "Google Ads", spendUsd: 11040, leads: 60, cpl: 184, conversionRate: 3.2 },
    { platform: "Meta", spendUsd: 7200, leads: 45, cpl: 160, conversionRate: 2.8 },
  ],
  topPages: [],
  topQueries: [],
  insights: [],
  chatbotStats: { conversations: 89, leadsFromChat: 34, avgMessageCount: 6 },
  chatbotStatsExtended: {
    conversations: 89,
    leadsFromChat: 34,
    avgMessageCount: 6,
    capturedRatePct: 38,
    capturedConversations: 34,
    lifetimeConversations: 214,
  },
  properties: [],
  // 28 days of site traffic with a weekday rhythm; sums ≈ 12,480.
  trafficTrend: [
    412, 398, 441, 455, 468, 352, 331, 428, 447, 462, 471, 489, 366, 342,
    451, 470, 483, 492, 508, 371, 358, 472, 491, 502, 517, 530, 384, 369,
  ],
  attributionBySource: [],
  aiVisibility: null,
  reputationStats: {
    overallRating: 4.6,
    totalReviews: 128,
    newInPeriod: 9,
    newInPeriodPct: 7,
    positiveCount: 104,
    negativeCount: 11,
    responseRatePct: 92,
    sourceBreakdown: [
      { source: "Google", count: 74, rating: 4.7 },
      { source: "Yelp", count: 26, rating: 4.2 },
      { source: "Reddit", count: 18, rating: null },
      { source: "Facebook", count: 10, rating: 4.8 },
    ],
    topMentions: [],
    recent: [],
    highlights: [],
    concerns: [],
  },
  occupancyStats: {
    totalUnits: 96,
    leasedUnits: 87,
    availableUnits: 9,
    occupancyPct: 90.6,
    onNotice: 3,
    applicationsQueued: 11,
    monthlyRentRollUsd: 168400,
    avgRentPerUnitUsd: 1936,
  },
  renewalStats: {
    activeLeases: 87,
    expiringNext120: 19,
    expiringNext30: 6,
    expiringNext60: 11,
    monthlyAtRiskUsd: 36800,
    pastDueCount: 4,
    pastDueBalanceUsd: 6120,
  },
  aeoStats: {
    totalChecks: 48,
    cited: 19,
    competitorCited: 17,
    notMentioned: 12,
    enginesUsed: ["CHATGPT", "CLAUDE", "PERPLEXITY", "GEMINI"],
    topCompetitors: [
      { name: "The Standard Berkeley", mentions: 7 },
      { name: "Varsity House", mentions: 5 },
      { name: "Bancroft Commons", mentions: 3 },
      { name: "Southside Lofts", mentions: 2 },
    ],
    sampleCompetitorQueries: [],
    byEngine: [
      { engine: "CHATGPT", total: 12, cited: 5, competitorCited: 4 },
      { engine: "CLAUDE", total: 12, cited: 6, competitorCited: 3 },
      { engine: "PERPLEXITY", total: 15, cited: 8, competitorCited: 5 },
      { engine: "GEMINI", total: 9, cited: 0, competitorCited: 5 },
    ],
  },
  lifecycleStats: {
    leasesSignedInPeriod: 4,
    priorLeasesSignedInPeriod: 2,
    leasesSignedLast180d: 19,
    activeLeases: 87,
    monthlySignedLast12: [
      { month: "Aug", count: 9 },
      { month: "Sep", count: 4 },
      { month: "Oct", count: 2 },
      { month: "Nov", count: 1 },
      { month: "Dec", count: 1 },
      { month: "Jan", count: 6 },
      { month: "Feb", count: 5 },
      { month: "Mar", count: 3 },
      { month: "Apr", count: 2 },
      { month: "May", count: 2 },
      { month: "Jun", count: 3 },
      { month: "Jul", count: 4 },
    ],
    applicationsInPeriod: 11,
    applicationsApprovedInPeriod: 7,
    applicationsSubmittedInPeriod: 11,
  },
};
