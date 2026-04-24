"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ExternalLink,
  Star,
  Flag,
  Check,
  CircleCheck,
} from "lucide-react";
import type { MentionSource, Sentiment } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const SOURCE_META: Record<
  MentionSource,
  { label: string; host: string }
> = {
  GOOGLE_REVIEW: { label: "Google", host: "google.com" },
  REDDIT: { label: "Reddit", host: "reddit.com" },
  YELP: { label: "Yelp", host: "yelp.com" },
  TAVILY_WEB: { label: "Web", host: "" },
  FACEBOOK_PUBLIC: { label: "Facebook", host: "facebook.com" },
  OTHER: { label: "Other", host: "" },
};

function sentimentBadge(s: Sentiment | null) {
  if (!s) {
    return <Badge variant="outline">unclassified</Badge>;
  }
  if (s === "POSITIVE") {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
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

  const meta = SOURCE_META[mention.source];
  const host = getHost(mention.sourceUrl) || meta.host;
  const when = mention.publishedAt
    ? formatDistanceToNow(new Date(mention.publishedAt), { addSuffix: true })
    : null;

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
        <span className="font-medium text-foreground">{meta.label}</span>
        {host ? <span>·</span> : null}
        {host ? <span>{host}</span> : null}
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

      <footer className="mt-3 flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" asChild>
          <a
            href={mention.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gap-1.5"
          >
            Open
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
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
