import Link from "next/link";
import { MessageSquare, Star, Globe2, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MentionSource, Sentiment } from "@prisma/client";

// ----------------------------------------------------------------------------
// MentionFeed — last 8 PropertyMention rows surfaced from the last 7 days.
// Pure presentational: parent passes pre-fetched rows so the feed stays a
// server component with zero round-trips of its own.
// ----------------------------------------------------------------------------

export type MentionRow = {
  id: string;
  source: MentionSource;
  sourceUrl: string;
  title: string | null;
  excerpt: string;
  rating: number | null;
  sentiment: Sentiment | null;
  publishedAt: Date | null;
  property?: { id: string; name: string } | null;
};

export function MentionFeed({ mentions }: { mentions: MentionRow[] }) {
  if (mentions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
        <MessageSquare className="h-5 w-5 mx-auto text-muted-foreground" />
        <div className="mt-2 text-sm font-medium text-foreground">
          No fresh mentions yet
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Reviews, Reddit posts, and web mentions land here as soon as they
          surface.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Live feed
          </div>
          <div className="text-sm font-medium text-foreground">
            Recent mentions
          </div>
        </div>
        <Link
          href="/portal/reputation"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {mentions.map((m) => (
          <li key={m.id}>
            <Link
              href="/portal/reputation"
              className="flex items-start gap-3 px-5 py-3 hover:bg-secondary transition-colors"
            >
              <SourceIcon source={m.source} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {SOURCE_LABELS[m.source]}
                  </span>
                  {m.property ? (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[10rem]">
                      {m.property.name}
                    </span>
                  ) : null}
                  {m.rating != null ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-foreground tabular-nums">
                      <Star className="h-3 w-3 fill-current" />
                      {m.rating.toFixed(1)}
                    </span>
                  ) : null}
                  <SentimentDot sentiment={m.sentiment} />
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {timeAgo(m.publishedAt)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-foreground leading-snug line-clamp-2">
                  {m.title ? (
                    <span className="font-medium">{m.title} — </span>
                  ) : null}
                  {truncate(m.excerpt, 180)}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SOURCE_LABELS: Record<MentionSource, string> = {
  GOOGLE_REVIEW: "Google",
  REDDIT: "Reddit",
  YELP: "Yelp",
  TAVILY_WEB: "Web",
  FACEBOOK_PUBLIC: "Facebook",
  OTHER: "Other",
};

function SourceIcon({ source }: { source: MentionSource }) {
  const cls = "h-4 w-4 text-muted-foreground shrink-0";
  if (source === "GOOGLE_REVIEW" || source === "YELP") {
    return <Star className={cls} aria-hidden />;
  }
  if (source === "REDDIT" || source === "FACEBOOK_PUBLIC") {
    return <MessageSquare className={cls} aria-hidden />;
  }
  if (source === "TAVILY_WEB") {
    return <Globe2 className={cls} aria-hidden />;
  }
  return <Newspaper className={cls} aria-hidden />;
}

function SentimentDot({ sentiment }: { sentiment: Sentiment | null }) {
  const color =
    sentiment === "POSITIVE"
      ? "bg-emerald-500"
      : sentiment === "NEGATIVE"
        ? "bg-rose-500"
        : sentiment === "MIXED"
          ? "bg-amber-500"
          : "bg-neutral-300";
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full", color)}
      aria-label={sentiment ?? "neutral"}
    />
  );
}

function timeAgo(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trim() + "…";
}
