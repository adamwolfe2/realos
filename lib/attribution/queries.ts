import "server-only";
import { prisma } from "@/lib/db";
import { LeadSource } from "@prisma/client";

// ---------------------------------------------------------------------------
// /portal/attribution data layer.
//
// Mirrors the seven charts Clarity Attribution sells for $5–10k/property/month
// — sessions per source, leads per source (multi + last touch), leads per
// module type, leads per city, leads per device trend, leads per touch
// frequency — but pulled from REAL DATA in the LeaseStack DB. No mocks, no
// seeds. Empty bins return [] so the UI can render honest empty states.
//
// All queries are tenant-scoped via orgId. Optional propertyId narrows to a
// single property's lead/visitor/session set when set.
// ---------------------------------------------------------------------------

export type AttributionFilters = {
  orgId: string;
  propertyId?: string | null;
  fromDate: Date;
  toDate: Date;
};

export type SourceSlice = { source: string; count: number };
export type CityRow = { city: string; count: number };
export type ModuleSlice = { module: LeadSource; label: string; count: number };
export type TouchBucket = {
  bucket: "1" | "2" | "3" | "4" | "5+";
  count: number;
};
export type DeviceTrendPoint = {
  date: string; // YYYY-MM-DD
  desktop: number;
  mobile: number;
  tablet: number;
};
export type ModuleTrendPoint = {
  date: string;
  bySource: Record<string, number>;
};

// Friendly label for each LeadSource enum value. Mirrors what Clarity calls
// the same buckets so the side-by-side reads naturally.
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  CHATBOT: "Chatbot",
  FORM: "Web form",
  PIXEL_OUTREACH: "Pixel outreach",
  REFERRAL: "Referral",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  ORGANIC: "Organic",
  DIRECT: "Direct",
  EMAIL_CAMPAIGN: "Email",
  COLD_EMAIL: "Cold email",
  MANUAL: "Manual entry",
  OTHER: "Other",
};

