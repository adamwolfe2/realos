import "server-only";
import { prisma } from "@/lib/db";
import {
  MentionSource,
  Prisma,
  ReputationScanStatus,
  Sentiment,
} from "@prisma/client";
import { hashUrl } from "./dedupe";
import {
  searchTavily,
  TAVILY_COST_CENTS_PER_QUERY,
  TAVILY_QUERIES_PER_SCAN,
  LISTING_BLOCKLIST,
  deriveOwnedDomains,
  deriveOwnedSocialPaths,
  isOwnedHost,
  isOwnedSocialPage,
  isListingUrl,
  isWrongBusinessPage,
} from "./tavily";
import {
  searchGooglePlaces,
  GOOGLE_PLACES_COST_CENTS_PER_CALL,
} from "./google-places";
import {
  analyzeSentimentAndTopics,
  ANALYSIS_COST_CENTS_PER_SCAN,
} from "./analyze";
import type {
  PropertySeed,
  ScanProgressEvent,
  ScannedMention,
  ScanSourceResult,
  SourceKey,
} from "./types";

// ---------------------------------------------------------------------------
// Orchestrator: fans out to all source clients in parallel, deduplicates
// results against existing PropertyMention rows for the property, runs
// Claude Haiku sentiment + topic classification on the *new* mentions only,
// and persists everything (ReputationScan + upsert PropertyMention).
//
// Exposed as an async generator so the API route can stream SSE events
// without the orchestrator needing to know the transport.
// ---------------------------------------------------------------------------

const MAX_MENTIONS_TO_ANALYZE = 80;
const ALL_SOURCES: SourceKey[] = ["google", "tavily"];

export type OrchestrateArgs = {
  property: PropertySeed;
  triggeredByUserId: string;
};

