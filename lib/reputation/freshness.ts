import "server-only";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Reputation freshness rules.
//
// Norman feedback (issues #83, #84, #87): the reputation feed surfaces
// reviews that are 6+ years old and Reddit threads about "Berkeley
// housing in general" that have been stale for years. Those are
// distractions for an operator scanning what to action — they read like
// the system is broken, not like the source is genuinely quiet.
//
// Policy:
//   - DIRECT_MENTION_MAX_AGE_DAYS = 5 years.
//     Reviews and posts that explicitly name the property (Google
//     reviews, Yelp pages, ApartmentRatings entries, articles whose
//     title or body match the property). These get a long fuse because
//     a 4-year-old 1-star Google review is still public and still
//     hurting the brand.
//
//   - GENERAL_THREAD_MAX_AGE_DAYS = 6 months.
//     Reddit / college-forum / news threads that talk about the wider
//     city or neighborhood and were swept up because they shared a
//     keyword. These age out fast — Berkeley housing chatter from 2022
//     is not actionable in 2026.
//
// Direct vs. general is inferred from MentionSource. All scanned sources
// have a "directness" classification per source — see DIRECT_SOURCES /
// GENERAL_SOURCES below.
//
// Operators can opt back in via the URL ?showStale=1 flag on the
// reputation tab (handled at the page level — this module just exposes
// the where-fragments).
// ---------------------------------------------------------------------------

import type { MentionSource } from "@prisma/client";

export const DIRECT_MENTION_MAX_AGE_DAYS = 365 * 5; // 5 years
export const GENERAL_THREAD_MAX_AGE_DAYS = 30 * 6; // 6 months

const DAY_MS = 24 * 60 * 60 * 1000;

// Sources where every mention is, by definition, about the property
// (the operator's profile / listing on that platform). Long fuse.
const DIRECT_SOURCES: MentionSource[] = [
  "GOOGLE_REVIEW",
  "YELP",
  "FACEBOOK_PUBLIC",
];

// Sources where the row can be either a direct mention or general
// neighborhood chatter that happened to match the property keywords.
// Short fuse — the noise:signal ratio favors aggressive trimming.
const GENERAL_SOURCES: MentionSource[] = [
  "REDDIT",
  "TAVILY_WEB",
  "OTHER",
];

/**
 * Default freshness window: hide stale-by-policy mentions from the
 * default feed. The two thresholds are OR'd inside the Prisma where
 * fragment so a row from any source has SOMETHING to compare against.
 */
export function freshnessWhereFragment(): Prisma.PropertyMentionWhereInput {
  const directCutoff = new Date(
    Date.now() - DIRECT_MENTION_MAX_AGE_DAYS * DAY_MS,
  );
  const generalCutoff = new Date(
    Date.now() - GENERAL_THREAD_MAX_AGE_DAYS * DAY_MS,
  );

  return {
    OR: [
      // Direct sources: keep anything within the 5-year window. We
      // also keep rows that have no publishedAt — those typically come
      // from sources that don't expose dates (some Tavily web hits)
      // and excluding them would lose new signal.
      {
        source: { in: DIRECT_SOURCES },
        OR: [
          { publishedAt: { gte: directCutoff } },
          { publishedAt: null },
        ],
      },
      // General sources: keep only the recent 6-month window. NULL
      // publishedAt rows pass through — most have a recent createdAt
      // and we'd rather show them than drop new signal on the floor.
      {
        source: { in: GENERAL_SOURCES },
        OR: [
          { publishedAt: { gte: generalCutoff } },
          { publishedAt: null },
        ],
      },
    ],
  };
}

/**
 * Convenience helper: returns a label describing the active freshness
 * policy. Surfaced under the "Total mentions" tile + at the top of the
 * feed so operators understand what they're looking at and why the
 * count may not match the all-time number on Google.
 */
export function freshnessLabel(): string {
  return `Direct reviews up to ${Math.round(DIRECT_MENTION_MAX_AGE_DAYS / 365)} years old · forum & news up to ${Math.round(GENERAL_THREAD_MAX_AGE_DAYS / 30)} months old`;
}
