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
  X,
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

// Bug #43 — Norman flagged that only Reddit + Yelp had reply CTAs;
// every other source ("Google", "Facebook", "ApartmentRatings",
// "OCH", "NEWS") showed a generic "View post" with no action path.
// We now classify into three response modes:
//   1. "reply"  — platform has an in-product reply UX (Google
//      Business Profile, Yelp, Facebook). CTA: "Reply on X".
//   2. "comment" — discussion thread where the operator posts as a
//      participant (Reddit, College Confidential, Quora). CTA:
//      "Comment on X".
//   3. "draft"  — no native reply UX (ApartmentRatings, Niche,
//      BBB, news, .edu, generic web). CTA: "Draft response" opens
//      a templated reply the operator can copy + paste into an
//      email, Slack handoff, or response form.
type ResponseMode = "reply" | "comment" | "draft";

type ResponseTarget = {
  mode: ResponseMode;
  cta: string;
  platform: string;
};

function getResponseTarget(
  source: string,
  url: string,
): ResponseTarget {
  // Source enum is limited (GOOGLE_REVIEW, REDDIT, YELP, FACEBOOK_PUBLIC,
  // TAVILY_WEB, OTHER) so we also classify by URL host for TAVILY_WEB and
  // OTHER — they cover ApartmentRatings, Niche, news, .edu, etc.
  let host = "";
  try {
    host = new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    // ignore
  }

  if (source === "GOOGLE_REVIEW" || /google\.com$/.test(host)) {
    return { mode: "reply", cta: "Reply on Google", platform: "Google" };
  }
  if (source === "YELP" || /yelp\.com$/.test(host)) {
    return { mode: "reply", cta: "Reply on Yelp", platform: "Yelp" };
  }
  if (source === "FACEBOOK_PUBLIC" || /facebook\.com$/.test(host)) {
    return { mode: "reply", cta: "Reply on Facebook", platform: "Facebook" };
  }
  if (source === "REDDIT" || /reddit\.com$/.test(host)) {
    return { mode: "comment", cta: "Comment on Reddit", platform: "Reddit" };
  }
  if (/collegeconfidential\.com$/.test(host)) {
    return {
      mode: "comment",
      cta: "Comment on College Confidential",
      platform: "College Confidential",
    };
  }
  if (/quora\.com$/.test(host)) {
    return { mode: "comment", cta: "Answer on Quora", platform: "Quora" };
  }
  // No-API sources — open a "Draft response" modal so the operator
  // still has an action path. They can copy the templated reply into
  // an email to support, a Slack handoff, or a manual review-portal
  // response form.
  if (/apartmentratings\.com$/.test(host)) {
    return {
      mode: "draft",
      cta: "Draft response",
      platform: "ApartmentRatings",
    };
  }
  if (/niche\.com$/.test(host)) {
    return { mode: "draft", cta: "Draft response", platform: "Niche" };
  }
  if (/bbb\.org$/.test(host)) {
    return { mode: "draft", cta: "Draft response", platform: "BBB" };
  }
  if (
    /berkeley\.edu$/.test(host) ||
    /\.edu$/.test(host) ||
    /news\./i.test(host) ||
    /berkeleyside\.com$/.test(host)
  ) {
    return { mode: "draft", cta: "Draft response", platform: "News outlet" };
  }
  // OCH (off-campus housing portal) — used by many universities, no
  // public API for replies.
  if (/och(?:hub|portal)?\./i.test(host) || /housing\./i.test(host)) {
    return { mode: "draft", cta: "Draft response", platform: "OCH portal" };
  }
  return { mode: "draft", cta: "Draft response", platform: "this source" };
}

