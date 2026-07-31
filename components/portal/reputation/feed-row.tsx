import Link from "next/link";
import { Star, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Sentiment } from "@prisma/client";
import { SourceLogo } from "@/components/portal/reputation/source-logo";
import { sourceLabel } from "@/components/portal/reputation/source-label";
import type { PortfolioReputationFeedItem } from "@/lib/reputation/portfolio";
import { safeNum } from "@/components/portal/reputation/reputation-utils";

const SENTIMENT_TONE: Record<Sentiment, string> = {
  POSITIVE: "bg-[rgba(36,161,72,0.10)] text-[#24a148] border-[#24a148]/30",
  NEUTRAL: "bg-muted text-muted-foreground border-border",
  NEGATIVE: "bg-muted text-muted-foreground border-border",
  MIXED: "bg-secondary text-foreground border-border",
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
  MIXED: "Mixed",
};

// Scraped post titles arrive with attention-grab emoji prefixes ("\u203c\ufe0f
// Lease takeover..."). The feed is a professional digest, so decorative
// pictographs at the head of a title are stripped for display only — the
// original text is untouched at the source link.
function stripLeadingPictographs(title: string): string {
  const stripped = title.replace(
    /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+/u,
    "",
  );
  // If the title was ONLY emoji, keep the original rather than render blank.
  return stripped.trim().length > 0 ? stripped : title;
}

export function FeedRow({ mention }: { mention: PortfolioReputationFeedItem }) {
  // Defensive normalization. Audit found this row was the most likely
  // crash site — a single malformed mention should NOT take down the
  // whole page. Coerce every field to a safe type before rendering.
  const safeUrl =
    typeof mention.sourceUrl === "string" ? mention.sourceUrl : "";
  const propertyName = mention.propertyName ?? "Property";
  const propertyId = mention.propertyId ?? "";
  const sentiment = mention.sentiment;
  const sentimentTone = sentiment ? SENTIMENT_TONE[sentiment] : "";
  const sentimentLabel = sentiment ? SENTIMENT_LABEL[sentiment] : "";
  const ratingNum = mention.rating != null ? safeNum(mention.rating) : null;
  // Prefer the real publish date; for scraped sources that don't expose one
  // (Reddit/Tavily/FB), show when we discovered it so the row is never
  // mystery-dated and "newest first" stays honest.
  const publishedWhen =
    mention.publishedAt instanceof Date ? mention.publishedAt : null;
  const discoveredWhen =
    mention.discoveredAt instanceof Date ? mention.discoveredAt : null;
  const when = publishedWhen ?? discoveredWhen;
  const whenIsDiscovery = !publishedWhen && !!discoveredWhen;
  // Fade low-confidence sentiment pills. Threshold = 0.6 — below that
  // we still show the label so the operator can review, but render at
  // 60% opacity to communicate "this is a guess".
  const lowConfidence =
    mention.sentimentConfidence != null && mention.sentimentConfidence < 0.6;
  const themes = Array.isArray(mention.themes)
    ? mention.themes.slice(0, 3)
    : [];

  return (
    <li className="py-2.5 px-3 -mx-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2.5">
        {/* Full-color brand marks — instant source recognition (Adam
            2026-07-31: logos must render in color, not grayscale). */}
        <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-[2px] bg-card border border-border shadow-sm">
          <SourceLogo
            source={mention.source}
            url={safeUrl}
            className="h-[18px] w-[18px]"
          />
        </div>
        <div className="min-w-0 flex-1">
          {/* Source header — the brand logo (tile, left) is paired with the
              source name + time here so the operator instantly sees WHERE a
              mention lives before reading it. */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground">
              {sourceLabel(mention.source, safeUrl)}
            </span>
            {when ? (
              <span className="text-[11px] text-muted-foreground">
                · {whenIsDiscovery ? "found " : ""}
                {formatDistanceToNow(when, { addSuffix: true })}
              </span>
            ) : null}
          </div>
          {mention.title ? (
            <p
              className="text-sm font-medium text-foreground mb-0.5 truncate"
              dir="auto"
            >
              {stripLeadingPictographs(String(mention.title))}
            </p>
          ) : null}
          {/* Full mention body. whitespace-pre-line preserves Reddit-style
              paragraph breaks. line-clamp-2 keeps the row dense; the
              full text is one click away via View source. */}
          <p
            className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-2"
            dir="auto"
          >
            {String(mention.excerpt ?? "")}
          </p>
          {themes.length > 0 ? (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {themes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-[2px] bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {/* Bottom meta-line: source, property, time, rating, sentiment,
              flagged, View source link — all one line in text-[11px]. */}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
            {propertyId ? (
              <Link
                href={`/portal/properties/${propertyId}?tab=reputation`}
                className="font-medium text-foreground hover:text-primary truncate max-w-[160px]"
              >
                {propertyName}
              </Link>
            ) : (
              <span className="font-medium text-foreground truncate max-w-[160px]">
                {propertyName}
              </span>
            )}
            {mention.authorName ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-[120px]">
                  {String(mention.authorName)}
                </span>
              </>
            ) : null}
            {ratingNum != null && ratingNum > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-0.5 text-foreground tabular-nums">
                  <Star className="h-3 w-3 fill-current text-primary" />
                  {ratingNum.toFixed(1)}
                </span>
              </>
            ) : null}
            {sentiment && sentimentTone ? (
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${sentimentTone} ${lowConfidence ? "opacity-60" : ""}`}
                title={
                  mention.sentimentConfidence != null
                    ? `Confidence ${Math.round(mention.sentimentConfidence * 100)}%`
                    : undefined
                }
              >
                {sentimentLabel}
              </span>
            ) : null}
            {mention.flagged ? (
              <span
                className="inline-flex items-center gap-0.5 text-foreground"
                title="Flagged"
              >
                <Flag className="h-3 w-3" />
              </span>
            ) : null}
            {safeUrl ? (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-muted-foreground hover:text-foreground underline-offset-2 hover:underline whitespace-nowrap"
              >
                View source →
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
