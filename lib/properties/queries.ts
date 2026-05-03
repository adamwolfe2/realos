import "server-only";
import { prisma } from "@/lib/db";
import {
  ApplicationStatus,
  LeadSource,
  TourStatus,
  type Prisma,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Per-property query helpers. EVERY function accepts both `orgId` AND
// `propertyId` and scopes on both. Any query in this file that forgets one of
// those is a SECURITY BUG.
//
// Shape mirrors lib/dashboard/queries.ts so the property drill-in feels like
// the tenant dashboard, just filtered to a single property.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 28;
const ENGAGED_TIME_SECONDS = 30;

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

// Build a SQL ILIKE fragment that matches any page URL that contains either
// the property slug or the (normalized) property name. We use this because
// SeoLandingPage / SeoQuery don't carry a propertyId FK — they're raw GSC/GA4
// rows keyed by URL.
function buildUrlPatterns(slug: string, name: string): string[] {
  const patterns = new Set<string>();
  if (slug) {
    patterns.add(`%/${slug}%`);
    patterns.add(`%${slug}%`);
  }
  if (name) {
    const compact = name.toLowerCase().replace(/\s+/g, "-");
    if (compact) {
      patterns.add(`%${compact}%`);
    }
  }
  return Array.from(patterns);
}

// ---------------------------------------------------------------------------
// Overview: 28d KPI strip
// ---------------------------------------------------------------------------

export type PropertyOverviewKpis = {
  leads28d: number;
  leadsPrev28d: number;
  tours28d: number;
  applications28d: number;
  adSpendCents28d: number;
  organicSessions28d: number | null;
  organicMapped: boolean;
  leadsSparkline: number[];
};

export async function getPropertyOverviewKpis(
  orgId: string,
  propertyId: string,
  propertyMeta: { slug: string; name: string },
): Promise<PropertyOverviewKpis> {
  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  const since56d = new Date(Date.now() - 2 * WINDOW_DAYS * DAY_MS);

  const patterns = buildUrlPatterns(propertyMeta.slug, propertyMeta.name);

  const [
    leads28d,
    leadsPrev28d,
    tours28d,
    applications28d,
    adSpend,
    leadRowsForSpark,
    organicSessions,
  ] = await Promise.all([
    prisma.lead.count({
      where: { orgId, propertyId, createdAt: { gte: since28d } },
    }),
    prisma.lead.count({
      where: {
        orgId,
        propertyId,
        createdAt: { gte: since56d, lt: since28d },
      },
    }),
    prisma.tour.count({
      where: {
        propertyId,
        lead: { orgId },
        createdAt: { gte: since28d },
        status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
      },
    }),
    prisma.application.count({
      where: {
        propertyId,
        lead: { orgId },
        createdAt: { gte: since28d },
      },
    }),
    prisma.adMetricDaily.aggregate({
      where: {
        orgId,
        date: { gte: since28d },
        campaign: { orgId, propertyId },
      },
      _sum: { spendCents: true },
    }),
    prisma.lead.findMany({
      where: { orgId, propertyId, createdAt: { gte: since28d } },
      select: { createdAt: true },
    }),
    patterns.length === 0
      ? Promise.resolve(null)
      : getOrganicSessionsForUrls(orgId, patterns, since28d),
  ]);

  return {
    leads28d,
    leadsPrev28d,
    tours28d,
    applications28d,
    adSpendCents28d: adSpend._sum.spendCents ?? 0,
    organicSessions28d: organicSessions,
    organicMapped: patterns.length > 0 && organicSessions !== null,
    leadsSparkline: bucketDailyCounts(
      leadRowsForSpark.map((r) => r.createdAt),
      WINDOW_DAYS,
    ),
  };
}

async function getOrganicSessionsForUrls(
  orgId: string,
  patterns: string[],
  since: Date,
): Promise<number | null> {
  // SeoLandingPage rows don't have a property FK. We aggregate sessions where
  // the URL matches any of our slug/name patterns (case-insensitive).
  const or: Prisma.SeoLandingPageWhereInput[] = patterns.map((p) => ({
    url: { contains: p.replace(/%/g, ""), mode: "insensitive" as const },
  }));

  const agg = await prisma.seoLandingPage.aggregate({
    where: {
      orgId,
      date: { gte: since },
      OR: or,
    },
    _sum: { sessions: true },
  });

  return agg._sum.sessions ?? 0;
}

// ---------------------------------------------------------------------------
// Traffic tab: GSC queries + GA4 landing pages filtered by property URL match
// ---------------------------------------------------------------------------

export type PropertyTrafficData = {
  mapped: boolean;
  patterns: string[];
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topLandingPages: Array<{
    url: string;
    sessions: number;
    users: number;
    bounceRate: number;
  }>;
  sessionsSparkline: number[];
  totalSessions28d: number;
  totalClicks28d: number;
};

export async function getPropertyTraffic(
  orgId: string,
  propertyId: string,
  propertyMeta: { slug: string; name: string },
): Promise<PropertyTrafficData> {
  // propertyId is accepted to keep the signature strict/auditable even though
  // SEO rows are URL-based. We still scope on orgId, so no cross-tenant leak.
  void propertyId;

  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  const patterns = buildUrlPatterns(propertyMeta.slug, propertyMeta.name);

  if (patterns.length === 0) {
    return {
      mapped: false,
      patterns,
      topQueries: [],
      topLandingPages: [],
      sessionsSparkline: new Array<number>(WINDOW_DAYS).fill(0),
      totalSessions28d: 0,
      totalClicks28d: 0,
    };
  }

  const landingOr: Prisma.SeoLandingPageWhereInput[] = patterns.map((p) => ({
    url: { contains: p.replace(/%/g, ""), mode: "insensitive" as const },
  }));

  const [landingPageRows, landingPageAggRows, queryRows] = await Promise.all([
    prisma.seoLandingPage.groupBy({
      by: ["url"],
      where: { orgId, date: { gte: since28d }, OR: landingOr },
      _sum: { sessions: true, users: true },
      _avg: { bounceRate: true },
      orderBy: { _sum: { sessions: "desc" } },
      take: 10,
    }),
    prisma.seoLandingPage.findMany({
      where: { orgId, date: { gte: since28d }, OR: landingOr },
      select: { date: true, sessions: true },
    }),
    // Top queries — we can't filter queries by URL directly. We approximate by
    // requiring the query text itself to include the property name or slug.
    prisma.seoQuery.findMany({
      where: {
        orgId,
        date: { gte: since28d },
        OR: patterns.map((p) => ({
          query: { contains: p.replace(/%/g, ""), mode: "insensitive" as const },
        })),
      },
      select: { query: true, clicks: true, impressions: true, ctr: true, position: true },
    }),
  ]);

  // Aggregate queries by text
  const queryMap = new Map<
    string,
    { clicks: number; impressions: number; ctrSum: number; positionSum: number; n: number }
  >();
  for (const r of queryRows) {
    const row =
      queryMap.get(r.query) ??
      { clicks: 0, impressions: 0, ctrSum: 0, positionSum: 0, n: 0 };
    row.clicks += r.clicks;
    row.impressions += r.impressions;
    row.ctrSum += r.ctr;
    row.positionSum += r.position;
    row.n += 1;
    queryMap.set(r.query, row);
  }

  const topQueries = Array.from(queryMap.entries())
    .map(([query, v]) => ({
      query,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.n > 0 ? v.ctrSum / v.n : 0,
      position: v.n > 0 ? v.positionSum / v.n : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 10);

  const topLandingPages = landingPageRows.map((r) => ({
    url: r.url,
    sessions: r._sum.sessions ?? 0,
    users: r._sum.users ?? 0,
    bounceRate: r._avg.bounceRate ?? 0,
  }));

  const sessionsSparkline = bucketDailyTotals(
    landingPageAggRows.map((r) => ({ date: r.date, value: r.sessions })),
    WINDOW_DAYS,
  );

  const totalSessions28d = landingPageAggRows.reduce(
    (acc, r) => acc + (r.sessions ?? 0),
    0,
  );
  const totalClicks28d = topQueries.reduce((acc, q) => acc + q.clicks, 0);

  return {
    mapped: true,
    patterns,
    topQueries,
    topLandingPages,
    sessionsSparkline,
    totalSessions28d,
    totalClicks28d,
  };
}

// ---------------------------------------------------------------------------
// Leads tab: funnel + source donut + recent list + conversion tile
// ---------------------------------------------------------------------------

export type PropertyLeadsData = {
  funnel: Array<{ label: string; value: number }>;
  sourceBreakdown: Array<{ source: string; count: number }>;
  recent: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    source: LeadSource;
    status: string;
    createdAt: Date;
  }>;
  conversionPct: number | null;
};

export async function getPropertyLeads(
  orgId: string,
  propertyId: string,
  propertyMeta: { slug: string; name: string },
): Promise<PropertyLeadsData> {
  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  // Visitor sessions touching this property: we look for VisitorEvents whose
  // url contains the slug (or the compact name). Sessions without any such
  // event are treated as "not this property" to avoid inflating the funnel.
  const slugTerm = propertyMeta.slug;
  const nameTerm = propertyMeta.name.toLowerCase().replace(/\s+/g, "-");

  const visitorSessionFilter: Prisma.VisitorSessionWhereInput = {
    orgId,
    startedAt: { gte: since28d },
    events: {
      some: {
        orgId,
        OR: [
          ...(slugTerm
            ? [{ url: { contains: slugTerm, mode: "insensitive" as const } }]
            : []),
          ...(nameTerm && nameTerm !== slugTerm
            ? [{ url: { contains: nameTerm, mode: "insensitive" as const } }]
            : []),
        ],
      },
    },
  };

  const [visitorRows, engagedCount, leadsCount, toursCount, appsCount, grouped, recent, allLeads] =
    await Promise.all([
      prisma.visitorSession.findMany({
        where: visitorSessionFilter,
        select: { anonymousId: true },
        distinct: ["anonymousId"],
      }),
      prisma.visitorSession.count({
        where: {
          ...visitorSessionFilter,
          OR: [
            { pageviewCount: { gt: 1 } },
            { totalTimeSeconds: { gt: ENGAGED_TIME_SECONDS } },
          ],
        },
      }),
      prisma.lead.count({
        where: { orgId, propertyId, createdAt: { gte: since28d } },
      }),
      prisma.tour.count({
        where: {
          propertyId,
          lead: { orgId },
          createdAt: { gte: since28d },
          status: { in: [TourStatus.SCHEDULED, TourStatus.COMPLETED] },
        },
      }),
      prisma.application.count({
        where: {
          propertyId,
          lead: { orgId },
          createdAt: { gte: since28d },
        },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { orgId, propertyId, createdAt: { gte: since28d } },
        _count: { _all: true },
      }),
      prisma.lead.findMany({
        where: { orgId, propertyId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          source: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.lead.count({
        where: { orgId, propertyId },
      }),
    ]);

  const convertedCount = await prisma.lead.count({
    where: { orgId, propertyId, convertedAt: { not: null } },
  });
  const conversionPct =
    allLeads > 0 ? Math.round((convertedCount / allLeads) * 100) : null;

  const sourceBreakdown = grouped
    .map((row) => ({
      source: LEAD_SOURCE_LABELS[row.source] ?? row.source,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    funnel: [
      { label: "Visitors", value: visitorRows.length },
      { label: "Engaged", value: engagedCount },
      { label: "Leads", value: leadsCount },
      { label: "Tours", value: toursCount },
      { label: "Applications", value: appsCount },
    ],
    sourceBreakdown,
    recent: recent.map((r) => ({ ...r, status: r.status as string })),
    conversionPct,
  };
}

// ---------------------------------------------------------------------------
// Ads tab: campaign rows + spend trend
// ---------------------------------------------------------------------------

export type PropertyCampaignRow = {
  id: string;
  name: string;
  platform: string;
  status: string | null;
  spendCents28d: number;
  leads28d: number;
  cplCents: number | null;
  conversionPct: number | null;
  clicks28d: number;
  impressions28d: number;
};

export type PropertyAdsData = {
  campaigns: PropertyCampaignRow[];
  spendSparkline: number[];
  totalSpendCents28d: number;
  totalLeads28d: number;
};

export async function getPropertyAds(
  orgId: string,
  propertyId: string,
): Promise<PropertyAdsData> {
  const since28d = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  const [campaigns, dailyRows, leadsByCampaignName] = await Promise.all([
    prisma.adCampaign.findMany({
      where: { orgId, propertyId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
      },
    }),
    prisma.adMetricDaily.findMany({
      where: {
        orgId,
        date: { gte: since28d },
        campaign: { orgId, propertyId },
      },
      select: {
        campaignId: true,
        date: true,
        spendCents: true,
        clicks: true,
        impressions: true,
        conversions: true,
      },
    }),
    // Leads attributed via sourceDetail matching campaign name — best-effort
    // without a structured campaign FK on Lead.
    prisma.lead.findMany({
      where: {
        orgId,
        propertyId,
        createdAt: { gte: since28d },
        source: { in: [LeadSource.GOOGLE_ADS, LeadSource.META_ADS] },
      },
      select: { sourceDetail: true },
    }),
  ]);

  const byCampaign = new Map<
    string,
    { spend: number; clicks: number; impressions: number; conversions: number }
  >();
  for (const row of dailyRows) {
    const existing =
      byCampaign.get(row.campaignId) ??
      { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
    existing.spend += row.spendCents;
    existing.clicks += row.clicks;
    existing.impressions += row.impressions;
    existing.conversions += row.conversions;
    byCampaign.set(row.campaignId, existing);
  }

  // Count leads per campaign name (best-effort attribution)
  const leadsByName = new Map<string, number>();
  for (const lead of leadsByCampaignName) {
    const key = (lead.sourceDetail ?? "").toLowerCase();
    if (!key) continue;
    leadsByName.set(key, (leadsByName.get(key) ?? 0) + 1);
  }

  const campaignRows: PropertyCampaignRow[] = campaigns.map((c) => {
    const m = byCampaign.get(c.id) ?? {
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
    };
    const leads28d = leadsByName.get(c.name.toLowerCase()) ?? 0;
    const cplCents = leads28d > 0 ? Math.round(m.spend / leads28d) : null;
    const conversionPct =
      m.clicks > 0 ? Math.round((leads28d / m.clicks) * 100) : null;
    return {
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      spendCents28d: m.spend,
      leads28d,
      cplCents,
      conversionPct,
      clicks28d: m.clicks,
      impressions28d: m.impressions,
    };
  });

  // Total daily spend sparkline across the property's campaigns
  const spendByDay = new Map<string, number>();
  for (const row of dailyRows) {
    const k = row.date.toISOString().slice(0, 10);
    spendByDay.set(k, (spendByDay.get(k) ?? 0) + row.spendCents);
  }
  const spendRows = Array.from(spendByDay.entries()).map(([k, v]) => ({
    date: new Date(k + "T00:00:00Z"),
    value: v / 100,
  }));
  const spendSparkline = bucketDailyTotals(spendRows, WINDOW_DAYS);

  const totalSpendCents28d = campaignRows.reduce(
    (acc, r) => acc + r.spendCents28d,
    0,
  );
  const totalLeads28d = campaignRows.reduce((acc, r) => acc + r.leads28d, 0);

  return {
    campaigns: campaignRows,
    spendSparkline,
    totalSpendCents28d,
    totalLeads28d,
  };
}

// ---------------------------------------------------------------------------
// Chatbot tab: conversations for this property + most-asked topics
// ---------------------------------------------------------------------------

export type PropertyChatbotData = {
  totalConversations: number;
  capturedLeads: number;
  recent: Array<{
    id: string;
    createdAt: Date;
    capturedName: string | null;
    capturedEmail: string | null;
    messageCount: number;
    lastMessageAt: Date;
    status: string;
  }>;
  topTopics: Array<{ term: string; count: number }>;
};

const STOPWORDS = new Set<string>([
  "the", "and", "for", "are", "you", "your", "with", "this", "that", "have",
  "has", "had", "from", "but", "not", "was", "were", "what", "when", "where",
  "how", "can", "could", "would", "should", "will", "about", "into", "than",
  "then", "them", "they", "their", "there", "here", "our", "out", "who",
  "does", "did", "any", "all", "also", "yes", "yeah", "hey", "hello", "hi",
  "thanks", "please", "just", "like", "want", "need", "get", "got", "let",
  "one", "two", "some", "more", "very", "much", "still", "its", "it's",
  "i'm", "i'll", "you're", "we're", "don't", "doesn't", "i've", "i'd",
  "won't", "can't", "a", "an", "is", "of", "in", "on", "to", "at", "be",
  "it", "as", "by", "or", "if", "so", "no", "my", "me", "we", "us", "do",
  "am", "up", "go",
]);

type ChatMessage = { role?: string; content?: string };

export async function getPropertyChatbot(
  orgId: string,
  propertyId: string,
  propertyName: string,
): Promise<PropertyChatbotData> {
  const [conversations, totalConversations, capturedLeads] = await Promise.all([
    prisma.chatbotConversation.findMany({
      where: {
        orgId,
        OR: [
          { propertyId },
          {
            AND: [
              { propertyId: null },
              { pageUrl: { contains: propertyName, mode: "insensitive" } },
            ],
          },
        ],
      },
      orderBy: { lastMessageAt: "desc" },
      take: 250,
      select: {
        id: true,
        createdAt: true,
        capturedName: true,
        capturedEmail: true,
        messageCount: true,
        lastMessageAt: true,
        status: true,
        messages: true,
      },
    }),
    prisma.chatbotConversation.count({
      where: { orgId, propertyId },
    }),
    prisma.chatbotConversation.count({
      where: { orgId, propertyId, capturedEmail: { not: null } },
    }),
  ]);

  // Topic extraction — count user-message words across recent conversations
  const termCounts = new Map<string, number>();
  for (const conv of conversations) {
    const raw = conv.messages;
    if (!Array.isArray(raw)) continue;
    for (const msg of raw as ChatMessage[]) {
      if (!msg || msg.role !== "user" || typeof msg.content !== "string") continue;
      const tokens = msg.content
        .toLowerCase()
        .replace(/[^a-z0-9'\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t));
      for (const t of tokens) {
        termCounts.set(t, (termCounts.get(t) ?? 0) + 1);
      }
    }
  }

  const topTopics = Array.from(termCounts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recent = conversations.slice(0, 10).map((c) => ({
    id: c.id,
    createdAt: c.createdAt,
    capturedName: c.capturedName,
    capturedEmail: c.capturedEmail,
    messageCount: c.messageCount,
    lastMessageAt: c.lastMessageAt,
    status: c.status as string,
  }));

  return {
    totalConversations,
    capturedLeads,
    recent,
    topTopics,
  };
}

// ---------------------------------------------------------------------------
// Occupancy tab (only meaningful when property.totalUnits > 0)
// ---------------------------------------------------------------------------

export type BedTypeRow = {
  bedrooms: number | null;
  label: string;
  total: number;
  available: number;
  leased: number;
  occupancyPct: number;
  activeApplications: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
};

export type PropertyOccupancyData = {
  totalUnits: number;
  availableUnits: number;
  occupancyPct: number;
  activeApplications: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  byBedType: BedTypeRow[];
  listings: Array<{
    id: string;
    unitNumber: string | null;
    unitType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    priceCents: number | null;
    isAvailable: boolean;
  }>;
};

export async function getPropertyOccupancy(
  orgId: string,
  propertyId: string,
): Promise<PropertyOccupancyData | null> {
  // Property scope is enforced via the Property row's orgId, then the listings
  // join via propertyId.
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId },
    select: {
      totalUnits: true,
      availableCount: true,
      priceMin: true,
      priceMax: true,
      listings: {
        orderBy: [{ isAvailable: "desc" }, { unitType: "asc" }],
        select: {
          id: true,
          unitNumber: true,
          unitType: true,
          bedrooms: true,
          bathrooms: true,
          priceCents: true,
          isAvailable: true,
        },
      },
    },
  });

  if (!property) return null;
  const totalUnits = property.totalUnits ?? property.listings.length;
  if (totalUnits <= 0) return null;

  const activeAppsCount = await prisma.application.count({
    where: {
      propertyId,
      lead: { orgId },
      status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW] },
    },
  });

  // Availability source-of-truth resolution. Prefer the AppFolio-mirrored
  // Property.availableCount because the listings table can hold many more
  // rows than physical units (one row per unit-bed-bath configuration,
  // historical / out-of-service rows, etc.). Falling back to
  // listings.filter(isAvailable).length used to produce nonsense like
  // "available: 2249 / total: 100 → leased: -2149". Cap defensively in
  // case AppFolio's denormalized counter ever drifts above totalUnits.
  const rawAvailable =
    property.availableCount != null
      ? property.availableCount
      : property.listings.filter((l) => l.isAvailable).length;
  const availableUnits = Math.max(0, Math.min(totalUnits, rawAvailable));
  const leasedUnits = Math.max(0, totalUnits - availableUnits);
  const occupancyPct =
    totalUnits > 0
      ? Math.max(0, Math.min(100, Math.round((leasedUnits / totalUnits) * 100)))
      : 0;

  const byBedType = buildByBedType(property.listings, activeAppsCount);

  return {
    totalUnits,
    availableUnits,
    occupancyPct,
    activeApplications: activeAppsCount,
    priceMinCents: property.priceMin ?? null,
    priceMaxCents: property.priceMax ?? null,
    byBedType,
    listings: property.listings,
  };
}

function bedTypeLabel(bedrooms: number | null): string {
  if (bedrooms == null || bedrooms === 0) return "Studio";
  if (bedrooms === 1) return "1 Bed";
  if (bedrooms === 2) return "2 Bed";
  if (bedrooms === 3) return "3 Bed";
  return "4+ Bed";
}

function buildByBedType(
  listings: Array<{
    bedrooms: number | null;
    priceCents: number | null;
    isAvailable: boolean;
  }>,
  totalActiveApps: number,
): BedTypeRow[] {
  const grouped = new Map<
    number | null,
    { total: number; available: number; prices: number[] }
  >();

  for (const listing of listings) {
    const key = listing.bedrooms ?? null;
    const existing = grouped.get(key) ?? { total: 0, available: 0, prices: [] };
    const updated = {
      total: existing.total + 1,
      available: existing.available + (listing.isAvailable ? 1 : 0),
      prices:
        listing.priceCents != null
          ? [...existing.prices, listing.priceCents]
          : existing.prices,
    };
    grouped.set(key, updated);
  }

  const totalListings = listings.length;

  const rows: BedTypeRow[] = Array.from(grouped.entries()).map(([bedrooms, g]) => {
    const leased = g.total - g.available;
    const occupancyPct = g.total > 0 ? Math.round((leased / g.total) * 100) : 0;
    const weight = totalListings > 0 ? g.total / totalListings : 0;
    const activeApplications = Math.round(totalActiveApps * weight);
    const priceMinCents = g.prices.length > 0 ? Math.min(...g.prices) : null;
    const priceMaxCents = g.prices.length > 0 ? Math.max(...g.prices) : null;
    return {
      bedrooms,
      label: bedTypeLabel(bedrooms),
      total: g.total,
      available: g.available,
      leased,
      occupancyPct,
      activeApplications,
      priceMinCents,
      priceMaxCents,
    };
  });

  rows.sort((a, b) => {
    const aKey = a.bedrooms ?? -1;
    const bKey = b.bedrooms ?? -1;
    return aKey - bKey;
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bucketDailyCounts(dates: Date[], windowDays: number): number[] {
  const buckets = new Array<number>(windowDays).fill(0);
  for (const d of dates) {
    const idx = dayBucketIndex(d, windowDays);
    if (idx >= 0 && idx < windowDays) buckets[idx] += 1;
  }
  return buckets;
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

export function centsToUsdShort(c: number | null | undefined): string {
  if (c == null) return "—";
  return `$${Math.round(c / 100).toLocaleString()}`;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