export async function* orchestrateScan(
  args: OrchestrateArgs
): AsyncGenerator<ScanProgressEvent, void, void> {
  const start = Date.now();
  const { property, triggeredByUserId } = args;

  // Create the ReputationScan row up front so we have a stable scanId to
  // reference from PropertyMention.firstSeenScanId.
  const scan = await prisma.reputationScan.create({
    data: {
      orgId: property.orgId,
      propertyId: property.id,
      triggeredByUserId,
      status: ReputationScanStatus.RUNNING,
    },
    select: { id: true },
  });

  yield {
    type: "scan_started",
    scanId: scan.id,
    propertyId: property.id,
    sources: ALL_SOURCES,
  };

  // Pre-scan cleanup: drop existing PropertyMention rows that fail the
  // current filters. Listing sites (realtor, rent.com, rentcollegepads),
  // property-owned social pages (instagram/{slug}, facebook/{slug}), and
  // listing-shaped URLs (/rentals/details/, /a/Name-12345/, /biz_redir,
  // .pdf) may have been persisted by earlier scans before the filters
  // existed or tightened. Without this pass they linger forever.
  await deleteBadExistingMentions(property);

  // Emit initial "running" status for every source so the UI shows all chips
  // immediately.
  for (const src of ALL_SOURCES) {
    yield { type: "source_progress", source: src, status: "running" };
  }

  // Fire all source fetches in parallel. We await them as they settle so
  // the stream can emit source-by-source results.
  const sourcePromises: Record<
    SourceKey,
    Promise<ScanSourceResult & { resolvedPlaceId?: string | null; aggregateRating?: number | null; aggregateCount?: number | null }>
  > = {
    google: searchGooglePlaces(property),
    tavily: searchTavily(property),
  };

  // Track results so we can dedupe + analyze after all return.
  const sourceResults: Partial<
    Record<SourceKey, ScanSourceResult & { resolvedPlaceId?: string | null; aggregateRating?: number | null; aggregateCount?: number | null }>
  > = {};

  // Convert the record into [key, promise] pairs and race them so we stream
  // results in fastest-first order.
  const pending = new Map<
    SourceKey,
    Promise<ScanSourceResult & { resolvedPlaceId?: string | null; aggregateRating?: number | null; aggregateCount?: number | null }>
  >(
    (Object.entries(sourcePromises) as Array<
      [SourceKey, Promise<ScanSourceResult & { resolvedPlaceId?: string | null; aggregateRating?: number | null; aggregateCount?: number | null }>]
    >).map(([k, p]) => [k, p])
  );

  while (pending.size > 0) {
    const raced = await Promise.race(
      Array.from(pending.entries()).map(([key, p]) =>
        p.then((r) => ({ key, r }))
      )
    );
    pending.delete(raced.key);
    sourceResults[raced.key] = raced.r;
    // We still need to report `newCount` per source. Compute it now by
    // hashing and checking against existing rows for this property.
    const { newCount } = await countNewMentions(
      property.orgId,
      property.id,
      raced.r.mentions
    );
    if (raced.r.ok) {
      yield {
        type: "source_complete",
        source: raced.key,
        found: raced.r.found,
        newCount,
      };
    } else {
      yield {
        type: "source_failed",
        source: raced.key,
        error: raced.r.error ?? "Unknown error",
      };
    }
  }

  // Persist Google meta onto the Property row: resolved Place ID (if we had
  // to look it up), and the aggregate rating + review count. The aggregate
  // drives the KPI tile — we want "4.0 ★ across 49 reviews", not the 5.0
  // from averaging the 5 "most helpful" individual reviews.
  const resolvedPlaceId = sourceResults.google?.resolvedPlaceId;
  const aggregateRating = sourceResults.google?.aggregateRating;
  const aggregateCount = sourceResults.google?.aggregateCount;
  const propertyUpdate: Prisma.PropertyUpdateInput = {};
  if (resolvedPlaceId && !property.googlePlaceId) {
    propertyUpdate.googlePlaceId = resolvedPlaceId;
  }
  if (typeof aggregateRating === "number") {
    propertyUpdate.googleAggRating = aggregateRating;
    propertyUpdate.googleAggUpdatedAt = new Date();
  }
  if (typeof aggregateCount === "number") {
    propertyUpdate.googleAggReviewCount = aggregateCount;
  }
  if (Object.keys(propertyUpdate).length > 0) {
    try {
      await prisma.property.update({
        where: { id: property.id },
        data: propertyUpdate,
      });
    } catch {
      // Non-fatal.
    }
  }

  // Collect all mentions across sources, dedupe by urlHash, separate into
  // "new" (to be inserted) vs "existing" (to have lastSeenAt bumped).
  const allMentions: ScannedMention[] = [];
  for (const src of ALL_SOURCES) {
    const r = sourceResults[src];
    if (r?.ok) allMentions.push(...r.mentions);
  }

  const deduped = dedupeByUrlHash(allMentions);
  const existing = await fetchExistingHashes(
    property.orgId,
    property.id,
    deduped.map((m) => m.hash)
  );

  const newMentions = deduped.filter((m) => !existing.has(m.hash));
  const existingToBump = deduped.filter((m) => existing.has(m.hash));

  // Bump lastSeenAt on existing matches in a single batch.
  if (existingToBump.length > 0) {
    await prisma.propertyMention.updateMany({
      where: {
        orgId: property.orgId,
        propertyId: property.id,
        urlHash: { in: existingToBump.map((m) => m.hash) },
      },
      data: { lastSeenAt: new Date() },
    });
  }

  // Classification pool: all new mentions + any existing mentions that are
  // still unclassified (sentiment == null). The latter catches mentions
  // inserted by earlier scans when the analyzer was silently failing on a
  // too-strict schema. One extra Haiku call fully backfills a property.
  const unclassifiedExisting = await prisma.propertyMention.findMany({
    where: {
      orgId: property.orgId,
      propertyId: property.id,
      sentiment: null,
    },
    select: {
      id: true,
      urlHash: true,
      source: true,
      sourceUrl: true,
      title: true,
      excerpt: true,
      rating: true,
    },
    take: MAX_MENTIONS_TO_ANALYZE,
  });

  const poolNew: Array<{ hash: string; mention: ScannedMention }> =
    newMentions.map(({ hash, mention }) => ({ hash, mention }));
  const poolExisting: Array<{
    id: string;
    hash: string;
    mention: ScannedMention;
  }> = unclassifiedExisting.map((r) => ({
    id: r.id,
    hash: r.urlHash,
    mention: {
      source: r.source,
      sourceUrl: r.sourceUrl,
      title: r.title,
      excerpt: r.excerpt,
      authorName: null,
      publishedAt: null,
      rating: r.rating,
    },
  }));

  // Sort together, newest-first, cap at MAX_MENTIONS_TO_ANALYZE.
  const combined = [
    ...poolNew.map((p) => ({ kind: "new" as const, ...p })),
    ...poolExisting.map((p) => ({ kind: "existing" as const, ...p })),
  ]
    .sort((a, b) => {
      const ta = a.mention.publishedAt?.getTime() ?? 0;
      const tb = b.mention.publishedAt?.getTime() ?? 0;
      if (tb !== ta) return tb - ta;
      return (b.mention.excerpt?.length ?? 0) - (a.mention.excerpt?.length ?? 0);
    })
    .slice(0, MAX_MENTIONS_TO_ANALYZE);

  yield { type: "analysis_started", toAnalyze: combined.length };

  // Claude classification.
  const classifications = await analyzeSentimentAndTopics(
    combined.map((m) => ({ id: m.hash, mention: m.mention }))
  );

  // Write back classifications to existing rows.
  const existingToUpdate = combined.filter(
    (c) => c.kind === "existing"
  ) as Array<{ kind: "existing"; id: string; hash: string }>;
  for (const row of existingToUpdate) {
    const analysis = classifications.get(row.hash);
    if (!analysis) continue;
    try {
      await prisma.propertyMention.update({
        where: { id: row.id },
        data: {
          sentiment: analysis.sentiment,
          topics: analysis.topics as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Non-fatal.
    }
  }

  // Persist all new mentions (even ones we didn't analyze) so we don't
  // discover them again next scan — unanalyzed rows have sentiment = null
  // and will show as "Not yet classified" in the UI.
  const insertOps: ReturnType<typeof createMention>[] = [];
  const streamedMentions: Array<{
    hash: string;
    mention: ScannedMention;
    sentiment: Sentiment | null;
    topics: string[];
  }> = [];

  for (const { hash, mention } of newMentions) {
    const analysis = classifications.get(hash);
    const sentiment = analysis?.sentiment ?? null;
    const topics = analysis?.topics ?? [];
    streamedMentions.push({ hash, mention, sentiment, topics });
    insertOps.push(
      createMention({
        orgId: property.orgId,
        propertyId: property.id,
        scanId: scan.id,
        hash,
        mention,
        sentiment,
        topics,
      })
    );
  }

  // Run all inserts. Use Promise.allSettled so one bad row doesn't kill
  // the rest (e.g. an oversized excerpt hitting a DB limit).
  const inserted = await Promise.allSettled(insertOps);

  // Stream one `mention` SSE event per successfully persisted row, sorted
  // newest-first — this drives the client-side feed as the scan wraps up.
  const successByHash = new Map<string, string>(); // hash → id
  for (let i = 0; i < inserted.length; i++) {
    const res = inserted[i];
    if (res.status === "fulfilled" && res.value?.id) {
      successByHash.set(streamedMentions[i].hash, res.value.id);
    }
  }

  const sortedForStream = [...streamedMentions].sort((a, b) => {
    const ta = a.mention.publishedAt?.getTime() ?? 0;
    const tb = b.mention.publishedAt?.getTime() ?? 0;
    return tb - ta;
  });

  for (const row of sortedForStream) {
    const id = successByHash.get(row.hash);
    if (!id) continue;
    yield {
      type: "mention",
      id,
      source: row.mention.source,
      title: row.mention.title ?? null,
      excerpt: row.mention.excerpt,
      sentiment: row.sentiment,
      topics: row.topics,
      url: row.mention.sourceUrl,
      authorName: row.mention.authorName ?? null,
      publishedAt: row.mention.publishedAt
        ? row.mention.publishedAt.toISOString()
        : null,
      rating: row.mention.rating ?? null,
    };
  }

  // Compute summary + final status.
  const total = deduped.length;
  const newCount = newMentions.length;
  const okSources = ALL_SOURCES.filter((s) => sourceResults[s]?.ok).length;
  const failedSources = ALL_SOURCES.length - okSources;

  const status: ReputationScanStatus =
    okSources === 0
      ? ReputationScanStatus.FAILED
      : failedSources === 0
        ? ReputationScanStatus.SUCCEEDED
        : ReputationScanStatus.PARTIAL;

  const estCostCents = estimateCostCents(sourceResults);
  const durationMs = Date.now() - start;

  await prisma.reputationScan.update({
    where: { id: scan.id },
    data: {
      status,
      newMentionCount: newCount,
      totalMentionCount: total,
      estCostCents,
      durationMs,
      completedAt: new Date(),
      sources: {
        google: summarizeSource(sourceResults.google),
        tavily: summarizeSource(sourceResults.tavily),
      } as Prisma.InputJsonValue,
    },
  });

  yield {
    type: "done",
    scanId: scan.id,
    totalMentions: total,
    newMentions: newCount,
    durationMs,
    estCostCents,
    status:
      status === ReputationScanStatus.SUCCEEDED
        ? "SUCCEEDED"
        : status === ReputationScanStatus.PARTIAL
          ? "PARTIAL"
          : "FAILED",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Pre-scan cleanup: walk the property's existing PropertyMention rows and
// delete any whose URL now falls on the listing blocklist, matches an
// owned-social pattern, or is a known listing-URL shape. Also deletes
// Yelp/Niche/ApartmentRatings rows whose URL slug doesn't match the
// property name (wrong-business mentions). Keeps the feed honest over
// time as we tighten filters without requiring a manual DB wipe.
async function deleteBadExistingMentions(
  property: PropertySeed
): Promise<void> {
  const rows = await prisma.propertyMention.findMany({
    where: { orgId: property.orgId, propertyId: property.id },
    select: { id: true, sourceUrl: true },
  });
  if (rows.length === 0) return;

  const ownedDomains = deriveOwnedDomains(property);
  const ownedSocialPaths = deriveOwnedSocialPaths(property);

  const toDelete: string[] = [];
  for (const r of rows) {
    if (shouldDelete(r.sourceUrl, property.name, ownedDomains, ownedSocialPaths)) {
      toDelete.push(r.id);
    }
  }
  if (toDelete.length === 0) return;

  await prisma.propertyMention.deleteMany({
    where: { id: { in: toDelete } },
  });
}

function shouldDelete(
  url: string,
  propertyName: string,
  ownedDomains: string[],
  ownedSocialPaths: string[]
): boolean {
  try {
    const host = new URL(url).host.toLowerCase().replace(/^www\./, "");
    // Host is on the listing blocklist.
    if (
      LISTING_BLOCKLIST.some((d) => host === d || host.endsWith(`.${d}`))
    ) {
      return true;
    }
    if (isOwnedHost(url, ownedDomains)) return true;
    if (isOwnedSocialPage(url, ownedSocialPaths)) return true;
    if (isListingUrl(url)) return true;
    if (isWrongBusinessPage(url, propertyName)) return true;
  } catch {
    return true; // malformed URL, junk data
  }
  return false;
}

function dedupeByUrlHash(
  mentions: ScannedMention[]
): Array<{ hash: string; mention: ScannedMention }> {
  const seen = new Map<string, ScannedMention>();
  for (const m of mentions) {
    if (!m.sourceUrl) continue;
    const hash = hashUrl(m.sourceUrl);
    // If we see the same URL from two sources, prefer the entry with the
    // richer payload (author + rating + longer excerpt).
    const existing = seen.get(hash);
    if (!existing) {
      seen.set(hash, m);
    } else {
      seen.set(hash, pickRicher(existing, m));
    }
  }
  return Array.from(seen.entries()).map(([hash, mention]) => ({
    hash,
    mention,
  }));
}

function pickRicher(a: ScannedMention, b: ScannedMention): ScannedMention {
  const score = (m: ScannedMention) =>
    (m.authorName ? 2 : 0) +
    (typeof m.rating === "number" ? 2 : 0) +
    (m.publishedAt ? 1 : 0) +
    Math.min(1, (m.excerpt?.length ?? 0) / 500);
  return score(b) > score(a) ? b : a;
}

async function countNewMentions(
  orgId: string,
  propertyId: string,
  mentions: ScannedMention[]
): Promise<{ newCount: number }> {
  if (mentions.length === 0) return { newCount: 0 };
  const hashes = Array.from(
    new Set(
      mentions
        .filter((m) => !!m.sourceUrl)
        .map((m) => hashUrl(m.sourceUrl))
    )
  );
  if (hashes.length === 0) return { newCount: 0 };
  const existing = await prisma.propertyMention.findMany({
    where: {
      orgId,
      propertyId,
      urlHash: { in: hashes },
    },
    select: { urlHash: true },
  });
  return { newCount: hashes.length - existing.length };
}

async function fetchExistingHashes(
  orgId: string,
  propertyId: string,
  hashes: string[]
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const rows = await prisma.propertyMention.findMany({
    where: {
      orgId,
      propertyId,
      urlHash: { in: hashes },
    },
    select: { urlHash: true },
  });
  return new Set(rows.map((r) => r.urlHash));
}

async function createMention(args: {
  orgId: string;
  propertyId: string;
  scanId: string;
  hash: string;
  mention: ScannedMention;
  sentiment: Sentiment | null;
  topics: string[];
}): Promise<{ id: string } | null> {
  const { orgId, propertyId, scanId, hash, mention, sentiment, topics } = args;
  try {
    const row = await prisma.propertyMention.create({
      data: {
        orgId,
        propertyId,
        source: mention.source as MentionSource,
        sourceUrl: mention.sourceUrl,
        urlHash: hash,
        title: mention.title ?? null,
        excerpt: mention.excerpt ?? "",
        authorName: mention.authorName ?? null,
        publishedAt: mention.publishedAt ?? null,
        rating: mention.rating ?? null,
        sentiment,
        topics: topics as Prisma.InputJsonValue,
        firstSeenScanId: scanId,
      },
      select: { id: true },
    });
    return row;
  } catch {
    return null;
  }
}

type SourceSummary = {
  ok: boolean;
  found: number;
  error: string | null;
};

function summarizeSource(
  r: (ScanSourceResult & { resolvedPlaceId?: string | null; aggregateRating?: number | null; aggregateCount?: number | null }) | undefined
): SourceSummary {
  if (!r) return { ok: false, found: 0, error: "not run" };
  return {
    ok: r.ok,
    found: r.found,
    error: r.error ?? null,
  };
}

function estimateCostCents(
  results: Partial<
    Record<SourceKey, ScanSourceResult & { resolvedPlaceId?: string | null; aggregateRating?: number | null; aggregateCount?: number | null }>
  >
): number {
  let cents = 0;
  // Tavily: fixed number of parallel queries per scan (see tavily.ts).
  if (results.tavily?.ok)
    cents += TAVILY_COST_CENTS_PER_QUERY * TAVILY_QUERIES_PER_SCAN;
  // Google Places: one call (plus the searchText call when resolved fresh).
  if (results.google?.ok) {
    cents += GOOGLE_PLACES_COST_CENTS_PER_CALL;
    if (results.google.resolvedPlaceId) {
      cents += GOOGLE_PLACES_COST_CENTS_PER_CALL;
    }
  }
  // Claude analysis cost (flat rate — Haiku is cheap enough that we
  // account by scan, not by token).
  cents += ANALYSIS_COST_CENTS_PER_SCAN;
  return cents;
}
