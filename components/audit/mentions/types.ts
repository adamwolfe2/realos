// Public types + canonical source ordering for the reputation mentions
// surfaces. Split out from `components/audit/mentions-section.tsx` 2026-05-29
// so the (formerly 494-line) wrapper stays focused on layout.

export type AuditMentionSource =
  | "REDDIT"
  | "YELP"
  | "BBB"
  | "APARTMENT_RATINGS"
  | "FACEBOOK"
  | "GOOGLE_REVIEW"
  | "TAVILY_WEB";

export interface AuditMention {
  source: AuditMentionSource;
  title: string | null;
  snippet: string;
  url: string;
  publishedAt: string | null;
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED" | null;
  themes?: string[];
}

// Canonical order — used to render the filter chip row in a stable
// sequence across reports (so the same chip never moves between scans).
export const ALL_SOURCES: AuditMentionSource[] = [
  "REDDIT",
  "YELP",
  "FACEBOOK",
  "BBB",
  "GOOGLE_REVIEW",
  "APARTMENT_RATINGS",
  "TAVILY_WEB",
];

export const INITIAL_MENTION_LIMIT = 25;
