import "server-only";
import { prisma } from "@/lib/db";
import {
  AdPlatform,
  LeadSource,
  LeadStatus,
  SeoProvider,
  SeoSyncStatus,
  TourStatus,
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

  const [current, previous, dailyRows] = await Promise.all([
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: since28d } },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.aggregate({
      where: { orgId, date: { gte: since56d, lt: since28d } },
      _sum: { spendCents: true },
    }),
    prisma.adMetricDaily.groupBy({
      by: ["date"],
      where: { orgId, date: { gte: since28d } },
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
};

export async function getPropertyMetrics(
  orgId: string,
  propertyIds: string[],
): Promise<Map<string, PropertyMetrics>> {
  const out = new Map<string, PropertyMetrics>();
  if (propertyIds.length === 0) return out;

  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  const [leadGroups, campaignGroups, allLeadDates] = await Promise.all([
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

  for (const id of propertyIds) {
    out.set(id, {
      leads28d: leadCountByProp.get(id) ?? 0,
      leadsSpark: sparkByProp.get(id) ?? new Array<number>(WINDOW_DAYS).fill(0),
      activeCampaigns: campaignCountByProp.get(id) ?? 0,
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
    prisma.seoIntegration.findMany({
      where: { orgId },
      select: { provider: true, status: true, lastSyncAt: true },
    }),
    prisma.adAccount.findMany({
      where: { orgId },
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
    prisma.cursiveIntegration.findUnique({
      where: { orgId },
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
    prisma.property.count({ where: { orgId } }),
    prisma.cursiveIntegration.findUnique({
      where: { orgId },
      select: { cursivePixelId: true, lastEventAt: true },
    }),
    prisma.seoIntegration.findFirst({
      where: { orgId, provider: SeoProvider.GSC },
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
