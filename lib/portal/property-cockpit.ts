import { prisma } from "@/lib/db";
import { listingKind, type ListingKind } from "@/lib/listings/kind";
import { NEXT_TERM, WINDOW, bucket, siteLive, sum, type Series } from "@/lib/portal/portfolio-overview";
import { extractFirstUserMessage, topQuestions } from "@/lib/chatbot/conversation-analytics";

// ---------------------------------------------------------------------------
// Property drill-down (SG cockpit slice 2): one batched read per source for
// a single property. Same rules as the portfolio: real numbers only, a
// source that isn't connected is null (the UI says so), never a zero.
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const dayStart = (t: number) => Math.floor(t / DAY) * DAY;

export type CockpitListing = {
  id: string;
  unit: string;
  kind: ListingKind;
  beds: number | null;
  priceCents: number | null;
  listedAt: Date | null;
  availableFrom: Date | null;
  nextTerm: boolean;
  /** AppFolio posting: on its listings site and/or syndicated (Zillow etc.). */
  posted: { website: boolean; internet: boolean };
};

export type QueryRow = { query: string; clicks: number; impressions: number; position: number | null; prevPosition: number | null };
export type PageRow = { path: string; sessions: number; leads: number };
export type Health = { label: string; state: "fresh" | "stale" | "error" | "off" | "prelaunch"; at: Date | null; note?: string };

export type PropertyCockpit = {
  today: Date;
  funnel: {
    visitors: Series | null;
    chats: Series;
    leads: Series;
    leadMix: { chat: number; popup: number; other: number };
    apps: Series | null; // null = AppFolio not connected
    /** False when the building was activated too recently for a fair prior
     *  window (AppFolio imports only while ACTIVE, plus a 30-day backfill). */
    appsComparable: boolean;
  };
  listings: CockpitListing[];
  queries: QueryRow[] | null; // null = Search Console not connected
  pages: PageRow[] | null; // null = GA4 not connected
  chat: {
    top: { question: string; count: number }[];
    unanswered: { question: string; count: number; at: Date }[];
    suggestions: { id: string; text: string; affected: number }[];
    conversations: number;
  };
  popup: { shown: number; clicked: number; converted: number; prevShown: number; prevConverted: number; live: boolean } | null;
  health: Health[];
  /** Website live on its own domain (siteLive). */
  live: boolean;
};

