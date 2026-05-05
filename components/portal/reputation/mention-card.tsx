"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ExternalLink,
  Star,
  Flag,
  Check,
  CircleCheck,
  Link2,
  MessageSquareReply,
} from "lucide-react";
import type { MentionSource, Sentiment } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SourceLogo, sourceLabel } from "./source-logo";

export type MentionView = {
  id: string;
  source: MentionSource;
  sourceUrl: string;
  title: string | null;
  excerpt: string;
  authorName: string | null;
  publishedAt: string | null;
  rating: number | null;
  sentiment: Sentiment | null;
  topics: string[];
  reviewed: boolean;
  flagged: boolean;
  isNew?: boolean;
};

function sentimentBadge(s: Sentiment | null) {
  if (!s) {
    return <Badge variant="outline">unclassified</Badge>;
  }
  if (s === "POSITIVE") {
    return (
      <Badge className="bg-primary text-primary-foreground hover:bg-primary">
        positive
      </Badge>
    );
  }
  if (s === "NEGATIVE") {
    return (
      <Badge variant="destructive">negative</Badge>
    );
  }
  if (s === "MIXED") {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-500">
        mixed
      </Badge>
    );
  }
  return <Badge variant="secondary">neutral</Badge>;
}

function getHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Show the host + a shortened path so the operator can see WHERE the mention
// lives at a glance (e.g. "reddit.com/r/city/thread_title") without visiting
// it. Truncated to 70 chars to stay in one line on mobile.
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const full = `${u.host.replace(/^www\./, "")}${u.pathname}`;
    return full.length > 70 ? `${full.slice(0, 67)}…` : full;
  } catch {
    return url;
  }
}

function getResponseTarget(source: string): string {
  // CTA language tuned per source — landlords respond differently to a Google
  // review (reply via Business Profile) vs a Reddit thread (post a comment).
  switch (source) {
    case "GOOGLE_REVIEW":
      return "Reply on Google";
    case "REDDIT":
      return "Comment on Reddit";
    case "YELP":
      return "Reply on Yelp";
    case "FACEBOOK_PUBLIC":
      return "View on Facebook";
    default:
      return "View post";
  }
}

export function MentionCard({
  mention,
  onUpdated,
}: {
  mention: MentionView;
  onUpdated?: (next: MentionView) => void;
}) {
  const [reviewed, setReviewed] = React.useState(mention.reviewed);
  const [flagged, setFlagged] = React.useState(mention.flagged);
  const [pending, setPending] = React.useState(false);

  const label = sourceLabel(mention.source, mention.sourceUrl);
  const host = getHost(mention.sourceUrl);
  const urlShort = shortUrl(mention.sourceUrl);
  const responseCta = getResponseTarget(mention.source);
  const when = mention.publishedAt
    ? formatDistanceToNow(new Date(mention.publishedAt), { addSuffix: true })
    : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(mention.sourceUrl);
      toast.success("Link copied — paste into Slack, email, or a doc");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const patch = async (
    body: { reviewed?: boolean; flagged?: boolean },
    optimistic: { reviewed?: boolean; flagged?: boolean }
  ) => {
    setPending(true);
    const prevReviewed = reviewed;
    const prevFlagged = flagged;
    if (optimistic.reviewed !== undefined) setReviewed(optimistic.reviewed);
    if (optimistic.flagged !== undefined) setFlagged(optimistic.flagged);
    try {
      const res = await fetch(
        `/api/tenant/reputation-mentions/${mention.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const next = { ...mention, ...optimistic };
      onUpdated?.({
        ...next,
        reviewed: optimistic.reviewed ?? next.reviewed,
        flagged: optimistic.flagged ?? next.flagged,
      });
    } catch {
      setReviewed(prevReviewed);
      setFlagged(prevFlagged);
      toast.error("Could not update mention. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-4",
        reviewed
          ? "border-border/70 opacity-70"
          : mention.sentiment === "NEGATIVE"
            ? "border-destructive/30"
            : "border-border",
        mention.isNew && "ring-2 ring-primary/20",
      )}
    >
      <header className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <SourceLogo
            source={mention.source}
            url={mention.sourceUrl}
            className="h-4 w-4"
          />
          <span className="font-semibold text-foreground">{label}</span>
        </span>
        {host && host.toLowerCase() !== label.toLowerCase() + ".com" ? (
          <>
            <span>·</span>
            <span>{host}</span>
          </>
        ) : null}
        {typeof mention.rating === "number" ? (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-500">
              <Star className="h-3 w-3 fill-current" aria-hidden="true" />
              <span className="font-medium">{mention.rating.toFixed(1)}</span>
            </span>
          </>
        ) : null}
        {mention.authorName ? (
          <>
            <span>·</span>
            <span>{mention.authorName}</span>
          </>
        ) : null}
        {when ? (
          <>
            <span>·</span>
            <span>{when}</span>
          </>
        ) : null}
        {mention.isNew ? (
          <Badge variant="outline" className="ml-auto text-[10px]">
            new
          </Badge>
        ) : null}
      </header>

      {mention.title ? (
        <h3 className="mt-2 text-sm font-semibold tracking-tight text-foreground line-clamp-2">
          {mention.title}
        </h3>
      ) : null}

      <p className="mt-2 text-sm text-foreground/80 whitespace-pre-line line-clamp-4">
        {mention.excerpt}
      </p>

      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {sentimentBadge(mention.sentiment)}
        {mention.topics.map((t) => (
          <Badge key={t} variant="outline">
            {t}
          </Badge>
        ))}
      </div>

      {/* URL preview — shows the operator exactly where the mention lives
          before they click. Helps answer "is this the real post or a
          scraper aggregator?" at a glance. */}
      <a
        href={mention.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground truncate max-w-full"
        title={mention.sourceUrl}
      >
        <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{urlShort}</span>
      </a>

      <footer className="mt-3 flex items-center gap-2 flex-wrap">
        {/* Primary CTA: source-aware language. Reddit posts get "Comment on
            Reddit" because that's the operator's intended action. */}
        <Button size="sm" asChild>
          <a
            href={mention.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gap-1.5"
          >
            <MessageSquareReply className="h-3.5 w-3.5" aria-hidden="true" />
            {responseCta}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={copyLink}
          className="gap-1.5"
          title="Copy link for Slack / email / handoff"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          Copy link
        </Button>
        <Button
          variant={reviewed ? "secondary" : "outline"}
          size="sm"
          disabled={pending}
          onClick={() =>
            patch({ reviewed: !reviewed }, { reviewed: !reviewed })
          }
          className="gap-1.5"
        >
          {reviewed ? (
            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {reviewed ? "Reviewed" : "Mark reviewed"}
        </Button>
        <Button
          variant={flagged ? "destructive" : "outline"}
          size="sm"
          disabled={pending}
          onClick={() => patch({ flagged: !flagged }, { flagged: !flagged })}
          className="gap-1.5"
        >
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          {flagged ? "Flagged" : "Flag"}
        </Button>
      </footer>
    </article>
  );
}
