import "server-only";
import { prisma } from "@/lib/db";
import { LeadSource } from "@prisma/client";
import {
  classifySource,
  getSource,
  sourceFromLeadEnum,
  type CanonicalSource,
  type SourceCategory,
} from "@/lib/attribution/source-taxonomy";
// queries.ts is called BY the attribution page, which has already
// applied the access gate via effectivePropertyIds(). We only need the
// raw "ids → Prisma where" translation here, not the gated form. Using
// propertyWhereFragment(scope, ...) would require us to thread scope
// through every helper for no behavioral change.
import { propertyIdsToWhere } from "@/lib/tenancy/property-filter";

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
  // Multi-property filter. `null` (or empty) means "no filter, full
  // portfolio view." Single-element array narrows to one property; the
  // helper handles the Prisma `in` shape internally.
  propertyIds?: string[] | null;
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
      ...(filters.propertyIds && filters.propertyIds.length > 0
        ? { visitor: propertyIdsToWhere(filters.propertyIds) }
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
      ...propertyIdsToWhere(filters.propertyIds ?? null),
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
      ...propertyIdsToWhere(filters.propertyIds ?? null),
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
      // (mapped through the canonical taxonomy so it merges with the
      // session-derived buckets instead of forming a stray lowercase bin).
      const fallback = sourceFromLeadEnum(lead.source).label;
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
      ...propertyIdsToWhere(filters.propertyIds ?? null),
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
      ...propertyIdsToWhere(filters.propertyIds ?? null),
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
      ...propertyIdsToWhere(filters.propertyIds ?? null),
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
      ...propertyIdsToWhere(filters.propertyIds ?? null),
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
          ...propertyIdsToWhere(filters.propertyIds ?? null),
          createdAt: { gte: filters.fromDate, lte: filters.toDate },
        },
      }),
      prisma.visitorSession.count({
        where: {
          orgId: filters.orgId,
          ...(filters.propertyIds && filters.propertyIds.length > 0
            ? { visitor: propertyIdsToWhere(filters.propertyIds) }
            : {}),
          startedAt: { gte: filters.fromDate, lte: filters.toDate },
        },
      }),
      prisma.visitor.count({
        where: {
          orgId: filters.orgId,
          ...propertyIdsToWhere(filters.propertyIds ?? null),
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

// ---------------------------------------------------------------------------
// Lead flow — powers the logo flow-hub hero. Returns each canonical source
// with its session volume + lead count (so we can show a conversion rate),
// plus the downstream funnel stages (toured → applied → signed). Optionally
// folds in GA4 session volumes the first-party pixel never saw.
// ---------------------------------------------------------------------------

export type FlowSource = {
  id: string;
  label: string;
  category: SourceCategory;
  color: string;
  logo: string;
  leads: number;
  sessions: number;
  /** leads / sessions, or null when there is no session volume to divide by. */
  conversionRate: number | null;
};

export type FlowStage = { id: string; label: string; count: number };

export type LeadFlow = {
  sources: FlowSource[];
  stages: FlowStage[];
  /** Marketing-attributed leads (excludes imported / no-channel). */
  totalLeads: number;
  totalSessions: number;
  /** AppFolio-synced / no-channel leads, kept out of the channel breakdown so
   *  a bulk PMS import doesn't drown the real marketing attribution. */
  imported: { leads: number; sessions: number };
};

// Canonical ids that mean "we don't actually know a marketing channel" —
// leads landing here are either routed to the AppFolio/Leasing lane (if they
// carry a PMS externalSystem) or the excluded imported bucket (if not).
const UNATTRIBUTED_IDS = new Set(["other", "manual"]);

// First-class leasing lane for PMS-synced leads. Resolved from the shared
// taxonomy so its color/label/logo stay consistent with every other channel.
const APPFOLIO_SOURCE = getSource("appfolio");

// Funnel ordering for LeadStatus — higher means further down the pipeline.
const STATUS_RANK: Record<string, number> = {
  NEW: 0,
  CONTACTED: 1,
  TOUR_SCHEDULED: 2,
  TOURED: 3,
  APPLICATION_SENT: 4,
  APPLIED: 5,
  APPROVED: 6,
  SIGNED: 7,
  LOST: -1,
  UNQUALIFIED: -1,
};

export async function getLeadFlow(
  filters: AttributionFilters,
  ga4Sessions?: Map<string, number> | null,
): Promise<LeadFlow> {
  const [sessions, leads] = await Promise.all([
    prisma.visitorSession.findMany({
      where: {
        orgId: filters.orgId,
        startedAt: { gte: filters.fromDate, lte: filters.toDate },
        ...(filters.propertyIds && filters.propertyIds.length > 0
          ? { visitor: propertyIdsToWhere(filters.propertyIds) }
          : {}),
      },
      select: { utmSource: true, utmMedium: true, firstReferrer: true },
    }),
    prisma.lead.findMany({
      where: {
        orgId: filters.orgId,
        ...propertyIdsToWhere(filters.propertyIds ?? null),
        createdAt: { gte: filters.fromDate, lte: filters.toDate },
      },
      select: {
        source: true,
        status: true,
        externalSystem: true,
        visitor: {
          select: {
            sessions: {
              orderBy: { startedAt: "desc" },
              take: 1,
              select: {
                utmSource: true,
                utmMedium: true,
                firstReferrer: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // Aggregate per canonical source id. We keep the CanonicalSource meta so the
  // UI gets color/logo/label without a second lookup.
  const meta = new Map<string, CanonicalSource>();
  const sessionCounts = new Map<string, number>();
  const leadCounts = new Map<string, number>();

  const bump = (map: Map<string, number>, src: CanonicalSource, n = 1) => {
    meta.set(src.id, meta.get(src.id) ?? src);
    map.set(src.id, (map.get(src.id) ?? 0) + n);
  };

  for (const s of sessions) {
    bump(sessionCounts, classifySource(s.utmSource, s.firstReferrer, s.utmMedium));
  }

  // GA4 sessions the pixel never saw — folded in by canonical id.
  if (ga4Sessions) {
    for (const [id, n] of ga4Sessions) {
      bump(sessionCounts, getSource(id), n);
    }
  }

  // Classify each lead's channel. Previously any AppFolio-synced / no-channel
  // lead was dropped into a single "imported, excluded" bucket — which for an
  // AppFolio-driven operator (Telegraph: 94% of leads) emptied the whole
  // attribution view. Now AppFolio-sourced leads become a FIRST-CLASS
  // "AppFolio / Leasing" lane: they get their own channel stream AND flow
  // through the funnel stages. Only genuinely unknown, NON-external leads
  // (source Other/Manual with no PMS origin) remain in the excluded bucket.
  const stageCounts = { toured: 0, applied: 0, signed: 0 };
  let importedLeads = 0;
  for (const lead of leads) {
    const src = attributedSource(lead.source, lead.visitor?.sessions[0]);
    const noMarketingChannel =
      UNATTRIBUTED_IDS.has(src.id) ||
      (lead.externalSystem != null && src.id === "direct");

    let channel = src;
    if (noMarketingChannel) {
      if (lead.externalSystem != null) {
        // AppFolio (or any PMS) origin — a real leasing lane, not "Other".
        channel = APPFOLIO_SOURCE;
      } else {
        // Genuinely unattributed, non-external — stays excluded so a stray
        // manual/unknown lead doesn't inflate the funnel.
        importedLeads += 1;
        continue;
      }
    }

    bump(leadCounts, channel);
    const rank = STATUS_RANK[lead.status] ?? 0;
    if (rank >= STATUS_RANK.TOURED) stageCounts.toured += 1;
    if (rank >= STATUS_RANK.APPLIED) stageCounts.applied += 1;
    if (rank >= STATUS_RANK.SIGNED) stageCounts.signed += 1;
  }

  const totalSessions = Array.from(sessionCounts.values()).reduce(
    (a, b) => a + b,
    0,
  );

  // Build channel rows, peeling the unattributed session volume into the
  // imported bucket so it never shows up as a phantom channel.
  const ids = new Set<string>([...sessionCounts.keys(), ...leadCounts.keys()]);
  let importedSessions = 0;
  const sources: FlowSource[] = [];
  for (const id of ids) {
    const sessionN = sessionCounts.get(id) ?? 0;
    if (UNATTRIBUTED_IDS.has(id)) {
      importedSessions += sessionN;
      continue;
    }
    const m = meta.get(id) ?? getSource(id);
    const leadN = leadCounts.get(id) ?? 0;
    sources.push({
      id: m.id,
      label: m.label,
      category: m.category,
      color: m.color,
      logo: m.logo,
      leads: leadN,
      sessions: sessionN,
      conversionRate: sessionN > 0 ? leadN / sessionN : null,
    });
  }
  // Rank by what matters most for the hero: leads first, then traffic.
  sources.sort((a, b) => b.leads - a.leads || b.sessions - a.sessions);

  const stages: FlowStage[] = [
    { id: "toured", label: "Toured", count: stageCounts.toured },
    { id: "applied", label: "Applied", count: stageCounts.applied },
    { id: "signed", label: "Signed", count: stageCounts.signed },
  ];

  return {
    sources,
    stages,
    totalLeads: leads.length - importedLeads,
    totalSessions,
    imported: { leads: importedLeads, sessions: importedSessions },
  };
}

// Best last-touch attribution for one lead: prefer the converting session's
// referrer/UTM (finer ILS detail — Zillow vs "Referral"), fall back to the
// lead's source enum (the capture-surface truth — chatbot/form — when the
// referrer was blank or only resolved to Direct).
function attributedSource(
  leadEnum: LeadSource,
  lastSession?: {
    utmSource: string | null;
    utmMedium: string | null;
    firstReferrer: string | null;
  } | null,
): CanonicalSource {
  const fromSession = lastSession
    ? classifySource(
        lastSession.utmSource,
        lastSession.firstReferrer,
        lastSession.utmMedium,
      )
    : null;
  if (fromSession && fromSession.id !== "direct") return fromSession;

  const fromEnum = sourceFromLeadEnum(leadEnum);
  if (fromSession && fromEnum.id === "other") return fromSession; // keep Direct
  return fromEnum;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Resolve raw session signal to a canonical source LABEL (e.g. "Zillow",
// "Google", "Direct"). Delegates to the shared taxonomy so every chart, the
// flow diagram, and GA4 fusion classify identically — a referrer of
// "zillow.com" and a UTM source of "zillow" collapse to one bucket.
function normalizeSource(
  utmSource: string | null,
  firstReferrer: string | null
): string {
  return classifySource(utmSource, firstReferrer).label;
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
