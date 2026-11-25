import { prisma } from "@/lib/db";

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
  available: number;
  rentMin: number | null; // cents, advertised rent on available listings
  rentMax: number | null;
  /** Days since AppFolio's ready-for-showing date, units already past it. */
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
  health: { appfolio: SourceHealth; analytics: SourceHealth; chatbot: SourceHealth };
};

export type PortfolioOverview = {
  rows: PortfolioRow[];
  totals: { available: number; visitors: Series; visitorsConnected: number; /** Sites with data in both windows: the only fair base for a delta. */ visitorsLike: { cur: number; prev: number; sites: number }; chats: Series; leads: Series; apps: Series; tours: Series; leadMix: PortfolioRow["leadMix"] };
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
      id: true, name: true, city: true, heroImageUrl: true, photoUrls: true, lastSyncedAt: true,
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
      totals: { available: 0, visitors: zero(), visitorsConnected: 0, visitorsLike: { cur: 0, prev: 0, sites: 0 }, chats: zero(), leads: zero(), apps: zero(), tours: zero(), leadMix: { chat: 0, popup: 0, other: 0 } },
      appfolioConnected: false,
      orgWideAnalytics: false,
      appfolioSyncedAt: null,
      analyticsSyncedAt: null,
      today: new Date(today),
    };
  }
  const ids = properties.map((p) => p.id);
  const inProps = { propertyId: { in: ids } };

  const [listings, snapshots, seo, chats, leads, apps, tours, appfolio] = await Promise.all([
    prisma.listing.findMany({ where: { ...inProps, isAvailable: true }, select: { propertyId: true, priceCents: true, availableFrom: true, unitNumber: true } }),
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
    const ls = listingsBy.get(p.id) ?? [];
    const prices = ls.map((l) => l.priceCents).filter((c): c is number => typeof c === "number" && c >= 10_000);
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
      rentMin: prices.length ? Math.min(...prices) : null,
      rentMax: prices.length ? Math.max(...prices) : null,
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
      health: {
        appfolio: health(p.lastSyncedAt, now, appfolio?.lastError ?? null),
        analytics: health(lastSeo, now, seoError),
        chatbot: (p.chatbotConfig ? p.chatbotConfig.chatbotEnabled : chatsBy.has(p.id)) ? { state: "fresh", at: null } : { state: "off", at: null },
      },
    };
  });

  const totals = { available: 0, visitors: zero(), visitorsConnected: 0, visitorsLike: { cur: 0, prev: 0, sites: 0 }, chats: zero(), leads: zero(), apps: zero(), tours: bucket(tours.map((t) => ({ at: t.createdAt })), today), leadMix: { chat: 0, popup: 0, other: 0 } };
  for (const r of rows) {
    totals.available += r.available;
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
    totals,
    appfolioConnected: Boolean(appfolio),
    orgWideAnalytics: seo.some((r) => r.propertyId === null),
    appfolioSyncedAt: appfolio?.lastSyncAt ?? null,
    analyticsSyncedAt: seo.reduce<Date | null>((d, r) => (r.lastSyncAt && (!d || r.lastSyncAt > d) ? r.lastSyncAt : d), null),
    today: new Date(today),
  };
}