// Build a deterministic response template the operator can copy +
// adapt. We don't auto-send anywhere — the operator owns the actual
// publish/email path because every off-API source has its own quirks.
function buildResponseDraft(args: {
  authorName: string | null;
  sentiment: Sentiment | null;
  platform: string;
  excerpt: string;
}): string {
  const audience = args.authorName ? args.authorName : "there";
  const opener =
    args.sentiment === "NEGATIVE"
      ? `Hi ${audience} — thanks for taking the time to share your experience, and I'm sorry it wasn't what you were hoping for.`
      : args.sentiment === "POSITIVE"
        ? `Hi ${audience} — thanks so much for the kind words, it means a lot to the whole team.`
        : `Hi ${audience} — thanks for the note about our community.`;
  const middle =
    args.sentiment === "NEGATIVE"
      ? `I'd love to make this right. Could you send me an email with the unit number and the best time to reach you? I'll pull the full history on whatever you ran into and get back to you with a real plan, not a form letter.`
      : `If there's anything we can do to make your stay even better, please reach out directly — we read every note and act on it.`;
  const close = `— Property management team\n(${args.platform})`;
  return `${opener}\n\n${middle}\n\n${close}`;
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
  // Bug #43 — draft-response modal state. Only used for "draft" mode
  // sources (ApartmentRatings, news, etc.) that have no native reply
  // UX. Renders a pre-filled response the operator can adapt + copy.
  const [draftOpen, setDraftOpen] = React.useState(false);
  const [draftText, setDraftText] = React.useState("");

  const label = sourceLabel(mention.source, mention.sourceUrl);
  const host = getHost(mention.sourceUrl);
  const responseTarget = getResponseTarget(mention.source, mention.sourceUrl);
  const when = mention.publishedAt
    ? formatDistanceToNow(new Date(mention.publishedAt), { addSuffix: true })
    : null;

  const openDraft = () => {
    setDraftText(
      buildResponseDraft({
        authorName: mention.authorName,
        sentiment: mention.sentiment,
        platform: responseTarget.platform,
        excerpt: mention.excerpt,
      }),
    );
    setDraftOpen(true);
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      toast.success("Draft copied — paste into the response surface");
    } catch {
      toast.error("Could not copy draft");
    }
  };

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
        "rounded-xl border bg-card p-4",
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

      <footer className="mt-4 flex items-center justify-between gap-2 flex-wrap">
        {/* Primary CTA — the operator's main job on this card is to
            respond. Everything else lives in a quiet secondary row. */}
        {responseTarget.mode === "draft" ? (
          <Button
            size="sm"
            onClick={openDraft}
            className="gap-1.5"
            title={`No public reply API for ${responseTarget.platform}. Open a templated draft you can copy and adapt.`}
          >
            <MessageSquareReply className="h-3.5 w-3.5" aria-hidden="true" />
            {responseTarget.cta}
          </Button>
        ) : (
          <Button size="sm" asChild>
            <a
              href={mention.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1.5"
            >
              <MessageSquareReply className="h-3.5 w-3.5" aria-hidden="true" />
              {responseTarget.cta}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </Button>
        )}

        {/* Secondary actions reduced to icon-only buttons with tooltips.
            Was: three labeled buttons (Copy link / Mark reviewed / Flag).
            Cards now read as a content list, not a worklist. */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Copy link"
            aria-label="Copy link"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              patch({ reviewed: !reviewed }, { reviewed: !reviewed })
            }
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
              reviewed
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={reviewed ? "Reviewed" : "Mark reviewed"}
            aria-label={reviewed ? "Reviewed" : "Mark reviewed"}
          >
            {reviewed ? (
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => patch({ flagged: !flagged }, { flagged: !flagged })}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
              flagged
                ? "text-destructive bg-destructive/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={flagged ? "Flagged" : "Flag"}
            aria-label={flagged ? "Flagged" : "Flag"}
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </footer>

      {/* Bug #43 — response-draft modal for sources without a native
          reply API. Renders a textarea pre-filled with a templated
          reply tuned to the sentiment + author name. The operator
          edits, copies, and pastes into wherever they handle the
          source (email, internal handoff, manual response form). */}
      {draftOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Draft response for ${responseTarget.platform}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDraftOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Draft response
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {responseTarget.platform} has no public reply API —
                  copy this draft into the response surface.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraftOpen(false)}
                className="gap-1 h-7 px-2"
                aria-label="Close draft"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </header>
            <div className="px-4 py-3 space-y-3">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={9}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                spellCheck
              />
              <p className="text-[11px] text-muted-foreground">
                The draft is generated from this mention&apos;s sentiment
                and author. Edit before sending.
              </p>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraftOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={copyDraft} className="gap-1.5">
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                Copy draft
              </Button>
              <Button size="sm" asChild variant="outline" className="gap-1.5">
                <a
                  href={mention.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Open source
                </a>
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </article>
  );
}
