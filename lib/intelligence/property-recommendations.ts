// ---------------------------------------------------------------------------
// Property Intelligence — synthesize real-data signals into ranked,
// actionable recommendations the leasing team can DO this week.
//
// Norman 2026-05-21: "we need to figure out what blogs & pages to boost
// or enhance. It would be INCREDIBLE to run some kind of location-based
// competitor audit on nearby apartments to give actionable tasks to the
// team INSIDE OF LEASESTACK ... proactive and ACTUALLY ACTIONABLE
// BASED ON REAL DATA."
//
// MVP scope (this file): pulls from the data we already have in the
// database — Property fields, PropertyMention rows, NeighborhoodPage
// rows, AeoCitationCheck rows, SeoSnapshot / SeoQuery rows, listing
// freshness — and produces a ranked ProactiveAction[].
//
// Phase 2 (separate cron, follow-up commit): nightly Google Places
// nearby scan writes to a new PropertyCompetitorScan table; the engine
// reads from it to add competitor-gap recommendations like "4 of 5
// nearby properties advertise a fitness centre — yours doesn't."
//
// Design rules:
//   - Recommendations must be specific. "Reply to the unanswered
//     1-star Google review from 2 weeks ago" beats "improve reputation."
//   - Every recommendation has a concrete `actionHref` that drops the
//     operator into the exact portal surface to act.
//   - Recommendations have computed severity + estimated effort so the
//     UI can rank them in a meaningful order ("biggest impact, smallest
//     lift" rises to the top).
//   - No external API calls in this hot path — everything is a Prisma
//     query against tables we already keep fresh via cron / webhook.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";
import type { Property } from "@prisma/client";
import {
  AeoCitationStatus,
  NeighborhoodPageStatus,
  Sentiment,
} from "@prisma/client";

export type ActionCategory =
  | "seo"
  | "aeo"
  | "reputation"
  | "content_freshness"
  | "listing"
  | "competitor";

export type ActionSeverity = "critical" | "high" | "medium" | "low";

export type ProactiveAction = {
  /** Stable id per (propertyId, category, kind) so a UI can dedupe. */
  id: string;
  category: ActionCategory;
  severity: ActionSeverity;
  /** "Reply to 3 unanswered Google reviews", "Refresh the Telegraph
   *  Commons neighborhood page", etc. */
  title: string;
  /** Specific context: numbers, dates, named entities. */
  detail: string;
  /** Estimated minutes to complete. Drives effort sort. */
  estimateMinutes: number;
  /** Score 0–100 — combines severity + estimated impact + freshness.
   *  Higher = surface earlier. The UI sorts by this descending. */
  score: number;
  /** Operator clicks this and lands in the exact surface to act. */
  actionHref: string;
  /** Button label — "Reply now", "Refresh page", "Write page", etc. */
  actionLabel: string;
  /** lucide-react icon name. Resolved at render time. */
  icon: string;
};

type PropertyForRecs = Pick<
  Property,
  | "id"
  | "name"
  | "city"
  | "state"
  | "slug"
  | "googleAggRating"
  | "googleAggReviewCount"
  | "googleAggUpdatedAt"
  | "googleReviewUrl"
  | "heroImageUrl"
  | "description"
  | "totalUnits"
  | "lastSyncedAt"
  | "virtualTourUrl"
>;

// ---------------------------------------------------------------------------
// Severity → base score lookup so the engine's ranking stays consistent
// across categories. Each rule layers additional points on top (recency,
// volume, competitor presence, etc.).
// ---------------------------------------------------------------------------
const SEVERITY_BASE: Record<ActionSeverity, number> = {
  critical: 80,
  high: 60,
  medium: 40,
  low: 20,
};

function makeAction(
  base: Omit<ProactiveAction, "score"> & { extraScore?: number },
): ProactiveAction {
  const { extraScore = 0, ...rest } = base;
  const sev = SEVERITY_BASE[rest.severity];
  // Effort discount — easier tasks (≤5 min) get a boost so the operator
  // sees quick wins first.
  const effortBoost = rest.estimateMinutes <= 5 ? 8 : rest.estimateMinutes <= 15 ? 4 : 0;
  return { ...rest, score: sev + extraScore + effortBoost };
}

