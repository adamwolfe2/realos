import "server-only";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  AdPlatform,
  LeadSource,
  LeadStatus,
  MentionSource,
  Sentiment,
  SeoProvider,
  SeoSyncStatus,
  TourStatus,
  VisitorIdentificationStatus,
} from "@prisma/client";
import type { LeadSourceSlice } from "@/components/portal/dashboard/lead-source-donut";
import type {
  ActivityItem,
  ActivityKind,
} from "@/components/portal/dashboard/activity-feed";
import type {
  IntegrationChip,
  IntegrationStatus as IntegrationChipStatus,
} from "@/components/portal/dashboard/integration-health";

// ---------------------------------------------------------------------------
// Dashboard query helpers (real Prisma data).
//
// One file, one consistent shape per tile so /portal/page.tsx can stay focused
// on layout. Every helper is tenant-scoped on `orgId` and parallel-safe — the
// caller is expected to fan them all out via Promise.all.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 28;
const HOT_VISITOR_WINDOW_MS = 5 * 60 * 1000;
const ENGAGED_TIME_SECONDS = 30;

// Active campaign statuses across both ad platforms.
//   Google Ads -> ENABLED
//   Meta       -> ACTIVE
const ACTIVE_CAMPAIGN_STATUSES = ["ENABLED", "ACTIVE"];

// ---------------------------------------------------------------------------
// Hot visitors right now
// ---------------------------------------------------------------------------

export async function getHotVisitors(orgId: string) {
  const now = Date.now();
  const since5m = new Date(now - HOT_VISITOR_WINDOW_MS);
  const since24h = new Date(now - DAY_MS);

  const [hotCount, recentSessions] = await Promise.all([
    prisma.visitorSession.count({
      where: { orgId, lastEventAt: { gte: since5m } },
    }),
    prisma.visitorSession.findMany({
      where: { orgId, startedAt: { gte: since24h } },
      select: { startedAt: true },
    }),
  ]);

  // Bucket sessions per hour over the last 24h (oldest -> newest).
  const buckets = new Array<number>(24).fill(0);
  for (const row of recentSessions) {
    const ageMs = now - row.startedAt.getTime();
    if (ageMs < 0 || ageMs >= DAY_MS) continue;
    const idx = 23 - Math.floor(ageMs / (60 * 60 * 1000));
    if (idx >= 0 && idx < 24) buckets[idx] += 1;
  }

  return { count: hotCount, sparkline: buckets };
}

// ---------------------------------------------------------------------------
// Ad spend (28d) + Cost per lead
// ---------------------------------------------------------------------------

export async function getAdSpendKpi(orgId: string) {
  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  const since56d = new Date(Date.now() - 2 * WINDOW_DAYS * DAY_MS);

  // Filter by adAccount.credentialsEncrypted so seeded fake metrics
  // (Telegraph Commons demo data) don't leak into the dashboard KPI
  // when the tenant hasn't actually connected an ad account.
  const realAccount = { adAccount: { credentialsEncrypted: { not: null } } };

  const [current, previous, dailyRows] = await Promise.all([
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: since28d }, ...realAccount },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: since56d, lt: since28d }, ...realAccount },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.groupBy({
      by: ["date"],
      where: { orgId, date: { gte: since28d }, ...realAccount },
      _sum: { spendCents: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const currentCents = current._sum.spendCents ?? 0;
  const previousCents = previous._sum.spendCents ?? 0;

  const sparkline = bucketDailyTotals(
    dailyRows.map((r) => ({
      date: r.date,
      value: (r._sum.spendCents ?? 0) / 100,
    })),
    WINDOW_DAYS,
  );

  return {
    spendUsd: Math.round(currentCents / 100),
    previousSpendUsd: Math.round(previousCents / 100),
    deltaPct: pctChange(currentCents, previousCents),
    sparkline,
  };
}

// ---------------------------------------------------------------------------
// Organic sessions (28d)
// ---------------------------------------------------------------------------

export async function getOrganicSessionsKpi(orgId: string) {
  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  const since56d = new Date(Date.now() - 2 * WINDOW_DAYS * DAY_MS);

  // Gate on a real SEO integration. Seeded demo rows use the literal
  // string "DEMO_SEED" for the encrypted JSON; if the org's only
  // SeoIntegration is a demo row, treat snapshots as 0 so the KPI tile
  // doesn't broadcast fake organic traffic numbers.
  const realSeo = await prisma.seoIntegration.findFirst({
    where: {
      orgId,
      serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
    },
    select: { id: true },
  });
  if (!realSeo) {
    return {
      sessions: 0,
      previousSessions: 0,
      deltaPct: 0,
      sparkline: bucketDailyTotals([], WINDOW_DAYS),
    };
  }

  const [snapshots, prevSnapshots] = await Promise.all([
    prisma.seoSnapshot.findMany({
      where: { orgId, date: { gte: since28d } },
      select: { date: true, organicSessions: true },
      orderBy: { date: "asc" },
    }),
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: since56d, lt: since28d } },
      _sum: { organicSessions: true },
    }),
  ]);

  const total = snapshots.reduce((acc, s) => acc + (s.organicSessions ?? 0), 0);
  const previousTotal = prevSnapshots._sum.organicSessions ?? 0;
  const sparkline = bucketDailyTotals(
    snapshots.map((s) => ({ date: s.date, value: s.organicSessions ?? 0 })),
    WINDOW_DAYS,
  );

  return {
    sessions: total,
    previousSessions: previousTotal,
    deltaPct: pctChange(total, previousTotal),
    sparkline,
  };
}

