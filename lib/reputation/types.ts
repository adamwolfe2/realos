import type { MentionSource, Sentiment } from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared types for the Reputation Scanner.
//
// ScannedMention is the normalized shape returned by every source client
// before persistence. Fields map 1:1 onto the PropertyMention Prisma model,
// minus server-generated ids + the dedupe hash (filled in downstream by
// `dedupe.ts`) and minus the Claude-analyzed fields (filled in by
// `analyze.ts`).
// ---------------------------------------------------------------------------

export type ScannedMention = {
  source: MentionSource;
  sourceUrl: string;
  title?: string | null;
  excerpt: string;
  authorName?: string | null;
  publishedAt?: Date | null;
  rating?: number | null;
  // Populated by analyze.ts, not by source clients.
  sentiment?: Sentiment | null;
  topics?: string[] | null;
};

export type SourceKey = "google" | "tavily" | "reddit" | "yelp";

export type ScanSourceResult = {
  source: SourceKey;
  ok: boolean;
  found: number;
  mentions: ScannedMention[];
  error?: string;
};

// SSE event payloads. Each corresponds to one `event: <name>` block on the
// wire; the UI maps on `event.type`.
export type ScanProgressEvent =
  | {
      type: "scan_started";
      scanId: string;
      propertyId: string;
      sources: SourceKey[];
    }
  | { type: "source_progress"; source: SourceKey; status: "running" }
  | {
      type: "source_complete";
      source: SourceKey;
      found: number;
      newCount: number;
    }
  | { type: "source_failed"; source: SourceKey; error: string }
  | { type: "analysis_started"; toAnalyze: number }
  | {
      type: "mention";
      id: string;
      source: MentionSource;
      title: string | null;
      excerpt: string;
      sentiment: Sentiment | null;
      topics: string[];
      url: string;
      authorName: string | null;
      publishedAt: string | null;
      rating: number | null;
    }
  | {
      type: "done";
      scanId: string;
      totalMentions: number;
      newMentions: number;
      durationMs: number;
      estCostCents: number;
      status: "SUCCEEDED" | "PARTIAL" | "FAILED";
    }
  | { type: "error"; message: string };

export type PropertySeed = {
  id: string;
  orgId: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  googlePlaceId: string | null;
  googleReviewUrl: string | null;
  yelpBusinessId: string | null;
  redditSubreddits: string[] | null;
};
