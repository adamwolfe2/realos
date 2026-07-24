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
import { realAdAccountWhere } from "@/lib/integrations/real-ad-account";

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

  // Filter by realAdAccountWhere so seeded fake metrics (Telegraph
  // Commons demo data) don't leak into the dashboard KPI when the tenant
  // hasn't actually connected an ad account. Covers both connect paths
  // — legacy paste (credentialsEncrypted IS NOT NULL) and OAuth picker
  // (matching OAuthConnection row).
  const realAccount = { adAccount: await realAdAccountWhere(orgId) };

  const [current, previousDaily, previousMonthly, dailyRows] =
    await Promise.all([
      prisma.adMetricDaily.aggregate({
        where: { orgId, date: { gte: since28d }, ...realAccount },
        _sum: { spendCents: true },
      }),
      prisma.adMetricDaily.aggregate({
        where: { orgId, date: { gte: since56d, lt: since28d }, ...realAccount },
        _sum: { spendCents: true },
      }),
      // Stitch in any rolled-up monthly buckets that overlap the prior
      // window. For Foundation tier the daily retention is 28 days, so
      // the prior window may have been purged from AdMetricDaily and only
      // survive as monthly aggregates. Without this union the delta-arrow
      // on the dashboard would silently collapse to "+∞%".
      sumAdMonthlyOverlap(orgId, since56d, since28d),
      prisma.adMetricDaily.groupBy({
        by: ["date"],
        where: { orgId, date: { gte: since28d }, ...realAccount },
        _sum: { spendCents: true },
        orderBy: { date: "asc" },
      }),
    ]);

  const currentCents = current._sum.spendCents ?? 0;
  const previousCents = (previousDaily._sum.spendCents ?? 0) + previousMonthly;

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
      select: { date: true, organicSessions: true, totalClicks: true },
      orderBy: { date: "asc" },
    }),
    prisma.seoSnapshot.aggregate({
      where: { orgId, date: { gte: since56d, lt: since28d } },
      _sum: { organicSessions: true, totalClicks: true },
    }),
  ]);

  // "Organic visitors" = real organic arrivals from EITHER source. GA4
  // organicSessions and GSC clicks measure the same thing (a search-driven
  // visit), so summing them double-counts; take the per-day MAX instead.
  // This is the fix for the tile reading "2" when GA4 session tracking is
  // misconfigured (0/day) while GSC clearly recorded 252 clicks / 28d.
  const dailyOrganic = (s: {
    organicSessions: number | null;
    totalClicks: number | null;
  }) => Math.max(s.organicSessions ?? 0, s.totalClicks ?? 0);
  const total = snapshots.reduce((acc, s) => acc + dailyOrganic(s), 0);
  // Prior-window aggregate can't take a per-day max (it's pre-summed), so
  // use the larger of the two summed sources as a close proxy for the delta.
  const previousTotal = Math.max(
    prevSnapshots._sum.organicSessions ?? 0,
    prevSnapshots._sum.totalClicks ?? 0,
  );
  const sparkline = bucketDailyTotals(
    snapshots.map((s) => ({ date: s.date, value: dailyOrganic(s) })),
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

export async function getLeadSourceBreakdown(
  orgId: string,
): Promise<LeadSourceSlice[]> {
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
    visitorsCount,
    engagedCount,
    leadsCount,
    toursCount,
    applicationsCount,
    pmsConnectedProperty,
  ] = await Promise.all([
    // Count Visitor rows, NOT VisitorSession rows. VisitorSession rows
    // only exist when the Cursive pixel fires a `page_view` event —
    // the upstream pixel provider segment-sync writes Visitor rows directly without
    // creating sessions. Tenants on segment-sync-only (e.g. Telegraph
    // Commons: 150 visitors, 0 sessions) were reading the funnel
    // "Visitors" stage as zero even though they had 150 real visitors
    // in their portal. Counting Visitor.lastSeenAt in the 28d window
    // gives the same intent (people who showed up in the last 28d) and
    // works for both the pixel and segment-sync acquisition paths.
    prisma.visitor.count({
      where: {
        orgId,
        lastSeenAt: { gte: since28d },
      },
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
    // Norman 2026-06-04: detect whether the org has ANY property with a
    // PMS wired up. Without a backend, tours + applications can't flow,
    // so we render those slices as "—" instead of "0" downstream.
    prisma.property.findFirst({
      where: { orgId, backendPlatform: { not: "NONE" } },
      select: { id: true },
    }),
  ]);

  const pmsConnected = pmsConnectedProperty !== null;

  return [
    { label: "Visitors", value: visitorsCount },
    { label: "Engaged", value: engagedCount },
    { label: "Leads", value: leadsCount },
    // Only flag NA when we have no PMS AND no measured value — if any
    // tour or application slipped in via manual entry, prefer the real
    // count over the disclaimer.
    {
      label: "Tours",
      value: toursCount,
      notApplicable: !pmsConnected && toursCount === 0,
    },
    {
      label: "Applications",
      value: applicationsCount,
      notApplicable: !pmsConnected && applicationsCount === 0,
    },
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
    const arr =
      sparkByProp.get(row.propertyId) ?? new Array<number>(WINDOW_DAYS).fill(0);
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
// Portfolio-wide 28d leads sparkline only — the dashboard header tile only
// ever needs the summed daily-leads shape, not the full per-property
// leads/campaigns/reputation rollup that getPropertyMetrics computes (6
// queries). This mirrors just the leadsSpark half of that function (1
// query) for callers that don't need the per-property breakdown. Keep
// getPropertyMetrics intact — the property cards may want the full shape.
// ---------------------------------------------------------------------------

export async function getPortfolioLeadsSpark(
  orgId: string,
  propertyIds: string[],
): Promise<number[]> {
  const spark = new Array<number>(WINDOW_DAYS).fill(0);
  if (propertyIds.length === 0) return spark;

  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  const leadDates = await prisma.lead.findMany({
    where: {
      orgId,
      createdAt: { gte: since28d },
      propertyId: { in: propertyIds },
    },
    select: { createdAt: true },
  });

  for (const row of leadDates) {
    const idx = dayBucketIndex(row.createdAt, WINDOW_DAYS);
    if (idx >= 0 && idx < WINDOW_DAYS) spark[idx] += 1;
  }

  return spark;
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

  const [recentLeads, recentTours, recentSessions, recentChats] =
    await Promise.all([
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
          // Norman bug #102: pull leadId so the activity-feed click
          // target can route directly to the lead transcript instead of
          // the gated /portal/conversations module.
          leadId: true,
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
      meta:
        [name, lead.property?.name].filter(Boolean).join(" \u00b7 ") ||
        undefined,
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
      meta:
        [
          tour.property?.name,
          displayName(tour.lead?.firstName, tour.lead?.lastName),
        ]
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
        ? `Engaged visitors on ${path}`
        : "Engaged visitors on your site",
      meta:
        [
          s.utmSource && `via ${s.utmSource}`,
          s.country,
          `${s.pageviewCount} pages`,
        ]
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
    // Norman bug #102: the click target was hard-coded to
    // /portal/conversations, but the Conversations module is off for
    // most orgs (it's the dedicated inbox surface, gated). When the
    // operator clicked through they landed on a locked module page.
    // Prefer the lead-detail transcript when we have a leadId, fall
    // back to the chatbot page (which surfaces recent conversations
    // + config) so the link always lands on something useful.
    items.push({
      id: `chat-${c.id}`,
      kind: "chatbot",
      title: `Chatbot \u2014 ${captured}`,
      meta: c.property?.name ?? undefined,
      href: c.leadId ? `/portal/leads/${c.leadId}` : "/portal/chatbot",
      at: c.createdAt,
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Integration health row
// ---------------------------------------------------------------------------

export async function getIntegrationHealth(
  orgId: string,
): Promise<IntegrationChip[]> {
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
      where: { orgId, ...(await realAdAccountWhere(orgId)) },
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
        // Surfaced through to the dashboard so the AppFolio chip can read
        // "Auto-sync paused" when the operator has manual-only mode on.
        // Falls into the "degraded" bucket so the UI gets to show a
        // honest amber state rather than a misleading green.
        autoSyncEnabled: true,
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

  const seoBy = new Map<
    SeoProvider,
    { status: SeoSyncStatus; lastSyncAt: Date | null }
  >();
  for (const s of seo) {
    seoBy.set(s.provider, {
      status: s.status,
      lastSyncAt: s.lastSyncAt ?? null,
    });
  }
  const adsBy = new Map<
    AdPlatform,
    { accessStatus: string | null; lastSyncAt: Date | null }
  >();
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
      href: "/portal/connect",
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
    autoSyncEnabled?: boolean;
  } | null,
): IntegrationChipStatus {
  if (!af) return "off";
  const hasCreds =
    !!af.instanceSubdomain && (!!af.clientIdEncrypted || !!af.apiKeyEncrypted);
  if (!hasCreds) return "off";
  const sync = (af.syncStatus ?? "").toLowerCase();
  if (sync === "error") return "error";
  // Auto-sync paused — credentials work, but the operator has switched off
  // the hourly cron. Surface as degraded so the dashboard chip and Connect
  // hub render an honest amber state with the "Enable auto-sync" link
  // instead of a misleading green checkmark.
  if (af.autoSyncEnabled === false) return "degraded";
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

export async function getFirstRunProgress(
  orgId: string,
): Promise<FirstRunProgress> {
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

export async function getLeadStatusCounts(
  orgId: string,
): Promise<Map<LeadStatus, number>> {
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

function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
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
      // 2026-06-04 N+1 audit: was `where: { orgId }` which scanned
      // EXCLUDED parking lots / storage / IMPORTED-pending rows that
      // can never carry Google data. Tightened to marketable lifecycle
      // so the weighted-rating average is computed off the same set
      // every other rating-aware surface uses.
      prisma.property.findMany({
        where: marketablePropertyWhere(orgId),
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
    weightedCount > 0
      ? Math.round((weightedSum / weightedCount) * 10) / 10
      : null;

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
          return typeof first === "string" && first.length > 0 ? first : null;
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
    .sort(
      (a, b) => b.leadsCurrent - a.leadsCurrent || b.leadsPrior - a.leadsPrior,
    )
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Historical ad-metrics stitching (daily + monthly union)
//
// The retention cron rolls AdMetricDaily rows older than the org's tier
// window into AdMetricMonthly buckets, then deletes the dailies. Anything
// that wants a window crossing the boundary must union the two tables so
// the chart / KPI / export sees continuous data.
//
// Monthly buckets are anchored on the first of each month (UTC). A bucket
// counts toward a [from, to) window if `firstOfMonth >= from` AND
// `firstOfMonth < to` — partial overlap at the edges is acceptable here
// because the alternative (pro-rating bucket totals) would invent
// per-day numbers we no longer have. Callers that need exact day-level
// math should narrow their window to inside the daily retention zone.
// ---------------------------------------------------------------------------

export type AdHistoryPoint = {
  /**
   * ISO date string. For daily rows this is the actual metric date.
   * For monthly buckets it's the first of the month (YYYY-MM-01).
   */
  date: string;
  granularity: "daily" | "monthly";
  spendCents: number;
  clicks: number;
  impressions: number;
  conversions: number;
};

/**
 * Sum of monthly bucket spendCents that anchor inside [from, to).
 * Used by KPI tiles where only spend matters; the full-row union below
 * powers the CSV export.
 */
export async function sumAdMonthlyOverlap(
  orgId: string,
  from: Date,
  to: Date,
): Promise<number> {
  // (year * 12 + month) is monotone, so we can express the date range as
  // an inclusive (year, month) span without DATE arithmetic on Int cols.
  const fromIdx = from.getUTCFullYear() * 12 + from.getUTCMonth();
  const toIdx = to.getUTCFullYear() * 12 + to.getUTCMonth();
  // We want anchors strictly less than `to`. Since we compare by the
  // monthly anchor (first of month), a row at year=Y month=M has anchor
  // index Y*12 + (M-1). The half-open boundary on `to` translates to
  // anchorIdx < toIdx.
  const rows = await prisma.adMetricMonthly.findMany({
    where: { orgId },
    select: { year: true, month: true, spendCents: true },
  });
  let total = 0;
  for (const r of rows) {
    const anchorIdx = r.year * 12 + (r.month - 1);
    if (anchorIdx >= fromIdx && anchorIdx < toIdx) {
      total += r.spendCents;
    }
  }
  return total;
}

/**
 * Unified daily + monthly history for an org, sorted by anchor date asc.
 * Daily rows pass through unchanged. Monthly rows are emitted as one
 * point per (adAccount, year-month) anchored at the first of the month.
 *
 * `daysOrMonths` selects either the day count (when small enough to live
 * inside the daily window) or the equivalent in months. Callers like the
 * CSV export pass the full requested range and let the stitching decide
 * what's daily vs monthly.
 */
export async function getAdHistoryUnion(
  orgId: string,
  from: Date,
  to: Date = new Date(),
): Promise<AdHistoryPoint[]> {
  const realAccount = await realAdAccountWhere(orgId);
  const [daily, monthly] = await Promise.all([
    prisma.adMetricDaily.findMany({
      where: {
        orgId,
        date: { gte: from, lt: to },
        adAccount: realAccount,
      },
      select: {
        date: true,
        spendCents: true,
        clicks: true,
        impressions: true,
        conversions: true,
      },
    }),
    prisma.adMetricMonthly.findMany({
      where: { orgId },
      select: {
        year: true,
        month: true,
        spendCents: true,
        clicks: true,
        impressions: true,
        conversions: true,
      },
    }),
  ]);

  const fromIdx = from.getUTCFullYear() * 12 + from.getUTCMonth();
  const toIdx = to.getUTCFullYear() * 12 + to.getUTCMonth();

  const points: AdHistoryPoint[] = [];

  for (const r of daily) {
    points.push({
      date: r.date.toISOString().slice(0, 10),
      granularity: "daily",
      spendCents: r.spendCents,
      clicks: r.clicks,
      impressions: r.impressions,
      conversions: r.conversions,
    });
  }

  for (const r of monthly) {
    const anchorIdx = r.year * 12 + (r.month - 1);
    if (anchorIdx < fromIdx || anchorIdx >= toIdx) continue;
    const anchor = new Date(Date.UTC(r.year, r.month - 1, 1));
    points.push({
      date: anchor.toISOString().slice(0, 10),
      granularity: "monthly",
      spendCents: r.spendCents,
      clicks: r.clicks,
      impressions: r.impressions,
      conversions: r.conversions,
    });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}
