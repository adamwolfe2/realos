// Pure formatters for the mentions section — kept side-effect-free so
// they can be unit-tested or imported from server components without
// dragging React into the bundle.

import type { AuditMention, AuditMentionSource } from "./types";

export function sourceInitial(s: AuditMentionSource): string {
  switch (s) {
    case "REDDIT":
      return "R";
    case "YELP":
      return "Y";
    case "BBB":
      return "B";
    case "APARTMENT_RATINGS":
      return "AR";
    case "FACEBOOK":
      return "F";
    case "GOOGLE_REVIEW":
      return "G";
    case "TAVILY_WEB":
    default:
      return "W";
  }
}

export function sourceColor(s: AuditMentionSource): string {
  switch (s) {
    case "REDDIT":
      return "#FF4500";
    case "YELP":
      return "#D32323";
    case "BBB":
      return "#0F4C81";
    case "APARTMENT_RATINGS":
      return "#0E9F6E";
    case "FACEBOOK":
      return "#1877F2";
    case "GOOGLE_REVIEW":
      return "#4285F4";
    case "TAVILY_WEB":
    default:
      return "#6B7280";
  }
}

export function sourceLabel(s: AuditMentionSource): string {
  switch (s) {
    case "REDDIT":
      return "Reddit";
    case "YELP":
      return "Yelp";
    case "BBB":
      return "BBB";
    case "APARTMENT_RATINGS":
      return "ApartmentRatings";
    case "FACEBOOK":
      return "Facebook";
    case "GOOGLE_REVIEW":
      return "Google";
    case "TAVILY_WEB":
    default:
      return "Web";
  }
}

export function sentimentMeta(s: NonNullable<AuditMention["sentiment"]>): {
  color: string;
  label: string;
} {
  switch (s) {
    case "POSITIVE":
      return { color: "#0E9F6E", label: "Positive" };
    case "NEGATIVE":
      return { color: "#B91C1C", label: "Negative" };
    case "MIXED":
      return { color: "#B45309", label: "Mixed" };
    case "NEUTRAL":
    default:
      return { color: "#9CA3AF", label: "" };
  }
}

// "3 days ago" / "2 weeks ago" — keeps the mention card visually scannable
// at a glance. Defensive against malformed timestamps from upstream sources.
export function relativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "recently";
  const deltaMs = Date.now() - t;
  const days = Math.floor(deltaMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
