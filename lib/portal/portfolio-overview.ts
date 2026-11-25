import { prisma } from "@/lib/db";
import { listingKind, rentByKind, type RentByKind } from "@/lib/listings/kind";

// ---------------------------------------------------------------------------
// Portfolio overview: one row per ACTIVE property plus portfolio totals, for
// multi-property orgs (SG Real Estate). Every query is batched across the
// whole property set (no per-property round trips). Numbers are only what a
// real source recorded; a source that is not connected stays null so the UI
// can say "Not connected" instead of printing a zero.
// ---------------------------------------------------------------------------

export const WINDOW = 28;
const DAY = 86_400_000;

export type Series = { cur: number[]; prev: number[] }; // daily, oldest first
export type SourceHealth = { state: "fresh" | "stale" | "error" | "off"; at: Date | null; error?: string | null };

export type PortfolioRow = {
  id: string;
  name: string;
  city: string | null;
  image: string | null;
  /** Advertised homes: rooms + whole units (parking/storage left out). */
  available: number;
  /** Count and advertised rent range (cents) per kind of listing. */
  rent: RentByKind;
  rentMin: number | null; // cents, lowest advertised home rent (sorting)
  /** Days on market from Listing.listedAt. `atLeast`: the median falls on
   *  units advertised before tracking began, so it is a lower bound. */
  listed: { median: number | null; atLeast: boolean; tracked: number; total: number };
  /** Days since AppFolio's ready-for-showing date, units already past it
   *  (a proxy until listedAt history accrues). */
  readyDaysMedian: number | null;
  readyDaysOldest: number | null;
  readyCount: number;
  visitors: Series | null; // null = no GA4/GSC connection for this property
  /** GA4/GSC rows exist for the prior window (false = connected recently). */
  visitorsHadPrior: boolean;
  chats: Series;
  leads: Series;
  leadMix: { chat: number; popup: number; other: number };
  apps: Series;
  appsTrackedBothWindows: boolean;
  health: { appfolio: SourceHealth; analytics: SourceHealth; chatbot: SourceHealth };
};

export type PortfolioOverview = {
  rows: PortfolioRow[];
  /** Daily advertised homes (PropertyAvailabilityDaily), oldest first, only
   *  days with a snapshot: the history starts when tracking began. */
  availability: { date: Date; homes: number }[];
  /** Properties with a snapshot on every plotted day (the line's base). */
  availabilitySites: number;
  totals: { available: number; rooms: number; units: number; /** Properties tracked for both windows: the fair base for the applications change. */ appsLike: { cur: number; prev: number; sites: number }; visitors: Series; visitorsConnected: number; /** Sites with data in both windows: the only fair base for a delta. */ visitorsLike: { cur: number; prev: number; sites: number }; chats: Series; leads: Series; apps: Series; tours: Series; leadMix: PortfolioRow["leadMix"] };
  /** AppFolio connected for this org; without it applications are unknown, not zero. */
  appfolioConnected: boolean;
  /** Legacy org-wide GA4/GSC row (propertyId null) that per-site rows can't attribute. */
  orgWideAnalytics: boolean;
  appfolioSyncedAt: Date | null;
  analyticsSyncedAt: Date | null;
  today: Date;
};

// Next-term / floor-plan listings ("Prelease 2B/2B 2027-2028", "Spring
// Double 2027") advertise a future lease, not a vacant unit; their AppFolio
// ready date is a template leftover (The Den's read 2023), so they are left
// out of days-ready.
/** Listing.listedAt shipped on this day; listings advertised before it have no date. */
export const LISTED_TRACKING_SINCE = new Date(Date.UTC(2026, 10, 25));

/** AppFolio activation backfill window (DEFAULT_BACKFILL_DAYS in appfolio-sync). */
const BACKFILL_DAYS = 30;

export const NEXT_TERM = /pre[\s-]?leas|\b(spring|fall|summer)\b|\b20\d\d\s*[-–/]\s*(20)?\d\d\b|\b\d\d\/\d\d\b/i;

const dayStart = (t: number) => Math.floor(t / DAY) * DAY;