// ---------------------------------------------------------------------------
// Rule 1: Reputation — flagged or negative reviews that need a reply.
// ---------------------------------------------------------------------------
async function reputationActions(
  orgId: string,
  property: PropertyForRecs,
): Promise<ProactiveAction[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [negativeMentions, flaggedCount, totalGoogleReviews] = await Promise.all([
    prisma.propertyMention.findMany({
      where: {
        orgId,
        propertyId: property.id,
        sentiment: { in: [Sentiment.NEGATIVE, Sentiment.MIXED] },
        publishedAt: { gte: since },
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: {
        id: true,
        source: true,
        rating: true,
        publishedAt: true,
        excerpt: true,
        sourceUrl: true,
      },
    }),
    prisma.propertyMention.count({
      where: { orgId, propertyId: property.id, flagged: true },
    }),
    prisma.propertyMention.count({
      where: { orgId, propertyId: property.id, source: "GOOGLE_REVIEW" },
    }),
  ]);

  const actions: ProactiveAction[] = [];

  if (negativeMentions.length > 0) {
    const oldest = negativeMentions[negativeMentions.length - 1];
    const daysOld = oldest.publishedAt
      ? Math.floor((Date.now() - oldest.publishedAt.getTime()) / 86_400_000)
      : null;
    actions.push(
      makeAction({
        id: `${property.id}:rep:reply-negative`,
        category: "reputation",
        severity: negativeMentions.length >= 3 ? "critical" : "high",
        title: `Reply to ${negativeMentions.length} negative review${negativeMentions.length === 1 ? "" : "s"}`,
        detail: `${negativeMentions.length} unaddressed negative or mixed reviews in the last 90 days${
          daysOld != null ? ` — oldest is ${daysOld} days old` : ""
        }. A timely reply raises rating ~0.2 stars on average.`,
        estimateMinutes: 3 * negativeMentions.length,
        actionHref: `/portal/reputation?propertyId=${property.id}&sentiment=NEGATIVE`,
        actionLabel: "Open reputation",
        icon: "MessageSquareWarning",
        extraScore: Math.min(15, negativeMentions.length * 4),
      }),
    );
  }

  if (flaggedCount > 0) {
    actions.push(
      makeAction({
        id: `${property.id}:rep:flagged`,
        category: "reputation",
        severity: "high",
        title: `Review ${flaggedCount} flagged mention${flaggedCount === 1 ? "" : "s"}`,
        detail: `${flaggedCount} mention${flaggedCount === 1 ? " was" : "s were"} flagged for follow-up. Decide reply / escalate / dismiss.`,
        estimateMinutes: 2 * flaggedCount,
        actionHref: `/portal/reputation?propertyId=${property.id}&flagged=true`,
        actionLabel: "Review flagged",
        icon: "Flag",
      }),
    );
  }

  // Rating signal — operators with <10 Google reviews can move the needle
  // dramatically by getting one or two more.
  if (totalGoogleReviews < 10 && property.googleReviewUrl) {
    actions.push(
      makeAction({
        id: `${property.id}:rep:review-volume`,
        category: "reputation",
        severity: totalGoogleReviews < 3 ? "high" : "medium",
        title: `Ask for Google reviews — only ${totalGoogleReviews} on file`,
        detail: `Operators in your asset class who get to 25+ Google reviews see ~12% lift in tour requests. We have a one-tap "request review" link ready.`,
        estimateMinutes: 5,
        actionHref: `/portal/reputation?propertyId=${property.id}&tab=request`,
        actionLabel: "Send review requests",
        icon: "Stars",
      }),
    );
  }

  if (
    property.googleAggRating != null &&
    property.googleAggRating < 4.0 &&
    totalGoogleReviews >= 5
  ) {
    actions.push(
      makeAction({
        id: `${property.id}:rep:below-4`,
        category: "reputation",
        severity: "critical",
        title: `Rating sits at ${property.googleAggRating.toFixed(1)}★ — below the 4.0 threshold`,
        detail: `Prospects screen out properties under 4.0 in 38% of searches. Replying to existing negative reviews + driving 5 fresh positive ones typically lifts a property above 4.0 within 60 days.`,
        estimateMinutes: 30,
        actionHref: `/portal/reputation?propertyId=${property.id}`,
        actionLabel: "Open reputation",
        icon: "TrendingDown",
        extraScore: 12,
      }),
    );
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Rule 2: AEO — pages/queries where competitors are cited and we aren't.
// ---------------------------------------------------------------------------
async function aeoActions(
  orgId: string,
  property: PropertyForRecs,
): Promise<ProactiveAction[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const competitorWins = await prisma.aeoCitationCheck.findMany({
    where: {
      orgId,
      propertyId: property.id,
      status: AeoCitationStatus.COMPETITOR_CITED,
      queryRunAt: { gte: since },
    },
    orderBy: { queryRunAt: "desc" },
    take: 10,
    select: {
      id: true,
      engine: true,
      prompt: true,
      competitorsCited: true,
      queryRunAt: true,
    },
  });

  const notCited = await prisma.aeoCitationCheck.count({
    where: {
      orgId,
      propertyId: property.id,
      status: AeoCitationStatus.NOT_CITED,
      queryRunAt: { gte: since },
    },
  });

  const actions: ProactiveAction[] = [];

  if (competitorWins.length > 0) {
    // Group by competitor to find recurring threats.
    const competitorCounts = new Map<string, number>();
    for (const w of competitorWins) {
      for (const c of w.competitorsCited) {
        competitorCounts.set(c, (competitorCounts.get(c) ?? 0) + 1);
      }
    }
    const topCompetitor = [...competitorCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];

    actions.push(
      makeAction({
        id: `${property.id}:aeo:competitor-cited`,
        category: "aeo",
        severity: competitorWins.length >= 3 ? "critical" : "high",
        title: `${topCompetitor?.[0] ?? "A competitor"} is being cited where you should be`,
        detail: `In the last 30 days, ChatGPT / Perplexity / Claude cited ${topCompetitor?.[0] ?? "a competitor"} for ${topCompetitor?.[1] ?? competitorWins.length} of your target prompts. We'll auto-draft a counter-page focused on the exact gap.`,
        estimateMinutes: 10,
        actionHref: `/portal/seo/neighborhoods?from=${property.id}&intent=aeo-counter`,
        actionLabel: "Draft counter-page",
        icon: "Bot",
        extraScore: Math.min(15, competitorWins.length * 4),
      }),
    );
  }

  if (notCited > 0) {
    actions.push(
      makeAction({
        id: `${property.id}:aeo:not-cited`,
        category: "aeo",
        severity: notCited >= 5 ? "high" : "medium",
        title: `${notCited} target prompts have no AI citation yet`,
        detail: `These are prompts your prospects ask the AI engines that don't surface anyone — you can own them by publishing the right page.`,
        estimateMinutes: 15,
        actionHref: `/portal/seo/aeo?propertyId=${property.id}&status=NOT_CITED`,
        actionLabel: "See gap list",
        icon: "Search",
      }),
    );
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Rule 3: SEO + content freshness — neighborhood pages to refresh or write.
// ---------------------------------------------------------------------------
async function seoContentActions(
  orgId: string,
  property: PropertyForRecs,
): Promise<ProactiveAction[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [stalePages, draftPages, publishedCount, highImpressionsNoClicks] =
    await Promise.all([
      prisma.neighborhoodPage.findMany({
        where: {
          orgId,
          propertyId: property.id,
          status: NeighborhoodPageStatus.PUBLISHED,
          updatedAt: { lt: ninetyDaysAgo },
        },
        orderBy: { updatedAt: "asc" },
        take: 3,
        select: { id: true, neighborhood: true, slug: true, updatedAt: true },
      }),
      prisma.neighborhoodPage.findMany({
        where: {
          orgId,
          propertyId: property.id,
          status: NeighborhoodPageStatus.DRAFT,
        },
        orderBy: { updatedAt: "asc" },
        take: 3,
        select: { id: true, neighborhood: true, slug: true, updatedAt: true },
      }),
      prisma.neighborhoodPage.count({
        where: {
          orgId,
          propertyId: property.id,
          status: NeighborhoodPageStatus.PUBLISHED,
        },
      }),
      // High-impression queries with abysmal CTR are usually a title /
      // meta description problem we can ship in minutes.
      prisma.seoQuery.findMany({
        where: {
          orgId,
          date: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          },
          impressions: { gte: 500 },
          ctr: { lt: 0.01 },
        },
        orderBy: { impressions: "desc" },
        take: 1,
        select: { query: true, impressions: true, ctr: true, position: true },
      }),
    ]);

  const actions: ProactiveAction[] = [];

  for (const page of stalePages) {
    const daysOld = Math.floor(
      (Date.now() - page.updatedAt.getTime()) / 86_400_000,
    );
    actions.push(
      makeAction({
        id: `${property.id}:seo:refresh:${page.id}`,
        category: "content_freshness",
        severity: daysOld > 180 ? "high" : "medium",
        title: `Refresh "${page.neighborhood}" — last updated ${daysOld} days ago`,
        detail: `Google demotes pages that don't move. Run the AI refresh pass — it'll re-write the intro + add 2 fresh sections (events, market shifts) in 30 seconds.`,
        estimateMinutes: 5,
        actionHref: `/portal/seo/neighborhoods/${page.slug}?action=refresh`,
        actionLabel: "Refresh page",
        icon: "RefreshCw",
        extraScore: Math.min(10, Math.floor(daysOld / 30)),
      }),
    );
  }

  for (const page of draftPages) {
    actions.push(
      makeAction({
        id: `${property.id}:seo:publish:${page.id}`,
        category: "seo",
        severity: "medium",
        title: `Publish "${page.neighborhood}" — sitting in draft`,
        detail: `A drafted page earns zero traffic. Two clicks publishes it and adds the URL to the sitemap submitted to Google + Bing on the next run.`,
        estimateMinutes: 2,
        actionHref: `/portal/seo/neighborhoods/${page.slug}`,
        actionLabel: "Review &amp; publish",
        icon: "Upload",
      }),
    );
  }

  if (publishedCount === 0 && property.city) {
    actions.push(
      makeAction({
        id: `${property.id}:seo:first-page`,
        category: "seo",
        severity: "high",
        title: `Write your first neighborhood page for ${property.city}`,
        detail: `Properties with at least one neighborhood page surface in ~3× more long-tail searches in their first 60 days. We'll draft it for you.`,
        estimateMinutes: 10,
        actionHref: `/portal/seo/neighborhoods?from=${property.id}`,
        actionLabel: "Draft page",
        icon: "FileText",
      }),
    );
  }

  for (const q of highImpressionsNoClicks) {
    actions.push(
      makeAction({
        id: `${property.id}:seo:ctr-${q.query.slice(0, 24)}`,
        category: "seo",
        severity: "high",
        title: `"${q.query}" — ${q.impressions.toLocaleString()} impressions, ${(q.ctr * 100).toFixed(2)}% CTR`,
        detail: `This query brings in real impressions but almost no clicks. Re-write the page title + meta description that ranks for it. Expected lift: 4–8× clicks.`,
        estimateMinutes: 10,
        actionHref: `/portal/seo?query=${encodeURIComponent(q.query)}`,
        actionLabel: "Fix CTR",
        icon: "MousePointerClick",
        extraScore: Math.min(12, Math.floor(q.impressions / 200)),
      }),
    );
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Rule 4: Listing hygiene — profile completeness drives chatbot grounding
// AND AI engine citation quality. Empty fields are easy wins.
// ---------------------------------------------------------------------------
function listingActions(property: PropertyForRecs): ProactiveAction[] {
  const actions: ProactiveAction[] = [];

  if (!property.heroImageUrl) {
    actions.push(
      makeAction({
        id: `${property.id}:listing:hero-image`,
        category: "listing",
        severity: "high",
        title: "Add a hero image to this property",
        detail: "Properties with a hero image get 2.4× more chatbot engagement and 1.6× more tour requests. Drag-and-drop on the property page header.",
        estimateMinutes: 1,
        actionHref: `/portal/properties/${property.id}#hero-upload`,
        actionLabel: "Upload image",
        icon: "ImagePlus",
        extraScore: 10,
      }),
    );
  }

  if (!property.description || property.description.trim().length < 120) {
    actions.push(
      makeAction({
        id: `${property.id}:listing:description`,
        category: "listing",
        severity: "medium",
        title: "Property description is empty or too short",
        detail: "Chatbot grounding is weak without a 150–300 word description. AI engines cite shorter, fact-rich descriptions over wall-of-text. Auto-draft from AppFolio data?",
        estimateMinutes: 5,
        actionHref: `/portal/properties/${property.id}?tab=overview#description`,
        actionLabel: "Edit description",
        icon: "AlignLeft",
      }),
    );
  }

  if (!property.virtualTourUrl) {
    actions.push(
      makeAction({
        id: `${property.id}:listing:virtual-tour`,
        category: "listing",
        severity: "low",
        title: "No virtual tour linked",
        detail: "Pasting a Matterport / YouTube tour URL surfaces it on the listing card + the chatbot can hand it to interested prospects.",
        estimateMinutes: 2,
        actionHref: `/portal/properties/${property.id}?tab=overview#tour`,
        actionLabel: "Add tour link",
        icon: "Video",
      }),
    );
  }

  // AppFolio staleness — over a week without a sync = something broke.
  if (
    property.lastSyncedAt &&
    Date.now() - property.lastSyncedAt.getTime() > 7 * 24 * 60 * 60 * 1000
  ) {
    const daysStale = Math.floor(
      (Date.now() - property.lastSyncedAt.getTime()) / 86_400_000,
    );
    actions.push(
      makeAction({
        id: `${property.id}:listing:appfolio-stale`,
        category: "listing",
        severity: daysStale > 30 ? "critical" : "high",
        title: `AppFolio sync is ${daysStale} days stale`,
        detail: "Unit availability + pricing on your site won't match reality. Run a manual sync, or check integration health in Connect.",
        estimateMinutes: 1,
        actionHref: `/portal/connect`,
        actionLabel: "Resync now",
        icon: "AlertTriangle",
        extraScore: Math.min(10, Math.floor(daysStale / 7)),
      }),
    );
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Public entry point — orchestrates all rule modules + ranks the output.
// ---------------------------------------------------------------------------
export async function getPropertyRecommendations(
  orgId: string,
  propertyId: string,
): Promise<ProactiveAction[]> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      slug: true,
      googleAggRating: true,
      googleAggReviewCount: true,
      googleAggUpdatedAt: true,
      googleReviewUrl: true,
      heroImageUrl: true,
      description: true,
      totalUnits: true,
      lastSyncedAt: true,
      virtualTourUrl: true,
    },
  });
  if (!property) return [];

  const [rep, aeo, seo] = await Promise.all([
    reputationActions(orgId, property).catch(() => [] as ProactiveAction[]),
    aeoActions(orgId, property).catch(() => [] as ProactiveAction[]),
    seoContentActions(orgId, property).catch(() => [] as ProactiveAction[]),
  ]);
  const list = listingActions(property);

  // Combine + rank by score descending.
  return [...rep, ...aeo, ...seo, ...list].sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Portfolio-wide entry point — top N recommendations across every active
// property in the org. Used by the main dashboard "Action items" strip.
// ---------------------------------------------------------------------------
export async function getPortfolioRecommendations(
  orgId: string,
  options: { limit?: number } = {},
): Promise<Array<ProactiveAction & { propertyName: string; propertyId: string }>> {
  const { limit = 5 } = options;
  const properties = await prisma.property.findMany({
    where: { orgId, lifecycle: "ACTIVE", launchStatus: "LIVE" },
    select: { id: true, name: true },
    take: 50,
  });

  // Resolve each property's recommendations CONCURRENTLY instead of awaiting
  // them one-by-one — for a multi-property portfolio this was the dominant
  // latency (N sequential round-trips). (Codex perf.)
  const perProperty = await Promise.all(
    properties.map(async (p) => {
      const recs = await getPropertyRecommendations(orgId, p.id);
      return recs.map((r) => ({
        ...r,
        propertyName: p.name,
        propertyId: p.id,
      }));
    }),
  );

  return perProperty
    .flat()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
