import { prisma } from "@/lib/db";
import { listingKind } from "@/lib/listings/kind";
import { Prisma } from "@prisma/client";
import { LISTED_TRACKING_SINCE, NEXT_TERM, WINDOW, siteLive } from "@/lib/portal/portfolio-overview";
import { questionKey, unansweredQuestions } from "@/lib/portal/property-cockpit";
import type { AppFolioStatus } from "@/lib/integrations/appfolio-status";

// ---------------------------------------------------------------------------
// Today: one ranked list of what needs attention across the portfolio (SG
// cockpit slice 3). Every item comes from a real row and links to the
// property page section that shows it. Batched: one query per source for
// all properties, never one per property.
// ---------------------------------------------------------------------------

const DAY = 86_400_000;

export type AttentionKind = "sync" | "stale-units" | "traffic-no-leads" | "unanswered" | "rank-drop" | "missing-source";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  /** Higher first. Sync failures, then money (vacant units), then funnel leaks. */
  score: number;
  propertyId: string | null;
  propertyName: string | null;
  title: string;
  detail: string;
  source: string;
  href: string;
};

/** Units listed this long count as stale. */
export const LISTED_STALE_DAYS = 30;
/** Fallback until listedAt history exists: past AppFolio's ready-for-showing date this long. */
export const READY_STALE_DAYS = 60;
const TRAFFIC_FLOOR = 50; // search visits in 28 days before "no leads" means something
const DROP_PLACES = 3; // average position worse by this many places
const DROP_MIN_IMPRESSIONS = 20;

/** chatbotConfigured: the property's own setting, null = uses the workspace bot. */
type Prop = { id: string; name: string; chatbotConfigured: boolean | null; live: boolean };

/**
 * @param propertyIds properties in view (null = all ACTIVE).
 * @param orgWide the viewer may see workspace-wide items (the AppFolio feed
 *   is one per workspace; a property-restricted user gets nothing from it).
 */