/** Daily buckets for the WINDOW days ending on `end` (inclusive) and the WINDOW before. */
export function bucket(dates: { at: Date; n?: number }[], end: number): Series {
  const cur = Array<number>(WINDOW).fill(0);
  const prev = Array<number>(WINDOW).fill(0);
  for (const d of dates) {
    const back = Math.round((end - dayStart(d.at.getTime())) / DAY);
    if (back < 0) continue;
    if (back < WINDOW) cur[WINDOW - 1 - back] += d.n ?? 1;
    else if (back < 2 * WINDOW) prev[2 * WINDOW - 1 - back] += d.n ?? 1;
  }
  return { cur, prev };
}

export const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);

function addSeries(into: Series, s: Series) {
  for (let i = 0; i < WINDOW; i += 1) {
    into.cur[i] += s.cur[i];
    into.prev[i] += s.prev[i];
  }
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Days-on-market median where untracked listings count as at least `floor` days. */
export function listedDays(listedAt: (Date | null)[], now: number, floor: number): PortfolioRow["listed"] {
  const total = listedAt.length;
  const known = listedAt.filter((d): d is Date => d !== null).map((d) => Math.floor((now - d.getTime()) / DAY)).sort((a, b) => a - b);
  if (!total) return { median: null, atLeast: false, tracked: 0, total: 0 };
  // Untracked listings sort last (they are older than anything tracked).
  const mid = Math.floor((total - 1) / 2);
  if (mid >= known.length) return { median: floor, atLeast: true, tracked: known.length, total };
  return { median: known[mid], atLeast: false, tracked: known.length, total };
}

/** Daily advertised homes over only the properties recorded on every day, so
 *  a building added mid-range or a missed sync can't fake a step. */
export function availabilitySeries(rows: { propertyId: string; date: Date; rooms: number; units: number }[]) {
  const days = [...new Set(rows.map((r) => r.date.getTime()))].sort((a, b) => a - b);
  const byProperty = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const m = byProperty.get(r.propertyId) ?? new Map<number, number>();
    m.set(r.date.getTime(), r.rooms + r.units);
    byProperty.set(r.propertyId, m);
  }
  const complete = [...byProperty.values()].filter((m) => days.every((d) => m.has(d)));
  return {
    availability: days.map((d) => ({ date: new Date(d), homes: complete.reduce((s, m) => s + m.get(d)!, 0) })),
    availabilitySites: complete.length,
  };
}

function health(at: Date | null, now: number, error?: string | null): SourceHealth {
  if (error) return { state: "error", at, error };
  if (!at) return { state: "off", at: null };
  return { state: now - at.getTime() > 36 * 3_600_000 ? "stale" : "fresh", at };
}

function firstImage(hero: string | null, photos: unknown): string | null {
  if (hero) return hero;
  return Array.isArray(photos) && typeof photos[0] === "string" && photos[0] ? photos[0] : null;
}

