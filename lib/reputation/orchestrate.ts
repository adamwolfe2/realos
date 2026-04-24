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

  // Emit initial "running" status for every source so the UI shows all chips
  // immediately.
  for (const src of ALL_SOURCES) {
    yield { type: "source_progress", source: src, status: "running" };
  }

  // Fire all source fetches in parallel. We await them as they settle so
  // the stream can emit source-by-source results.
  const sourcePromises: Record<
    SourceKey,
    Promise<ScanSourceResult & { resolvedPlaceId?: string | null }>
  > = {
    google: searchGooglePlaces(property),
    tavily: searchTavily(property),
  };

  // Track results so we can dedupe + analyze after all return.
  const sourceResults: Partial<
    Record<SourceKey, ScanSourceResult & { resolvedPlaceId?: string | null }>
  > = {};

  // Convert the record into [key, promise] pairs and race them so we stream
  // results in fastest-first order.
  const pending = new Map<
    SourceKey,
    Promise<ScanSourceResult & { resolvedPlaceId?: string | null }>
  >(
    (Object.entries(sourcePromises) as Array<
      [SourceKey, Promise<ScanSourceResult & { resolvedPlaceId?: string | null }>]
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

  // If Google resolved a new Place ID, persist it so future scans skip
  // the text-search fallback.
  const resolvedPlaceId = sourceResults.google?.resolvedPlaceId;
  if (resolvedPlaceId && !property.googlePlaceId) {
    try {
      await prisma.property.update({
        where: { id: property.id },
        data: { googlePlaceId: resolvedPlaceId },
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

  // Trim new mentions to MAX_MENTIONS_TO_ANALYZE before sending to Claude
  // (prefer most recent by publishedAt, then longest excerpt as a weak proxy
  // for "most substantive").
  const toAnalyze = [...newMentions]
    .sort((a, b) => {
      const ta = a.mention.publishedAt?.getTime() ?? 0;
      const tb = b.mention.publishedAt?.getTime() ?? 0;
      if (tb !== ta) return tb - ta;
      return (b.mention.excerpt?.length ?? 0) - (a.mention.excerpt?.length ?? 0);
    })
    .slice(0, MAX_MENTIONS_TO_ANALYZE);

  yield { type: "analysis_started", toAnalyze: toAnalyze.length };

  // Claude classification.
  const classifications = await analyzeSentimentAndTopics(
    toAnalyze.map((m) => ({ id: m.hash, mention: m.mention }))
  );

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
  r: (ScanSourceResult & { resolvedPlaceId?: string | null }) | undefined
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
    Record<SourceKey, ScanSourceResult & { resolvedPlaceId?: string | null }>
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
