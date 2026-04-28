import * as React from "react";
import Link from "next/link";
import { Star, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MentionSource, Sentiment } from "@prisma/client";
import type { ReputationPulseItem } from "@/lib/dashboard/queries";

const SOURCE_LABEL: Record<MentionSource, string> = {
  GOOGLE_REVIEW: "Google",
  REDDIT: "Reddit",
  YELP: "Yelp",
  TAVILY_WEB: "Web",
  FACEBOOK_PUBLIC: "Facebook",
  OTHER: "Other",
};

const SENTIMENT_TONE: Record<Sentiment, string> = {
  POSITIVE: "bg-emerald-50 text-emerald-700",
  NEUTRAL: "bg-muted text-muted-foreground",
  NEGATIVE: "bg-rose-50 text-rose-700",
  MIXED: "bg-amber-50 text-amber-700",
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
  MIXED: "Mixed",
};

function truncate(input: string, max = 140): string {
  const s = input.trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function ReputationPulse({ items }: { items: ReputationPulseItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No reviews picked up yet. As soon as Google, Reddit, or Yelp surface a
        mention, it'll stream in here.
      </p>
    );
  }

  return (
    <ul className="-my-1 divide-y divide-border">
      {items.map((m) => {
        const when = m.publishedAt ?? null;
        return (
          <li key={m.id}>
            <Link
              href={`/portal/properties/${m.propertyId}?tab=reputation`}
              className="block rounded-md -mx-1 px-1 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                    {SOURCE_LABEL[m.source]}
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    ·
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">
                    {m.propertyName}
                  </span>
                </div>
                {m.sentiment ? (
                  <span
                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${SENTIMENT_TONE[m.sentiment]}`}
                  >
                    {SENTIMENT_LABEL[m.sentiment]}
                  </span>
                ) : null}
              </div>
              <p className="text-xs leading-snug text-foreground line-clamp-2">
                {truncate(m.title ?? m.excerpt)}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {m.rating != null ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-current text-amber-500" />
                    {m.rating.toFixed(1)}
                  </span>
                ) : (
                  <MessageCircle className="h-2.5 w-2.5" />
                )}
                {m.authorName ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-[100px]">{m.authorName}</span>
                  </>
                ) : null}
                {when ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{formatDistanceToNow(when, { addSuffix: true })}</span>
                  </>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