export async function getPortfolioOverview(orgId: string, propertyIds: string[] | null): Promise<PortfolioOverview> {
  const now = Date.now();
  const today = dayStart(now);
  const since = new Date(today - 2 * WINDOW * DAY);

  const properties = await prisma.property.findMany({
    where: { orgId, lifecycle: "ACTIVE", ...(propertyIds ? { id: { in: propertyIds } } : {}) },
    select: {
      id: true, name: true, city: true, heroImageUrl: true, photoUrls: true, lastSyncedAt: true, lifecycleSetAt: true,
      chatbotConfig: { select: { chatbotEnabled: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });
  const zero = (): Series => ({ cur: Array(WINDOW).fill(0), prev: Array(WINDOW).fill(0) });
  // Single-property workspaces keep the classic overview: skip the rest.
  if (properties.length < 2) {
    return {
      rows: [],
      availability: [],
      availabilitySites: 0,
      totals: { available: 0, rooms: 0, units: 0, appsLike: { cur: 0, prev: 0, sites: 0 }, visitors: zero(), visitorsConnected: 0, visitorsLike: { cur: 0, prev: 0, sites: 0 }, chats: zero(), leads: zero(), apps: zero(), tours: zero(), leadMix: { chat: 0, popup: 0, other: 0 } },
      appfolioConnected: false,
      orgWideAnalytics: false,
      appfolioSyncedAt: null,
      analyticsSyncedAt: null,
      today: new Date(today),
    };
  }
  const ids = properties.map((p) => p.id);
  const inProps = { propertyId: { in: ids } };

  const [listings, snapshots, seo, chats, leads, apps, tours, appfolio, availability] = await Promise.all([
    prisma.listing.findMany({ where: { ...inProps, isAvailable: true }, select: { propertyId: true, priceCents: true, availableFrom: true, unitNumber: true, unitType: true, listedAt: true, raw: true } }),
    prisma.seoSnapshot.findMany({ where: { orgId, ...inProps, date: { gte: since } }, select: { propertyId: true, date: true, organicSessions: true, totalClicks: true } }),
    prisma.seoIntegration.findMany({ where: { orgId, OR: [inProps, { propertyId: null }], serviceAccountJsonEncrypted: { not: "DEMO_SEED" } }, select: { propertyId: true, lastSyncAt: true, lastSyncError: true } }),
    prisma.chatbotConversation.findMany({ where: { orgId, ...inProps, createdAt: { gte: since } }, select: { propertyId: true, createdAt: true } }),
    // AppFolio-imported leads are applicants stamped with their import time
    // (a backfill lands dozens on one day); they are counted as applications
    // by received date instead, so they are excluded here.
    prisma.lead.findMany({
      where: { orgId, ...inProps, createdAt: { gte: since }, OR: [{ externalSystem: null }, { externalSystem: { not: "appfolio" } }] },
      select: { propertyId: true, createdAt: true, source: true, sourceDetail: true },
    }),
    prisma.application.findMany({ where: { ...inProps, applicantRole: "PRIMARY", receivedAt: { gte: since } }, select: { propertyId: true, receivedAt: true } }),
    prisma.tour.findMany({ where: { ...inProps, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.appFolioIntegration.findUnique({ where: { orgId }, select: { lastSyncAt: true, lastError: true } }),
    prisma.propertyAvailabilityDaily.findMany({ where: { ...inProps, date: { gte: new Date(today - (WINDOW - 1) * DAY) } }, select: { propertyId: true, date: true, rooms: true, units: true } }),
  ]);

  const by = <T extends { propertyId: string | null }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      if (!r.propertyId) continue;
      const list = m.get(r.propertyId);
      if (list) list.push(r);
      else m.set(r.propertyId, [r]);
    }
    return m;
  };
  const listingsBy = by(listings);
  const snapsBy = by(snapshots);
  const seoBy = by(seo);
  const chatsBy = by(chats);
  const leadsBy = by(leads);
  const appsBy = by(apps);

  const yesterday = today - DAY; // GA4/GSC land a day behind
  const rows: PortfolioRow[] = properties.map((p) => {
    const all = listingsBy.get(p.id) ?? [];
    const rent = rentByKind(all);
    const ls = all.filter((l) => listingKind(l) !== "other");
    const homeMins = [rent.room.min, rent.unit.min].filter((n): n is number => n !== null);
    const readyDays = ls
      .filter((l) => l.availableFrom && l.availableFrom.getTime() <= now && !NEXT_TERM.test(l.unitNumber ?? ""))
      .map((l) => Math.floor((now - l.availableFrom!.getTime()) / DAY));
    const seoRows = seoBy.get(p.id) ?? [];
    const lastSeo = seoRows.reduce<Date | null>((d, r) => (r.lastSyncAt && (!d || r.lastSyncAt > d) ? r.lastSyncAt : d), null);
    const seoError = seoRows.find((r) => r.lastSyncError)?.lastSyncError ?? null;
    const pLeads = leadsBy.get(p.id) ?? [];
    const curLeads = pLeads.filter((l) => l.createdAt.getTime() >= today - (WINDOW - 1) * DAY);
    const isPopup = (l: (typeof pLeads)[number]) => l.source === "FORM" && Boolean(l.sourceDetail?.startsWith("popup:"));
    return {
      id: p.id,
      name: p.name,
      city: p.city,
      image: firstImage(p.heroImageUrl, p.photoUrls),
      available: ls.length,
      rent,
      rentMin: homeMins.length ? Math.min(...homeMins) : null,
      // Pre-lease / next-term floor plans are advertised for months by
      // design; days on market is about vacant units.
      listed: listedDays(ls.filter((l) => !NEXT_TERM.test(l.unitNumber ?? "")).map((l) => l.listedAt), now, Math.max(0, Math.floor((now - LISTED_TRACKING_SINCE.getTime()) / DAY))),
      readyDaysMedian: median(readyDays),
      readyDaysOldest: readyDays.length ? Math.max(...readyDays) : null,
      readyCount: readyDays.length,
      // Organic visits: per day the larger of GA4 organic sessions and GSC
      // clicks (same measure as the dashboard KPI; summing double-counts).
      visitors: seoRows.length
        ? bucket((snapsBy.get(p.id) ?? []).map((s) => ({ at: s.date, n: Math.max(s.organicSessions, s.totalClicks) })), yesterday)
        : null,
      visitorsHadPrior: (snapsBy.get(p.id) ?? []).some((s) => s.date.getTime() <= yesterday - WINDOW * DAY),
      chats: bucket((chatsBy.get(p.id) ?? []).map((c) => ({ at: c.createdAt })), today),
      leads: bucket(pLeads.map((l) => ({ at: l.createdAt })), today),
      leadMix: {
        chat: curLeads.filter((l) => l.source === "CHATBOT").length,
        popup: curLeads.filter(isPopup).length,
        other: curLeads.filter((l) => l.source !== "CHATBOT" && !isPopup(l)).length,
      },
      apps: bucket((appsBy.get(p.id) ?? []).map((a) => ({ at: a.receivedAt! })), today),
      // AppFolio applications are imported only while a building is ACTIVE,
      // plus a 30-day backfill on activation, so a building activated less
      // than 56 - 30 days ago has a hollow prior window: its change is fake.
      appsTrackedBothWindows: !p.lifecycleSetAt || p.lifecycleSetAt.getTime() <= today - (2 * WINDOW - 1 - BACKFILL_DAYS) * DAY,
      health: {
        appfolio: health(p.lastSyncedAt, now, appfolio?.lastError ?? null),
        analytics: health(lastSeo, now, seoError),
        // Chats arriving prove a bot is live (the workspace bot) even when
        // this property's own setting is off; a silent explicit off stays off.
        chatbot: (p.chatbotConfig?.chatbotEnabled || chatsBy.has(p.id)) ? { state: "fresh", at: null } : { state: "off", at: null },
      },
    };
  });

  const totals = { available: 0, rooms: 0, units: 0, appsLike: { cur: 0, prev: 0, sites: 0 }, visitors: zero(), visitorsConnected: 0, visitorsLike: { cur: 0, prev: 0, sites: 0 }, chats: zero(), leads: zero(), apps: zero(), tours: bucket(tours.map((t) => ({ at: t.createdAt })), today), leadMix: { chat: 0, popup: 0, other: 0 } };
  for (const r of rows) {
    totals.available += r.available;
    totals.rooms += r.rent.room.count;
    totals.units += r.rent.unit.count;
    if (r.appsTrackedBothWindows) {
      totals.appsLike.cur += sum(r.apps.cur);
      totals.appsLike.prev += sum(r.apps.prev);
      totals.appsLike.sites += 1;
    }
    if (r.visitors) {
      addSeries(totals.visitors, r.visitors);
      totals.visitorsConnected += 1;
      if (r.visitorsHadPrior) {
        totals.visitorsLike.cur += sum(r.visitors.cur);
        totals.visitorsLike.prev += sum(r.visitors.prev);
        totals.visitorsLike.sites += 1;
      }
    }
    addSeries(totals.chats, r.chats);
    addSeries(totals.leads, r.leads);
    addSeries(totals.apps, r.apps);
    totals.leadMix.chat += r.leadMix.chat;
    totals.leadMix.popup += r.leadMix.popup;
    totals.leadMix.other += r.leadMix.other;
  }

  return {
    rows,
    ...availabilitySeries(availability),
    totals,
    appfolioConnected: Boolean(appfolio),
    orgWideAnalytics: seo.some((r) => r.propertyId === null),
    appfolioSyncedAt: appfolio?.lastSyncAt ?? null,
    analyticsSyncedAt: seo.reduce<Date | null>((d, r) => (r.lastSyncAt && (!d || r.lastSyncAt > d) ? r.lastSyncAt : d), null),
    today: new Date(today),
  };
}