export async function getNeedsAttention(orgId: string, propertyIds: string[] | null, appfolio: AppFolioStatus | null, orgWide: boolean): Promise<AttentionItem[]> {
  const now = Date.now();
  const today = Math.floor(now / DAY) * DAY;
  const cur = new Date(today - (WINDOW - 1) * DAY);
  const since = new Date(today - (2 * WINDOW - 1) * DAY);

  const props = await prisma.property.findMany({
    where: { orgId, lifecycle: "ACTIVE", ...(propertyIds ? { id: { in: propertyIds } } : {}) },
    select: { id: true, name: true, websiteUrl: true, chatbotConfig: { select: { chatbotEnabled: true } } },
    take: 200,
  });
  if (!props.length) return [];
  const ids = props.map((p) => p.id);
  const byId = new Map<string, Prop>(props.map((p) => [p.id, { id: p.id, name: p.name, chatbotConfigured: p.chatbotConfig ? Boolean(p.chatbotConfig.chatbotEnabled) : null, live: siteLive(p.websiteUrl) }]));
  const inProps = { orgId, propertyId: { in: ids } };

  const [listings, visits, leads, seo, drops, convs, chatted, suggestions] = await Promise.all([
    prisma.listing.findMany({
      where: { propertyId: { in: ids }, property: { orgId }, isAvailable: true },
      select: { propertyId: true, unitNumber: true, unitType: true, raw: true, listedAt: true, availableFrom: true },
    }),
    prisma.seoSnapshot.groupBy({ by: ["propertyId"], where: { ...inProps, date: { gte: cur } }, _sum: { organicSessions: true, totalClicks: true } }),
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: { ...inProps, createdAt: { gte: cur }, OR: [{ externalSystem: null }, { externalSystem: { not: "appfolio" } }] },
      _count: { _all: true },
    }),
    prisma.seoIntegration.findMany({
      where: { orgId, propertyId: { in: ids }, serviceAccountJsonEncrypted: { not: "DEMO_SEED" } },
      select: { propertyId: true, provider: true, lastSyncError: true },
    }),
    // Impression-weighted average position per query, each window, in SQL.
    prisma.$queryRaw<{ propertyId: string; query: string; cur: number; prev: number; curImp: bigint; prevImp: bigint }[]>(Prisma.sql`
      SELECT "propertyId", query,
        SUM(position * impressions) FILTER (WHERE date >= ${cur}) / NULLIF(SUM(impressions) FILTER (WHERE date >= ${cur}), 0) AS cur,
        SUM(position * impressions) FILTER (WHERE date < ${cur}) / NULLIF(SUM(impressions) FILTER (WHERE date < ${cur}), 0) AS prev,
        COALESCE(SUM(impressions) FILTER (WHERE date >= ${cur}), 0) AS "curImp",
        COALESCE(SUM(impressions) FILTER (WHERE date < ${cur}), 0) AS "prevImp"
      FROM "SeoQuery"
      WHERE "orgId" = ${orgId} AND "propertyId" IN (${Prisma.join(ids)}) AND date >= ${since} AND impressions > 0
      GROUP BY "propertyId", query
      HAVING SUM(impressions) FILTER (WHERE date >= ${cur}) >= ${DROP_MIN_IMPRESSIONS}
         AND SUM(impressions) FILTER (WHERE date < ${cur}) >= ${DROP_MIN_IMPRESSIONS}`),
    // ponytail: newest 500 chats across the portfolio (SG: ~40 a month);
    // a much busier workspace needs the no-answer check at write time.
    prisma.chatbotConversation.findMany({
      where: { ...inProps, createdAt: { gte: cur } },
      select: { propertyId: true, messages: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    // Same evidence and window as the portfolio table's chatbot dot.
    prisma.chatbotConversation.groupBy({ by: ["propertyId"], where: { ...inProps, createdAt: { gte: since } } }),
    prisma.chatbotKnowledgeSuggestion.findMany({
      where: { ...inProps, status: "OPEN" },
      select: { propertyId: true },
    }),
  ]);

  const items: AttentionItem[] = [];
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? null : null);
  const page = (id: string, anchor: string) => `/portal/properties/${id}#${anchor}`;

  // 1. Sync failures. AppFolio is one feed for the whole workspace.
  if (orgWide && appfolio && (appfolio.state === "failed" || appfolio.state === "partial")) {
    items.push({
      id: "sync:appfolio",
      kind: "sync",
      score: 100,
      propertyId: null,
      propertyName: null,
      title: appfolio.state === "failed" ? "AppFolio sync failed" : "AppFolio sync partly failed",
      detail: (appfolio.lastError ?? "Unknown error").slice(0, 160),
      source: "AppFolio",
      href: "/portal/settings/integrations#appfolio",
    });
  }
  for (const s of seo) {
    if (!s.lastSyncError || !s.propertyId) continue;
    const label = s.provider === "GSC" ? "Search Console" : s.provider;
    items.push({
      id: `sync:${s.provider}:${s.propertyId}`,
      kind: "sync",
      score: 90,
      propertyId: s.propertyId,
      propertyName: name(s.propertyId),
      title: `${label} sync failed`,
      detail: s.lastSyncError.slice(0, 160),
      source: label,
      href: page(s.propertyId, "data-health"),
    });
  }

  // 2. Units sitting on the market. True days listed once listedAt has
  // history; until then AppFolio's ready-for-showing date, labelled as such.
  const stale = new Map<string, { listed: number[]; ready: number[] }>();
  for (const l of listings) {
    if (listingKind(l) === "other" || NEXT_TERM.test(l.unitNumber ?? "")) continue;
    const s = stale.get(l.propertyId) ?? { listed: [], ready: [] };
    if (l.listedAt) {
      const d = Math.floor((now - l.listedAt.getTime()) / DAY);
      if (d >= LISTED_STALE_DAYS) s.listed.push(d);
    } else if (l.availableFrom) {
      const d = Math.floor((now - l.availableFrom.getTime()) / DAY);
      if (d >= READY_STALE_DAYS) s.ready.push(d);
    }
    stale.set(l.propertyId, s);
  }
  for (const [pid, s] of stale) {
    if (s.listed.length) {
      const oldest = Math.max(...s.listed);
      items.push({
        id: `listed:${pid}`,
        kind: "stale-units",
        score: 70 + Math.min(20, s.listed.length * 3),
        propertyId: pid,
        propertyName: name(pid),
        title: `${s.listed.length} unit${s.listed.length === 1 ? "" : "s"} listed ${LISTED_STALE_DAYS}+ days`,
        detail: `Oldest on the market ${oldest} days.`,
        source: "AppFolio listings",
        href: page(pid, "units"),
      });
    }
  }
  // ready-for-showing is a weak proxy (template listings keep 2020 dates),
  // so it is one portfolio-level item, not one per building.
  const ready = [...stale].filter(([, s]) => s.ready.length).sort((a, b) => b[1].ready.length - a[1].ready.length);
  if (ready.length) {
    const units = ready.reduce((n, [, s]) => n + s.ready.length, 0);
    items.push({
      id: "ready:portfolio",
      kind: "stale-units",
      score: 50,
      propertyId: ready[0][0],
      propertyName: null,
      title: `${units} unit${units === 1 ? " past its" : "s past their"} ready-for-showing date by ${READY_STALE_DAYS}+ days`,
      detail: ready.slice(0, 3).map(([pid, s]) => `${name(pid)} ${s.ready.length}`).join(" · ") + (ready.length > 3 ? ` · ${ready.length - 3} more` : ""),
      source: `AppFolio ready date · days on market tracked since ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(LISTED_TRACKING_SINCE)}`,
      href: page(ready[0][0], "units"),
    });
  }

  // 3. Search traffic that produces no website leads.
  const leadsBy = new Map(leads.map((l) => [l.propertyId, l._count._all]));
  for (const v of visits) {
    if (!v.propertyId) continue;
    const n = Math.max(v._sum.organicSessions ?? 0, v._sum.totalClicks ?? 0);
    if (n < TRAFFIC_FLOOR || (leadsBy.get(v.propertyId) ?? 0) > 0) continue;
    items.push({
      id: `traffic:${v.propertyId}`,
      kind: "traffic-no-leads",
      score: 60 + Math.min(20, Math.floor(n / 50)),
      propertyId: v.propertyId,
      propertyName: name(v.propertyId),
      title: `${n} search visits, no website leads`,
      detail: "Last 28 days. Check the chatbot and pop-up are on the pages people land on.",
      source: "GA4 + Search Console, LeaseStack leads",
      href: page(v.propertyId, "pages"),
    });
  }

  // 4. Questions the chatbot couldn't answer, with the drafted fix if any.
  const unanswered = new Map<string, string[]>();
  for (const c of convs) {
    if (!c.propertyId) continue;
    // Distinct questions, same normalisation as the property page.
    const seen = new Map((unanswered.get(c.propertyId) ?? []).map((q) => [questionKey(q), q]));
    for (const q of unansweredQuestions(c.messages)) if (questionKey(q) && !seen.has(questionKey(q))) seen.set(questionKey(q), q);
    if (seen.size) unanswered.set(c.propertyId, [...seen.values()]);
  }
  // Any open fix counts, including "Needs SG's answer" proposals (no draft text yet).
  const hasFix = new Set(suggestions.map((s) => s.propertyId).filter(Boolean));
  for (const [pid, qs] of unanswered) {
    const fix = hasFix.has(pid);
    items.push({
      id: `unanswered:${pid}`,
      kind: "unanswered",
      score: 45 + Math.min(20, qs.length * 4),
      propertyId: pid,
      propertyName: name(pid),
      title: `Chatbot couldn't answer ${qs.length} question${qs.length === 1 ? "" : "s"}`,
      detail: `"${qs[0].slice(0, 80)}"${fix ? " · proposed fixes are waiting in Suggested fixes" : " · add the answer to the knowledge base"}`,
      source: "LeaseStack chatbot",
      href: fix ? `/portal/conversations/insights?property=${pid}` : page(pid, "questions"),
    });
  }

  // 5. Google position drops: impression-weighted average position per
  // query, last 28 days vs the 28 before (computed in SQL above).
  const dropsBy = new Map<string, { query: string; from: number; to: number; impressions: number }[]>();
  for (const d of drops) {
    const to = Number(d.cur);
    const from = Number(d.prev);
    if (!(to - from >= DROP_PLACES)) continue;
    dropsBy.set(d.propertyId, [...(dropsBy.get(d.propertyId) ?? []), { query: d.query, from, to, impressions: Number(d.curImp) }]);
  }
  for (const [pid, ds] of dropsBy) {
    const worst = ds.sort((x, y) => y.impressions - x.impressions)[0];
    items.push({
      id: `rank:${pid}`,
      kind: "rank-drop",
      score: 40 + Math.min(20, ds.length * 4),
      propertyId: pid,
      propertyName: name(pid),
      title: `Google position dropped on ${ds.length} search${ds.length === 1 ? "" : "es"}`,
      detail: `"${worst.query}" ${worst.from.toFixed(1)} → ${worst.to.toFixed(1)}`,
      source: "Search Console",
      href: page(pid, "search"),
    });
  }

  // 6. Missing data sources: one item per source, naming the buildings.
  // A property without its own chatbot config uses the workspace bot, so
  // chats are the evidence it is on.
  const chattedIds = new Set(chatted.map((c) => c.propertyId));
  const analytics = new Set(seo.map((s) => s.propertyId));
  const missing: [string, Prop[]][] = [
    // A site still on a preview host can't be connected yet: not a gap.
    ["GA4 / Search Console", [...byId.values()].filter((p) => p.live && !analytics.has(p.id))],
    ["Chatbot", [...byId.values()].filter((p) => p.chatbotConfigured !== true && !chattedIds.has(p.id))],
  ];
  for (const [label, list] of missing) {
    if (!list.length) continue;
    const names = list.map((p) => p.name).sort();
    items.push({
      id: `missing:${label}`,
      kind: "missing-source",
      score: 20 + Math.min(10, list.length),
      propertyId: list.length === 1 ? list[0].id : null,
      propertyName: null,
      title: `${label} not connected on ${list.length} site${list.length === 1 ? "" : "s"}`,
      detail: names.slice(0, 4).join(" · ") + (names.length > 4 ? ` · ${names.length - 4} more` : ""),
      source: "Setup",
      // Setup, not the property page: a property with no data yet shows
      // its onboarding card there, without the cockpit's anchors.
      href: "/portal/setup",
    });
  }

  return items.sort((a, b) => b.score - a.score || (a.propertyName ?? "").localeCompare(b.propertyName ?? ""));
}