// The bot admits it lacks the answer ("I don't have that in front of me",
// "I'm not sure"). Narrow on purpose: asking for an email is not a punt.
const NO_ANSWER = /\bI (?:don'?t|do not) (?:have|know)\b|\bI'?m not sure\b|in front of me|on hand\b|can'?t confirm|cannot confirm/i;

type Msg = { role?: string; content?: string };

/** User questions the bot answered with "I don't have that", with that reply. */
export function unansweredExchanges(messages: unknown): { question: string; reply: string }[] {
  if (!Array.isArray(messages)) return [];
  const out: { question: string; reply: string }[] = [];
  let lastUser: string | null = null;
  for (const m of messages as Msg[]) {
    if (!m || typeof m.content !== "string") continue;
    if (m.role === "user") lastUser = m.content.trim();
    else if (m.role === "assistant" && lastUser && NO_ANSWER.test(m.content)) {
      out.push({ question: lastUser, reply: m.content.trim() });
      lastUser = null;
    }
  }
  return out;
}

export function unansweredQuestions(messages: unknown): string[] {
  return unansweredExchanges(messages).map((e) => e.question);
}

/** Case/punctuation-insensitive key so repeats of a question group. */
export function questionKey(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** "/availability?utm=x" and "https://site.com/availability/" both read "/availability". */
export function pagePath(url: string | null): string | null {
  if (!url || url === "(not set)") return null;
  try {
    const u = new URL(url, "https://x.invalid");
    const p = u.pathname.replace(/\/+$/, "");
    return p || "/";
  } catch {
    return null; // not a URL (GA4 placeholders): no page to attribute to
  }
}

function freshness(label: string, at: Date | null, now: number, staleHours: number, error?: string | null): Health {
  if (error) return { label, state: "error", at, note: error };
  if (!at) return { label, state: "off", at: null };
  return { label, state: now - at.getTime() > staleHours * 3_600_000 ? "stale" : "fresh", at };
}

function mix(leads: { source: string; sourceDetail: string | null }[]) {
  const popup = (l: { source: string; sourceDetail: string | null }) => l.source === "FORM" && Boolean(l.sourceDetail?.startsWith("popup:"));
  return {
    chat: leads.filter((l) => l.source === "CHATBOT").length,
    popup: leads.filter(popup).length,
    other: leads.filter((l) => l.source !== "CHATBOT" && !popup(l)).length,
  };
}

function activity(label: string, live: boolean, last: Date | null, now: number, staleHours: number): Health {
  if (!live) return { label, state: "off", at: null };
  if (!last) return { label, state: "stale", at: null, note: "Live, no activity yet" };
  return freshness(label, last, now, staleHours);
}

function asYes(v: unknown): boolean {
  return typeof v === "string" ? /^(yes|true)$/i.test(v) : v === true;
}

export async function getPropertyCockpit(orgId: string, propertyId: string): Promise<PropertyCockpit> {
  const now = Date.now();
  const today = dayStart(now);
  // Two equal 28-day windows: [since, cur) and [cur, today], today partial.
  const since = new Date(today - (2 * WINDOW - 1) * DAY);
  const cur = new Date(today - (WINDOW - 1) * DAY);
  const where = { orgId, propertyId };
  // Ownership first: every query below is scoped to this org's property.
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId },
    select: { lastSyncedAt: true, websiteUrl: true, backendPlatform: true, lifecycleSetAt: true, chatbotConfig: { select: { chatbotEnabled: true } } },
  });
  if (!property) throw new Error(`property ${propertyId} not found in org`);

  const [listings, snapshots, seo, queries, pages, convDates, curConvs, lastChatRow, leads, apps, popupCur, popupPrev, popupSignups, popupLast, popupLive, suggestions, appfolio] = await Promise.all([
    prisma.listing.findMany({
      where: { propertyId, property: { orgId }, isAvailable: true },
      select: { id: true, unitNumber: true, unitType: true, bedrooms: true, priceCents: true, listedAt: true, availableFrom: true, raw: true },
    }),
    prisma.seoSnapshot.findMany({ where: { ...where, date: { gte: since } }, select: { date: true, organicSessions: true, totalClicks: true } }),
    prisma.seoIntegration.findMany({
      where: { orgId, propertyId, serviceAccountJsonEncrypted: { not: "DEMO_SEED" } },
      select: { provider: true, lastSyncAt: true, lastSyncError: true },
    }),
    prisma.seoQuery.groupBy({
      by: ["query"],
      where: { ...where, date: { gte: cur } },
      _sum: { clicks: true, impressions: true },
      orderBy: { _sum: { impressions: "desc" } },
      take: 8,
    }),
    prisma.seoLandingPage.groupBy({
      by: ["url"],
      where: { ...where, date: { gte: cur } },
      _sum: { sessions: true },
      orderBy: { _sum: { sessions: "desc" } },
      take: 12,
    }),
    prisma.chatbotConversation.findMany({ where: { ...where, createdAt: { gte: since } }, select: { createdAt: true } }),
    // Transcripts only for the current window (questions, page attribution).
    // ponytail: newest 1000 chats; a property past that needs a rollup.
    prisma.chatbotConversation.findMany({
      where: { ...where, createdAt: { gte: cur } },
      select: { createdAt: true, messages: true, pageUrl: true, leadId: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.chatbotConversation.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    // AppFolio-imported applicants are counted under applications.
    prisma.lead.findMany({
      where: { ...where, createdAt: { gte: since }, OR: [{ externalSystem: null }, { externalSystem: { not: "appfolio" } }] },
      select: { createdAt: true, source: true, sourceDetail: true },
    }),
    prisma.application.findMany({ where: { propertyId, property: { orgId }, applicantRole: "PRIMARY", receivedAt: { gte: since } }, select: { receivedAt: true } }),
    prisma.popupEvent.groupBy({ by: ["type"], where: { ...where, occurredAt: { gte: cur } }, _count: { _all: true } }),
    prisma.popupEvent.groupBy({ by: ["type"], where: { ...where, occurredAt: { gte: since, lt: cur } }, _count: { _all: true } }),
    prisma.popupEvent.findMany({ where: { ...where, type: "CONVERTED", occurredAt: { gte: cur } }, select: { pageUrl: true } }),
    prisma.popupEvent.aggregate({ where, _max: { occurredAt: true } }),
    prisma.popupCampaign.count({ where: { orgId, status: "ACTIVE", OR: [{ propertyId }, { propertyId: null }] } }),
    prisma.chatbotKnowledgeSuggestion.findMany({
      where: { ...where, status: "OPEN" },
      orderBy: { affectedCount: "desc" },
      take: 3,
      select: { id: true, suggestedText: true, affectedCount: true },
    }),
    prisma.appFolioIntegration.findUnique({ where: { orgId }, select: { lastSyncAt: true, lastError: true } }),
  ]);

  // Position needs impression-weighted averages per query, current and prior.
  const qNames = queries.map((q) => q.query);
  const qRows = qNames.length
    ? await prisma.seoQuery.findMany({
        where: { ...where, date: { gte: since }, query: { in: qNames } },
        select: { query: true, date: true, impressions: true, position: true },
      })
    : [];

  const ga4 = seo.find((s) => s.provider === "GA4") ?? null;
  const gsc = seo.find((s) => s.provider === "GSC") ?? null;
  const live = siteLive(property.websiteUrl);
  const yesterday = today - DAY; // GA4/GSC land a day behind

  // Leads per landing page: chats that captured a lead + pop-up sign-ups.
  const leadsByPath = new Map<string, number>();
  const addLead = (url: string | null) => {
    const p = pagePath(url);
    if (p) leadsByPath.set(p, (leadsByPath.get(p) ?? 0) + 1);
  };
  for (const c of curConvs) if (c.leadId) addLead(c.pageUrl);
  for (const e of popupSignups) addLead(e.pageUrl);

  const pageRows = new Map<string, PageRow>();
  for (const p of pages) {
    const path = pagePath(p.url);
    if (!path) continue;
    const row = pageRows.get(path) ?? { path, sessions: 0, leads: leadsByPath.get(path) ?? 0 };
    row.sessions += p._sum.sessions ?? 0;
    pageRows.set(path, row);
  }

  const weighted = (rows: typeof qRows, from: number, to: number) => {
    const m = new Map<string, { w: number; n: number }>();
    for (const r of rows) {
      const t = r.date.getTime();
      if (t < from || t >= to || !r.impressions) continue;
      const a = m.get(r.query) ?? { w: 0, n: 0 };
      a.w += r.position * r.impressions;
      a.n += r.impressions;
      m.set(r.query, a);
    }
    return m;
  };
  const posNow = weighted(qRows, cur.getTime(), Infinity);
  const posPrev = weighted(qRows, since.getTime(), cur.getTime());
  const avg = (a?: { w: number; n: number }) => (a && a.n ? Math.round((a.w / a.n) * 10) / 10 : null);

  const unanswered = new Map<string, { question: string; count: number; at: Date }>();
  for (const c of curConvs) {
    for (const q of unansweredQuestions(c.messages)) {
      const key = questionKey(q);
      if (!key) continue;
      const u = unanswered.get(key);
      if (u) u.count += 1;
      else unanswered.set(key, { question: q.length > 140 ? `${q.slice(0, 139)}…` : q, count: 1, at: c.createdAt });
    }
  }

  const count = (rows: typeof popupCur, type: string) => rows.find((r) => r.type === type)?._count._all ?? 0;
  const lastChat = lastChatRow?.createdAt ?? null;
  const lastPopup = popupLast._max.occurredAt ?? null;
  const appfolioOn = Boolean(appfolio) && property.backendPlatform === "APPFOLIO";

  return {
    today: new Date(today),
    funnel: {
      visitors: ga4 || gsc ? bucket(snapshots.map((s) => ({ at: s.date, n: Math.max(s.organicSessions, s.totalClicks) })), yesterday) : null,
      chats: bucket(convDates.map((c) => ({ at: c.createdAt })), today),
      leads: bucket(leads.map((l) => ({ at: l.createdAt })), today),
      leadMix: mix(leads.filter((l) => l.createdAt >= cur)),
      appsComparable: !property.lifecycleSetAt || property.lifecycleSetAt.getTime() <= since.getTime() + 30 * DAY,
      apps: appfolioOn ? bucket(apps.map((a) => ({ at: a.receivedAt! })), today) : null,
    },
    listings: listings
      .map((l) => {
        const raw = (l.raw ?? {}) as Record<string, unknown>;
        return {
          id: l.id,
          unit: l.unitNumber ?? "Unnamed",
          kind: listingKind(l),
          beds: l.bedrooms,
          priceCents: l.priceCents && l.priceCents >= 10_000 ? l.priceCents : null,
          listedAt: l.listedAt,
          availableFrom: l.availableFrom,
          nextTerm: NEXT_TERM.test(l.unitNumber ?? ""),
          posted: { website: asYes(raw.posted_to_website), internet: asYes(raw.posted_to_internet) },
        };
      })
      .filter((l) => l.kind !== "other")
      .sort((a, b) => Number(a.nextTerm) - Number(b.nextTerm) || (a.kind === b.kind ? 0 : a.kind === "room" ? -1 : 1) || (a.priceCents ?? 0) - (b.priceCents ?? 0)),
    queries: gsc
      ? queries.map((q) => ({
          query: q.query,
          clicks: q._sum.clicks ?? 0,
          impressions: q._sum.impressions ?? 0,
          position: avg(posNow.get(q.query)),
          prevPosition: avg(posPrev.get(q.query)),
        }))
      : null,
    pages: ga4 ? [...pageRows.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 8) : null,
    chat: {
      top: topQuestions(curConvs.map((c) => extractFirstUserMessage(c.messages)).filter((m): m is string => Boolean(m)), 5),
      unanswered: [...unanswered.values()].sort((a, b) => b.count - a.count || b.at.getTime() - a.at.getTime()).slice(0, 5),
      suggestions: suggestions.map((s) => ({ id: s.id, text: s.suggestedText, affected: s.affectedCount })),
      conversations: curConvs.length,
    },
    popup: popupLive || lastPopup
      ? {
          shown: count(popupCur, "SHOWN"),
          clicked: count(popupCur, "CTA_CLICKED"),
          converted: count(popupCur, "CONVERTED"),
          prevShown: count(popupPrev, "SHOWN"),
          prevConverted: count(popupPrev, "CONVERTED"),
          live: popupLive > 0,
        }
      : null,
    live,
    health: [
      freshness("AppFolio", appfolioOn ? property.lastSyncedAt ?? null : null, now, 36, appfolioOn ? appfolio?.lastError : null),
      live || ga4 ? freshness("GA4", ga4?.lastSyncAt ?? null, now, 36, ga4?.lastSyncError) : { label: "GA4", state: "prelaunch", at: null },
      live || gsc ? freshness("Search Console", gsc?.lastSyncAt ?? null, now, 36, gsc?.lastSyncError) : { label: "Search Console", state: "prelaunch", at: null },
      // Chat and pop-up have no sync: freshness is the last event seen. A
      // live bot or pop-up with nothing yet is "waiting", not "not connected".
      // chatbotEnabled null = inherits the workspace bot: chats prove it is on.
      activity("Chatbot", property.chatbotConfig?.chatbotEnabled === false ? false : Boolean(property.chatbotConfig?.chatbotEnabled) || Boolean(lastChat), lastChat, now, 24 * 7),
      activity("Pop-up", popupLive > 0 || Boolean(lastPopup), lastPopup, now, 24 * 3),
    ],
  };
}

export const total = (s: Series) => sum(s.cur);
