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

// Active sources for the unified reputation inbox.
//
// History note: Phase 1 cut Reddit + Yelp in favor of Tavily's unified web
// coverage. Phase 2 (the unified reputation dashboard) reintroduces them as
// dedicated connectors:
//   * Reddit's public JSON endpoint surfaces fresh posts/comments that
//     Tavily's index hasn't picked up yet (lag of hours-to-days).
//   * Yelp's biz page is now scraped directly when a property has a
//     `yelpBusinessId` configured — Fusion's review endpoint has been
//     gutted, so the public page is the pragmatic source of truth.
// MentionSource on a persisted row keys off the actual origin, so
// REDDIT rows coming from Tavily and REDDIT rows coming from the direct
// connector look identical to the UI.
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
      // Bug #23 — surface silent classifier failures so the operator
      // sees "ANTHROPIC_API_KEY not configured" or the Claude error
      // string instead of just watching every mention land as
      // unclassified. The UI shows this as an inline notice next to
      // the scan progress.
      type: "analysis_skipped";
      reason: "no_api_key" | "error";
      message: string;
    }
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
  propertyType: "RESIDENTIAL" | "COMMERCIAL" | "MIXED" | null;
  residentialSubtype:
    | "STUDENT_HOUSING"
    | "MULTIFAMILY"
    | "SENIOR_LIVING"
    | "SINGLE_FAMILY_RENTAL"
    | "CO_LIVING"
    | "SHORT_TERM_RENTAL"
    | null;
  googlePlaceId: string | null;
  googleReviewUrl: string | null;
  yelpBusinessId: string | null;
  redditSubreddits: string[] | null;
};