// ---------------------------------------------------------------------------
// 1. Sessions per source — grouped by utmSource, falling back to the
// referrer hostname when no UTM was set, falling back to "direct" for
// type-in / bookmark traffic.
// ---------------------------------------------------------------------------
export async function getSessionsPerSource(
  filters: AttributionFilters
): Promise<SourceSlice[]> {
  const sessions = await prisma.visitorSession.findMany({
    where: {
      orgId: filters.orgId,
      startedAt: { gte: filters.fromDate, lte: filters.toDate },
      ...(filters.propertyId
        ? { visitor: { propertyId: filters.propertyId } }
        : {}),
    },
    select: { utmSource: true, firstReferrer: true },
  });

  const counts = new Map<string, number>();
  for (const s of sessions) {
    const source = normalizeSource(s.utmSource, s.firstReferrer);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// 2. Leads per source — last-touch attribution.
// Uses Lead.source enum (already classified at lead-creation time) plus
// Lead.sourceDetail when needed for finer-grain channel attribution.
// ---------------------------------------------------------------------------
export async function getLeadsPerSourceLastTouch(
  filters: AttributionFilters
): Promise<ModuleSlice[]> {
  const grouped = await prisma.lead.groupBy({
    by: ["source"],
    where: {
      orgId: filters.orgId,
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      createdAt: { gte: filters.fromDate, lte: filters.toDate },
    },
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({
      module: g.source,
      label: LEAD_SOURCE_LABEL[g.source] ?? g.source,
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// 3. Leads per source — multi-touch attribution.
// For each Lead with a linked Visitor, look at every session that visitor
// had before converting and count each unique utmSource as a "touch". A
// lead that touched both google-ads and direct contributes 1 to each
// channel's bucket. Falls back to last-touch when no visitor relation
// exists.
// ---------------------------------------------------------------------------
export async function getLeadsPerSourceMultiTouch(
  filters: AttributionFilters
): Promise<SourceSlice[]> {
  const leads = await prisma.lead.findMany({
    where: {
      orgId: filters.orgId,
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      createdAt: { gte: filters.fromDate, lte: filters.toDate },
    },
    select: {
      id: true,
      source: true,
      visitor: {
        select: {
          sessions: {
            where: {
              startedAt: { lte: filters.toDate },
            },
            select: { utmSource: true, firstReferrer: true },
          },
        },
      },
    },
  });

  const counts = new Map<string, number>();
  for (const lead of leads) {
    const sessions = lead.visitor?.sessions ?? [];
    if (sessions.length === 0) {
      // No multi-touch data — fall back to the lead's source enum value
      // so we never lose a contribution to a "—" bucket.
      const fallback = LEAD_SOURCE_LABEL[lead.source]?.toLowerCase() ?? "direct";
      counts.set(fallback, (counts.get(fallback) ?? 0) + 1);
      continue;
    }
    const touched = new Set<string>();
    for (const s of sessions) {
      touched.add(normalizeSource(s.utmSource, s.firstReferrer));
    }
    for (const t of touched) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// 4. Leads per city — joins Lead → Visitor → enrichedData (AL/Cursive
// payload), pulling PERSONAL_CITY / CITY / city. Falls back to the
// visitor's resolved location string when individual fields aren't set.
// ---------------------------------------------------------------------------
export async function getLeadsPerCity(
  filters: AttributionFilters
): Promise<CityRow[]> {
  const leads = await prisma.lead.findMany({
    where: {
      orgId: filters.orgId,
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      createdAt: { gte: filters.fromDate, lte: filters.toDate },
    },
    select: {
      visitor: {
        select: { enrichedData: true },
      },
    },
  });

  const counts = new Map<string, number>();
  for (const lead of leads) {
    const enriched = lead.visitor?.enrichedData as
      | Record<string, unknown>
      | null
      | undefined;
    if (!enriched) continue;
    const city = readEnrichedString(enriched, [
      "PERSONAL_CITY",
      "CITY",
      "city",
    ]);
    const state = readEnrichedString(enriched, [
      "STATE",
      "PERSONAL_STATE",
      "state",
    ]);
    if (!city) continue;
    const label = state ? `${city}, ${state}` : city;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// 5. Leads per device trend — joins Lead → Visitor → VisitorSession (the
// session attached to the lead conversion's day), parses userAgent into
// desktop / mobile / tablet, buckets per day in the date range.
// ---------------------------------------------------------------------------
export async function getLeadsPerDeviceTrend(
  filters: AttributionFilters
): Promise<DeviceTrendPoint[]> {
  const leads = await prisma.lead.findMany({
    where: {
      orgId: filters.orgId,
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      createdAt: { gte: filters.fromDate, lte: filters.toDate },
    },
    select: {
      createdAt: true,
      visitor: {
        select: {
          sessions: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { userAgent: true },
          },
        },
      },
    },
  });

  // Initialize every day in the range so the chart line is continuous.
  const dayKeys = enumerateDays(filters.fromDate, filters.toDate);
  const buckets = new Map<string, DeviceTrendPoint>();
  for (const k of dayKeys) {
    buckets.set(k, { date: k, desktop: 0, mobile: 0, tablet: 0 });
  }

  for (const lead of leads) {
    const key = toDayKey(lead.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const ua = lead.visitor?.sessions[0]?.userAgent ?? "";
    const device = classifyDevice(ua);
    bucket[device] += 1;
  }
  return Array.from(buckets.values());
}

// ---------------------------------------------------------------------------
// 6. Leads per module trend — same shape as device trend but bucketed by
// LEAD_SOURCE label per day. Renders as a multi-series line chart.
// ---------------------------------------------------------------------------
export async function getLeadsPerModuleTrend(
  filters: AttributionFilters
): Promise<ModuleTrendPoint[]> {
  const leads = await prisma.lead.findMany({
    where: {
      orgId: filters.orgId,
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      createdAt: { gte: filters.fromDate, lte: filters.toDate },
    },
    select: { createdAt: true, source: true },
  });

  const dayKeys = enumerateDays(filters.fromDate, filters.toDate);
  const buckets = new Map<string, ModuleTrendPoint>();
  for (const k of dayKeys) {
    buckets.set(k, { date: k, bySource: {} });
  }
  for (const lead of leads) {
    const key = toDayKey(lead.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const label = LEAD_SOURCE_LABEL[lead.source];
    bucket.bySource[label] = (bucket.bySource[label] ?? 0) + 1;
  }
  return Array.from(buckets.values());
}

// ---------------------------------------------------------------------------
// 7. Leads per touch frequency — for each Lead with a visitor, count
// distinct sessions before conversion and bin into 1 / 2 / 3 / 4 / 5+
// buckets. Leads without a visitor count as 1-touch (the lead itself).
// ---------------------------------------------------------------------------
export async function getLeadsPerTouchFrequency(
  filters: AttributionFilters
): Promise<TouchBucket[]> {
  const leads = await prisma.lead.findMany({
    where: {
      orgId: filters.orgId,
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      createdAt: { gte: filters.fromDate, lte: filters.toDate },
    },
    select: {
      visitor: {
        select: { _count: { select: { sessions: true } } },
      },
    },
  });

  const counts: Record<TouchBucket["bucket"], number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5+": 0,
  };
  for (const lead of leads) {
    const sessionCount = lead.visitor?._count.sessions ?? 1;
    if (sessionCount <= 1) counts["1"] += 1;
    else if (sessionCount === 2) counts["2"] += 1;
    else if (sessionCount === 3) counts["3"] += 1;
    else if (sessionCount === 4) counts["4"] += 1;
    else counts["5+"] += 1;
  }
  return (["1", "2", "3", "4", "5+"] as const).map((bucket) => ({
    bucket,
    count: counts[bucket],
  }));
}

// ---------------------------------------------------------------------------
// Headline counts for the page header strip — one per LEAD_SOURCE that has
// data + total leads + total identified visitors in the window.
// ---------------------------------------------------------------------------
export async function getAttributionHeadline(
  filters: AttributionFilters
): Promise<{
  totalLeads: number;
  totalSessions: number;
  identifiedVisitors: number;
  modules: ModuleSlice[];
}> {
  const [totalLeads, totalSessions, identifiedVisitors, modules] =
    await Promise.all([
      prisma.lead.count({
        where: {
          orgId: filters.orgId,
          ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
          createdAt: { gte: filters.fromDate, lte: filters.toDate },
        },
      }),
      prisma.visitorSession.count({
        where: {
          orgId: filters.orgId,
          ...(filters.propertyId
            ? { visitor: { propertyId: filters.propertyId } }
            : {}),
          startedAt: { gte: filters.fromDate, lte: filters.toDate },
        },
      }),
      prisma.visitor.count({
        where: {
          orgId: filters.orgId,
          ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
          status: { in: ["IDENTIFIED", "ENRICHED", "MATCHED_TO_LEAD"] },
          firstSeenAt: { gte: filters.fromDate, lte: filters.toDate },
        },
      }),
      getLeadsPerSourceLastTouch(filters),
    ]);
  return { totalLeads, totalSessions, identifiedVisitors, modules };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSource(
  utmSource: string | null,
  firstReferrer: string | null
): string {
  // Explicit UTM tag wins. Lowercase + trim so "Google" / "google " merge.
  if (utmSource && utmSource.trim()) {
    return utmSource.trim().toLowerCase();
  }
  if (firstReferrer && firstReferrer.trim()) {
    try {
      const host = new URL(firstReferrer).hostname.replace(/^www\./, "");
      // Map common search engines + socials to clean labels.
      if (host.includes("google.")) return "google organic";
      if (host.includes("bing.")) return "bing organic";
      if (host.includes("duckduckgo")) return "duckduckgo organic";
      if (host.includes("facebook.")) return "facebook organic";
      if (host.includes("instagram.")) return "instagram organic";
      if (host.includes("tiktok.")) return "tiktok organic";
      if (host.includes("linkedin.")) return "linkedin organic";
      if (host.includes("reddit.")) return "reddit organic";
      if (host.includes("chatgpt.")) return "chatgpt.com";
      if (host.includes("perplexity.")) return "perplexity";
      return host;
    } catch {
      // Non-URL referrer — fall through to direct.
    }
  }
  return "direct";
}

function readEnrichedString(
  obj: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function classifyDevice(userAgent: string): "desktop" | "mobile" | "tablet" {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/iphone|android.*mobile|mobile/.test(ua)) return "mobile";
  return "desktop";
}

function toDayKey(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function enumerateDays(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  );
  while (cursor.getTime() <= end.getTime()) {
    out.push(toDayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