// ---------------------------------------------------------------------------
// Lead source donut (28d)
// ---------------------------------------------------------------------------

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

export async function getLeadSourceBreakdown(orgId: string): Promise<LeadSourceSlice[]> {
  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  const grouped = await prisma.lead.groupBy({
    by: ["source"],
    where: { orgId, createdAt: { gte: since28d } },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({
      source: LEAD_SOURCE_LABELS[row.source] ?? row.source,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Conversion funnel (28d)
//
// Visitors  -> distinct VisitorSession.anonymousId
// Engaged   -> sessions with pageviewCount > 1 OR totalTimeSeconds > 30
// Leads     -> Lead.createdAt in window
// Tours     -> Tour where lead.orgId matches and tour status implies booked/done
// Apps      -> Application where lead.orgId matches
// ---------------------------------------------------------------------------

export async function getFunnel(orgId: string) {
  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  const [
    visitorRows,
    engagedCount,
    leadsCount,
    toursCount,
    applicationsCount,
  ] = await Promise.all([
    prisma.visitorSession.findMany({
      where: { orgId, startedAt: { gte: since28d } },
      select: { anonymousId: true },
      distinct: ["anonymousId"],
    }),
    prisma.visitorSession.count({
      where: {
        orgId,
        startedAt: { gte: since28d },
        OR: [
          { pageviewCount: { gt: 1 } },
          { totalTimeSeconds: { gt: ENGAGED_TIME_SECONDS } },
        ],
      },
    }),
    prisma.lead.count({
      where: { orgId, createdAt: { gte: since28d } },
    }),
    prisma.tour.count({
      where: {
        createdAt: { gte: since28d },
        status: {
          in: [TourStatus.SCHEDULED, TourStatus.COMPLETED],
        },
        lead: { orgId },
      },
    }),
    prisma.application.count({
      where: {
        createdAt: { gte: since28d },
        lead: { orgId },
      },
    }),
  ]);

  return [
    { label: "Visitors", value: visitorRows.length },
    { label: "Engaged", value: engagedCount },
    { label: "Leads", value: leadsCount },
    { label: "Tours", value: toursCount },
    { label: "Applications", value: applicationsCount },
  ];
}

// ---------------------------------------------------------------------------
// Per-property metrics: 28d leads count, active campaigns, leads sparkline
// ---------------------------------------------------------------------------

export type PropertyMetrics = {
  leads28d: number;
  leadsSpark: number[];
  activeCampaigns: number;
  // Reputation roll-up so the dashboard property card can surface review
  // health without needing a second fetch round-trip.
  reputationMentionCount: number;
  reputationNegativeCount: number;
  reputationUnreviewedCount: number;
};

export async function getPropertyMetrics(
  orgId: string,
  propertyIds: string[],
): Promise<Map<string, PropertyMetrics>> {
  const out = new Map<string, PropertyMetrics>();
  if (propertyIds.length === 0) return out;

  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  const [
    leadGroups,
    campaignGroups,
    allLeadDates,
    mentionTotals,
    mentionNegative,
    mentionUnreviewed,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        createdAt: { gte: since28d },
        propertyId: { in: propertyIds },
      },
      _count: { _all: true },
    }),
    prisma.adCampaign.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        propertyId: { in: propertyIds },
        status: { in: ACTIVE_CAMPAIGN_STATUSES },
      },
      _count: { _all: true },
    }),
    prisma.lead.findMany({
      where: {
        orgId,
        createdAt: { gte: since28d },
        propertyId: { in: propertyIds },
      },
      select: { propertyId: true, createdAt: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["propertyId"],
      where: { orgId, propertyId: { in: propertyIds } },
      _count: { _all: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        propertyId: { in: propertyIds },
        sentiment: "NEGATIVE",
      },
      _count: { _all: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        propertyId: { in: propertyIds },
        reviewedByUserId: null,
      },
      _count: { _all: true },
    }),
  ]);

  const leadCountByProp = new Map<string, number>();
  for (const row of leadGroups) {
    if (!row.propertyId) continue;
    leadCountByProp.set(row.propertyId, row._count._all);
  }

  const campaignCountByProp = new Map<string, number>();
  for (const row of campaignGroups) {
    if (!row.propertyId) continue;
    campaignCountByProp.set(row.propertyId, row._count._all);
  }

  const sparkByProp = new Map<string, number[]>();
  for (const row of allLeadDates) {
    if (!row.propertyId) continue;
    const arr = sparkByProp.get(row.propertyId) ?? new Array<number>(WINDOW_DAYS).fill(0);
    const idx = dayBucketIndex(row.createdAt, WINDOW_DAYS);
    if (idx >= 0 && idx < WINDOW_DAYS) arr[idx] += 1;
    sparkByProp.set(row.propertyId, arr);
  }

  const mentionTotalByProp = new Map<string, number>();
  for (const row of mentionTotals) {
    mentionTotalByProp.set(row.propertyId, row._count._all);
  }
  const mentionNegativeByProp = new Map<string, number>();
  for (const row of mentionNegative) {
    mentionNegativeByProp.set(row.propertyId, row._count._all);
  }
  const mentionUnreviewedByProp = new Map<string, number>();
  for (const row of mentionUnreviewed) {
    mentionUnreviewedByProp.set(row.propertyId, row._count._all);
  }

  for (const id of propertyIds) {
    out.set(id, {
      leads28d: leadCountByProp.get(id) ?? 0,
      leadsSpark: sparkByProp.get(id) ?? new Array<number>(WINDOW_DAYS).fill(0),
      activeCampaigns: campaignCountByProp.get(id) ?? 0,
      reputationMentionCount: mentionTotalByProp.get(id) ?? 0,
      reputationNegativeCount: mentionNegativeByProp.get(id) ?? 0,
      reputationUnreviewedCount: mentionUnreviewedByProp.get(id) ?? 0,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Activity feed
//
// Union the most recent items across leads, tours, engaged visitor sessions,
// and chatbot conversations. Returns up to `limit` entries sorted desc.
// ---------------------------------------------------------------------------

export async function getActivityFeed(
  orgId: string,
  limit = 10,
): Promise<ActivityItem[]> {
  const lookbackDays = 14;
  const since = new Date(Date.now() - lookbackDays * DAY_MS);
  const fetchEach = Math.max(limit, 10);

  const [recentLeads, recentTours, recentSessions, recentChats] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: fetchEach,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        source: true,
        createdAt: true,
        property: { select: { name: true } },
      },
    }),
    prisma.tour.findMany({
      where: {
        lead: { orgId },
        status: TourStatus.SCHEDULED,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: fetchEach,
      select: {
        id: true,
        scheduledAt: true,
        createdAt: true,
        property: { select: { name: true } },
        lead: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.visitorSession.findMany({
      where: {
        orgId,
        startedAt: { gte: since },
        OR: [
          { pageviewCount: { gt: 1 } },
          { totalTimeSeconds: { gt: ENGAGED_TIME_SECONDS } },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: fetchEach,
      select: {
        id: true,
        startedAt: true,
        pageviewCount: true,
        firstUrl: true,
        utmSource: true,
        country: true,
      },
    }),
    prisma.chatbotConversation.findMany({
      where: { orgId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: fetchEach,
      select: {
        id: true,
        createdAt: true,
        capturedEmail: true,
        capturedName: true,
        property: { select: { name: true } },
      },
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const lead of recentLeads) {
    const name = displayName(lead.firstName, lead.lastName);
    items.push({
      id: `lead-${lead.id}`,
      kind: "lead",
      title: `New lead from ${LEAD_SOURCE_LABELS[lead.source] ?? lead.source}`,
      meta: [name, lead.property?.name].filter(Boolean).join(" \u00b7 ") || undefined,
      href: "/portal/leads",
      at: lead.createdAt,
    });
  }

  for (const tour of recentTours) {
    const when = tour.scheduledAt
      ? formatDateShort(tour.scheduledAt)
      : "scheduled";
    items.push({
      id: `tour-${tour.id}`,
      kind: "tour",
      title: `Tour booked for ${when}`,
      meta: [tour.property?.name, displayName(tour.lead?.firstName, tour.lead?.lastName)]
        .filter(Boolean)
        .join(" \u00b7 ") || undefined,
      href: "/portal/leads",
      at: tour.createdAt,
    });
  }

  for (const s of recentSessions) {
    const path = s.firstUrl ? safeShortPath(s.firstUrl) : null;
    items.push({
      id: `session-${s.id}`,
      kind: "visitor",
      title: path
        ? `Engaged visitor on ${path}`
        : "Engaged visitor on your site",
      meta:
        [s.utmSource && `via ${s.utmSource}`, s.country, `${s.pageviewCount} pages`]
          .filter(Boolean)
          .join(" \u00b7 ") || undefined,
      href: "/portal/visitors",
      at: s.startedAt,
    });
  }

  for (const c of recentChats) {
    const captured = c.capturedEmail
      ? "Captured email"
      : c.capturedName
        ? "Conversation started"
        : "Conversation started";
    items.push({
      id: `chat-${c.id}`,
      kind: "chatbot",
      title: `Chatbot \u2014 ${captured}`,
      meta: c.property?.name ?? undefined,
      href: "/portal/conversations",
      at: c.createdAt,
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Integration health row
// ---------------------------------------------------------------------------

export async function getIntegrationHealth(orgId: string): Promise<IntegrationChip[]> {
  const recentEventCutoff = new Date(Date.now() - 7 * DAY_MS);

  const [seo, ads, appfolio, cursive, recentPixelEvent] = await Promise.all([
    // Filter out demo-seeded SEO integrations and ad accounts so the
    // dashboard health row only reports on real, credentialed connections.
    prisma.seoIntegration.findMany({
      where: {
        orgId,
        serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
      },
      select: { provider: true, status: true, lastSyncAt: true },
    }),
    prisma.adAccount.findMany({
      where: { orgId, credentialsEncrypted: { not: null } },
      select: { platform: true, accessStatus: true, lastSyncAt: true },
    }),
    prisma.appFolioIntegration.findUnique({
      where: { orgId },
      select: {
        instanceSubdomain: true,
        clientIdEncrypted: true,
        apiKeyEncrypted: true,
        syncStatus: true,
        lastSyncAt: true,
      },
    }),
    // Dashboard "is the pixel firing?" badge — surface ANY active
    // pixel for the org. Multi-property tenants might have several;
    // pick the most-recently-active so the badge reflects reality.
    prisma.cursiveIntegration.findFirst({
      where: { orgId, cursivePixelId: { not: null } },
      orderBy: [{ lastEventAt: "desc" }],
      select: { cursivePixelId: true, lastEventAt: true },
    }),
    prisma.visitorEvent.findFirst({
      where: { orgId, occurredAt: { gte: recentEventCutoff } },
      select: { id: true },
    }),
  ]);

  const seoBy = new Map<SeoProvider, { status: SeoSyncStatus; lastSyncAt: Date | null }>();
  for (const s of seo) {
    seoBy.set(s.provider, { status: s.status, lastSyncAt: s.lastSyncAt ?? null });
  }
  const adsBy = new Map<AdPlatform, { accessStatus: string | null; lastSyncAt: Date | null }>();
  for (const a of ads) {
    if (!adsBy.has(a.platform)) {
      adsBy.set(a.platform, {
        accessStatus: a.accessStatus ?? null,
        lastSyncAt: a.lastSyncAt ?? null,
      });
    }
  }

  return [
    {
      key: "gsc",
      label: "Google Search Console",
      status: seoStatus(seoBy.get(SeoProvider.GSC)),
      href: "/portal/seo",
      glyph: "GSC",
    },
    {
      key: "ga4",
      label: "Google Analytics 4",
      status: seoStatus(seoBy.get(SeoProvider.GA4)),
      href: "/portal/seo",
      glyph: "GA4",
    },
    {
      key: "google-ads",
      label: "Google Ads",
      status: adStatus(adsBy.get(AdPlatform.GOOGLE_ADS)),
      href: "/portal/campaigns",
    },
    {
      key: "meta-ads",
      label: "Meta Ads",
      status: adStatus(adsBy.get(AdPlatform.META)),
      href: "/portal/campaigns",
    },
    {
      key: "appfolio",
      label: "AppFolio",
      status: appfolioStatus(appfolio),
      href: "/portal/settings/integrations",
    },
    {
      key: "cursive",
      label: "Cursive pixel",
      status: cursiveStatus(cursive, recentPixelEvent != null),
      href: "/portal/visitors",
    },
  ];
}

function seoStatus(
  s: { status: SeoSyncStatus; lastSyncAt: Date | null } | undefined,
): IntegrationChipStatus {
  if (!s) return "off";
  if (s.status === SeoSyncStatus.ERROR) return "error";
  if (!s.lastSyncAt) return "degraded";
  // Stale if no sync in 3 days.
  if (Date.now() - s.lastSyncAt.getTime() > 3 * DAY_MS) return "degraded";
  return "connected";
}

function adStatus(
  a: { accessStatus: string | null; lastSyncAt: Date | null } | undefined,
): IntegrationChipStatus {
  if (!a) return "off";
  const access = (a.accessStatus ?? "active").toLowerCase();
  if (access === "expired" || access === "revoked") return "error";
  if (access === "error") return "error";
  if (!a.lastSyncAt) return "degraded";
  if (Date.now() - a.lastSyncAt.getTime() > 3 * DAY_MS) return "degraded";
  return "connected";
}

function appfolioStatus(
  af: {
    instanceSubdomain: string | null;
    clientIdEncrypted: string | null;
    apiKeyEncrypted: string | null;
    syncStatus: string | null;
    lastSyncAt: Date | null;
  } | null,
): IntegrationChipStatus {
  if (!af) return "off";
  const hasCreds =
    !!af.instanceSubdomain && (!!af.clientIdEncrypted || !!af.apiKeyEncrypted);
  if (!hasCreds) return "off";
  const sync = (af.syncStatus ?? "").toLowerCase();
  if (sync === "error") return "error";
  if (!af.lastSyncAt) return "degraded";
  if (Date.now() - af.lastSyncAt.getTime() > 7 * DAY_MS) return "degraded";
  return "connected";
}

function cursiveStatus(
  c: { cursivePixelId: string | null; lastEventAt: Date | null } | null,
  hasRecentEvent: boolean,
): IntegrationChipStatus {
  if (!c) return "off";
  if (!c.cursivePixelId) return "off";
  if (!hasRecentEvent && !c.lastEventAt) return "degraded";
  if (c.lastEventAt && Date.now() - c.lastEventAt.getTime() > 7 * DAY_MS) {
    return "degraded";
  }
  return "connected";
}

// ---------------------------------------------------------------------------
// First-run progress
// ---------------------------------------------------------------------------

export type FirstRunProgress = {
  hasProperty: boolean;
  pixelInstalled: boolean;
  gscConnected: boolean;
  marketingSiteCustomized: boolean;
};

export async function getFirstRunProgress(orgId: string): Promise<FirstRunProgress> {
  const [propertyCount, cursive, gsc, siteConfig] = await Promise.all([
    // First-run "do you have any properties yet?" — only count marketable
    // ones. AppFolio re-syncing a parking lot shouldn't trip the
    // "has a property" milestone for the operator.
    prisma.property.count({ where: marketablePropertyWhere(orgId) }),
    // Dashboard "is the pixel firing?" badge — surface ANY active
    // pixel for the org. Multi-property tenants might have several;
    // pick the most-recently-active so the badge reflects reality.
    prisma.cursiveIntegration.findFirst({
      where: { orgId, cursivePixelId: { not: null } },
      orderBy: [{ lastEventAt: "desc" }],
      select: { cursivePixelId: true, lastEventAt: true },
    }),
    prisma.seoIntegration.findFirst({
      where: {
        orgId,
        provider: SeoProvider.GSC,
        serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
      },
      select: { id: true, status: true },
    }),
    prisma.tenantSiteConfig.findUnique({
      where: { orgId },
      select: { heroHeadline: true, heroImageUrl: true, primaryCtaUrl: true },
    }),
  ]);

  const pixelInstalled = !!cursive?.lastEventAt || !!cursive?.cursivePixelId;
  const gscConnected = !!gsc;
  const marketingSiteCustomized = !!(
    siteConfig?.heroHeadline ||
    siteConfig?.heroImageUrl ||
    siteConfig?.primaryCtaUrl
  );

  return {
    hasProperty: propertyCount > 0,
    pixelInstalled,
    gscConnected,
    marketingSiteCustomized,
  };
}

// ---------------------------------------------------------------------------
// Lead status pipeline counts (for the small status strip below the dashboard).
// Same shape as before — kept here so /portal/page.tsx isn't doing its own
// groupBy plumbing.
// ---------------------------------------------------------------------------

export async function getLeadStatusCounts(orgId: string): Promise<Map<LeadStatus, number>> {
  const rows = await prisma.lead.groupBy({
    by: ["status"],
    where: { orgId },
    _count: { _all: true },
  });
  const map = new Map<LeadStatus, number>();
  for (const r of rows) map.set(r.status, r._count._all);
  return map;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function bucketDailyTotals(
  rows: Array<{ date: Date; value: number }>,
  windowDays: number,
): number[] {
  const buckets = new Array<number>(windowDays).fill(0);
  for (const row of rows) {
    const idx = dayBucketIndex(row.date, windowDays);
    if (idx >= 0 && idx < windowDays) {
      buckets[idx] += row.value;
    }
  }
  return buckets;
}

function dayBucketIndex(date: Date, windowDays: number): number {
  const ageMs = Date.now() - date.getTime();
  if (ageMs < 0) return windowDays - 1;
  const daysAgo = Math.floor(ageMs / DAY_MS);
  return windowDays - 1 - daysAgo;
}

function displayName(first: string | null | undefined, last: string | null | undefined): string {
  const f = first?.trim();
  const l = last?.trim();
  if (f && l) return `${f} ${l[0]}.`;
  if (f) return f;
  if (l) return l;
  return "Anonymous";
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function safeShortPath(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path.length > 24 ? `${path.slice(0, 21)}\u2026` : path;
  } catch {
    return null;
  }
}

// Used by the activity titles' string concat above to satisfy TS lint about
// unused exports. Re-exporting here keeps the public surface explicit.
export type { ActivityItem, ActivityKind };

// ---------------------------------------------------------------------------
// Leasing velocity trend (12-week rolling)
//
// Returns week-by-week counts of leads, tours, and applications for the last
// 12 weeks (oldest -> newest). Used by the LeasingVelocityChart on /portal.
// ---------------------------------------------------------------------------

export type WeeklyVelocityPoint = {
  weekLabel: string;
  weekStart: Date;
  leads: number;
  tours: number;
  applications: number;
};

export async function getLeasingVelocityTrend(
  orgId: string,
  weeks = 12,
): Promise<WeeklyVelocityPoint[]> {
  const now = Date.now();
  const WEEK_MS = 7 * DAY_MS;
  const since = new Date(now - weeks * WEEK_MS);

  const [leads, tours, applications] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.tour.findMany({
      where: {
        lead: { orgId },
        createdAt: { gte: since },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
      },
      select: { createdAt: true },
    }),
    prisma.application.findMany({
      where: {
        lead: { orgId },
        createdAt: { gte: since },
      },
      select: { createdAt: true },
    }),
  ]);

  const leadsPerWeek = new Array<number>(weeks).fill(0);
  const toursPerWeek = new Array<number>(weeks).fill(0);
  const appsPerWeek = new Array<number>(weeks).fill(0);

  function weekIdx(date: Date): number {
    const ageMs = now - date.getTime();
    if (ageMs < 0) return weeks - 1;
    const weeksAgo = Math.floor(ageMs / WEEK_MS);
    return weeks - 1 - weeksAgo;
  }

  for (const r of leads) {
    const i = weekIdx(r.createdAt);
    if (i >= 0 && i < weeks) leadsPerWeek[i] += 1;
  }
  for (const r of tours) {
    const i = weekIdx(r.createdAt);
    if (i >= 0 && i < weeks) toursPerWeek[i] += 1;
  }
  for (const r of applications) {
    const i = weekIdx(r.createdAt);
    if (i >= 0 && i < weeks) appsPerWeek[i] += 1;
  }

  return leadsPerWeek.map((leadCount, i) => {
    const weeksAgo = weeks - 1 - i;
    const weekStart = new Date(now - (weeksAgo + 1) * WEEK_MS);
    const label = weeksAgo === 0 ? "This wk" : `${weeksAgo}w ago`;
    return {
      weekLabel: label,
      weekStart,
      leads: leadCount,
      tours: toursPerWeek[i],
      applications: appsPerWeek[i],
    };
  });
}

// ---------------------------------------------------------------------------
// Recent identified visitors
//
// Latest few Visitors that have at least one of (firstName, lastName, email).
// Used by the dashboard "Recent identified visitors" panel so the operator
// always has a wall of real names to look at, not an empty card.
// ---------------------------------------------------------------------------

export type RecentIdentifiedVisitor = {
  id: string;
  name: string;
  email: string | null;
  lastSeenAt: Date;
  utmSource: string | null;
  referrer: string | null;
  intentScore: number;
};

export async function getRecentIdentifiedVisitors(
  orgId: string,
  limit = 6,
): Promise<RecentIdentifiedVisitor[]> {
  const rows = await prisma.visitor.findMany({
    where: {
      orgId,
      status: {
        in: [
          VisitorIdentificationStatus.IDENTIFIED,
          VisitorIdentificationStatus.ENRICHED,
          VisitorIdentificationStatus.MATCHED_TO_LEAD,
        ],
      },
    },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      lastSeenAt: true,
      utmSource: true,
      referrer: true,
      intentScore: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: displayName(r.firstName, r.lastName),
    email: r.email,
    lastSeenAt: r.lastSeenAt,
    utmSource: r.utmSource,
    referrer: r.referrer,
    intentScore: r.intentScore,
  }));
}

// ---------------------------------------------------------------------------
// Reputation pulse
//
// Latest property mentions across the org so operators can spot a fresh
// review the moment it lands. Linked to the per-property reputation tab.
// ---------------------------------------------------------------------------

export type ReputationPulseItem = {
  id: string;
  propertyId: string;
  propertyName: string;
  source: MentionSource;
  title: string | null;
  excerpt: string;
  authorName: string | null;
  publishedAt: Date | null;
  sentiment: Sentiment | null;
  rating: number | null;
  sourceUrl: string;
};

export async function getReputationPulse(
  orgId: string,
  limit = 5,
): Promise<ReputationPulseItem[]> {
  const rows = await prisma.propertyMention.findMany({
    where: { orgId },
    orderBy: [{ publishedAt: "desc" }, { lastSeenAt: "desc" }],
    take: limit,
    select: {
      id: true,
      propertyId: true,
      source: true,
      title: true,
      excerpt: true,
      authorName: true,
      publishedAt: true,
      sentiment: true,
      rating: true,
      sourceUrl: true,
      property: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    propertyName: r.property?.name ?? "Property",
    source: r.source,
    title: r.title,
    excerpt: r.excerpt,
    authorName: r.authorName,
    publishedAt: r.publishedAt,
    sentiment: r.sentiment,
    rating: r.rating,
    sourceUrl: r.sourceUrl,
  }));
}

// ---------------------------------------------------------------------------
// Reputation summary tile — portfolio-wide aggregate for the dashboard KPI.
// Cheap to compute and gives operators a one-glance answer to "how is my
// brand looking right now?". Used on /portal as a KPI tile that links to the
// new /portal/reputation portfolio page.
// ---------------------------------------------------------------------------

export type ReputationSummary = {
  avgGoogleRating: number | null;
  googleReviewCount: number;
  totalMentions: number;
  newLast30d: number;
  negativeCount: number;
  unreviewedCount: number;
};

export async function getReputationSummary(
  orgId: string,
): Promise<ReputationSummary> {
  const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [properties, mentionsTotal, mentionsNew30d, negativeCount, unreviewed] =
    await Promise.all([
      prisma.property.findMany({
        where: { orgId },
        select: { googleAggRating: true, googleAggReviewCount: true },
      }),
      prisma.propertyMention.count({ where: { orgId } }),
      prisma.propertyMention.count({
        where: { orgId, createdAt: { gte: last30d } },
      }),
      prisma.propertyMention.count({
        where: { orgId, sentiment: "NEGATIVE" },
      }),
      prisma.propertyMention.count({
        where: { orgId, reviewedByUserId: null },
      }),
    ]);

  let weightedSum = 0;
  let weightedCount = 0;
  for (const p of properties) {
    if (
      typeof p.googleAggRating === "number" &&
      typeof p.googleAggReviewCount === "number" &&
      p.googleAggReviewCount > 0
    ) {
      weightedSum += p.googleAggRating * p.googleAggReviewCount;
      weightedCount += p.googleAggReviewCount;
    }
  }
  const avgGoogleRating =
    weightedCount > 0 ? Math.round((weightedSum / weightedCount) * 10) / 10 : null;

  return {
    avgGoogleRating,
    googleReviewCount: weightedCount,
    totalMentions: mentionsTotal,
    newLast30d: mentionsNew30d,
    negativeCount,
    unreviewedCount: unreviewed,
  };
}

// ---------------------------------------------------------------------------
// Chatbot KPI — captures and capture rate over the last 28 days. Surfaces the
// chatbot's ROI directly on the dashboard. capture-rate denominator is total
// active conversations (excluding flagged/spam) not raw site visitors.
// ---------------------------------------------------------------------------

export type ChatbotSummary = {
  conversations28d: number;
  leadsCaptured28d: number;
  captureRatePct: number | null;
  prev28dConversations: number;
  deltaPct: number | null;
};

export async function getChatbotSummary(
  orgId: string,
): Promise<ChatbotSummary> {
  const since28d = new Date(Date.now() - 28 * DAY_MS);
  const sincePrev = new Date(Date.now() - 56 * DAY_MS);

  const [convo28d, captured28d, convoPrev28d] = await Promise.all([
    prisma.chatbotConversation.count({
      where: { orgId, createdAt: { gte: since28d } },
    }),
    prisma.chatbotConversation.count({
      where: {
        orgId,
        createdAt: { gte: since28d },
        status: "LEAD_CAPTURED",
      },
    }),
    prisma.chatbotConversation.count({
      where: {
        orgId,
        createdAt: { gte: sincePrev, lt: since28d },
      },
    }),
  ]);

  const captureRatePct =
    convo28d > 0 ? Math.round((captured28d / convo28d) * 100) : null;
  const deltaPct =
    convoPrev28d > 0
      ? Math.round(((convo28d - convoPrev28d) / convoPrev28d) * 100)
      : null;

  return {
    conversations28d: convo28d,
    leadsCaptured28d: captured28d,
    captureRatePct,
    prev28dConversations: convoPrev28d,
    deltaPct,
  };
}

// ---------------------------------------------------------------------------
// Performance over time — daily leads-created bucket for the requested
// window, plus an aligned prior-period series for the comparison
// overlay. Mirrors the AeroStore "Sales Performance Over Time" pattern
// where the operator can read "we're ahead / behind vs the previous
// cycle" at a glance.
//
// Returns one row per day in chronological order. `comparison` is the
// leads count from the equivalent offset in the prior window of the
// same length (so day 0 of current ↔ day 0 of prior, etc).
// ---------------------------------------------------------------------------

export type PerformancePoint = {
  date: string;
  label: string;
  current: number;
  comparison: number | null;
};

export async function getPerformanceOverTime(
  orgId: string,
  rangeDays: number,
  includeComparison: boolean,
): Promise<PerformancePoint[]> {
  // Clamp to a sane window so a hand-crafted URL can't ask for a 10-year
  // chart and stall the page.
  const days = Math.max(1, Math.min(rangeDays, 365));
  const now = new Date();
  const currentStart = new Date(now.getTime() - days * DAY_MS);
  const priorStart = new Date(now.getTime() - 2 * days * DAY_MS);
  const priorEnd = currentStart;

  const [currentLeads, priorLeads] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId, createdAt: { gte: currentStart } },
      select: { createdAt: true },
    }),
    includeComparison
      ? prisma.lead.findMany({
          where: {
            orgId,
            createdAt: { gte: priorStart, lt: priorEnd },
          },
          select: { createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  // Bucket each lead into its day index relative to the window start.
  const currentBuckets = new Array<number>(days).fill(0);
  const priorBuckets = new Array<number>(days).fill(0);

  for (const lead of currentLeads) {
    const idx = Math.floor(
      (lead.createdAt.getTime() - currentStart.getTime()) / DAY_MS,
    );
    if (idx >= 0 && idx < days) currentBuckets[idx] += 1;
  }
  if (includeComparison) {
    for (const lead of priorLeads) {
      const idx = Math.floor(
        (lead.createdAt.getTime() - priorStart.getTime()) / DAY_MS,
      );
      if (idx >= 0 && idx < days) priorBuckets[idx] += 1;
    }
  }

  // Label every day with a short MMM-DD style so the x-axis can pick a
  // sparse subset without losing context.
  const points: PerformancePoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(currentStart.getTime() + i * DAY_MS);
    points.push({
      date: date.toISOString(),
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      current: currentBuckets[i],
      comparison: includeComparison ? priorBuckets[i] : null,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Top properties leaderboard — ranks properties by lead count in the
// current window. Drives the URBN-style "Realtor efficiency" panel on
// /portal home. Includes the prior-period count per property so the
// row can render a delta arrow without a second round-trip.
// ---------------------------------------------------------------------------

export type LeaderboardPropertyRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  heroImageUrl: string | null;
  logoUrl: string | null;
  leadsCurrent: number;
  leadsPrior: number;
};

export async function getTopPropertiesByLeads(
  orgId: string,
  rangeDays: number,
  limit = 5,
  propertyIds?: string[] | null,
): Promise<LeaderboardPropertyRow[]> {
  const days = Math.max(1, Math.min(rangeDays, 365));
  const currentStart = new Date(Date.now() - days * DAY_MS);
  const priorStart = new Date(Date.now() - 2 * days * DAY_MS);
  const priorEnd = currentStart;

  // Pull marketable properties only — skip parking lots, sub-records,
  // and rows still pending operator curation. Honors the property
  // filter from the page-level multi-select so the leaderboard moves
  // with the rest of the dashboard.
  const properties = await prisma.property.findMany({
    where: {
      ...marketablePropertyWhere(orgId),
      ...(propertyIds && propertyIds.length > 0
        ? { id: { in: propertyIds } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      heroImageUrl: true,
      photoUrls: true,
      logoUrl: true,
    },
  });
  if (properties.length === 0) return [];

  const ids = properties.map((p) => p.id);

  const [currentGroups, priorGroups] = await Promise.all([
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        propertyId: { in: ids },
        createdAt: { gte: currentStart },
      },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        orgId,
        propertyId: { in: ids },
        createdAt: { gte: priorStart, lt: priorEnd },
      },
      _count: { _all: true },
    }),
  ]);

  const currentMap = new Map<string, number>();
  const priorMap = new Map<string, number>();
  for (const g of currentGroups) {
    if (g.propertyId) currentMap.set(g.propertyId, g._count._all);
  }
  for (const g of priorGroups) {
    if (g.propertyId) priorMap.set(g.propertyId, g._count._all);
  }

  return properties
    .map<LeaderboardPropertyRow>((p) => {
      // Fallback chain: heroImageUrl -> first photoUrls entry -> null.
      const photoFallback = (() => {
        const arr = p.photoUrls;
        if (Array.isArray(arr) && arr.length > 0) {
          const first = arr[0];
          return typeof first === "string" && first.length > 0
            ? first
            : null;
        }
        return null;
      })();
      return {
        id: p.id,
        name: p.name,
        city: p.city,
        state: p.state,
        heroImageUrl: p.heroImageUrl ?? photoFallback,
        logoUrl: p.logoUrl,
        leadsCurrent: currentMap.get(p.id) ?? 0,
        leadsPrior: priorMap.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => b.leadsCurrent - a.leadsCurrent || b.leadsPrior - a.leadsPrior)
    .slice(0, limit);
}
