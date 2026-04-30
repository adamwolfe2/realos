"use client";

import * as React from "react";
import { useTransition } from "react";
import { Star, Loader2, Check, AlertTriangle } from "lucide-react";
import { sendManualReviewRequest } from "@/lib/actions/lead-review-request";
import { formatDistanceToNow } from "date-fns";

// Sidebar action button on /portal/leads/[id] that fires off a Google
// review-request email. Shows last sent time so the operator doesn't
// double-send.

type Props = {
  leadId: string;
  alreadySentAt: string | null;
  hasEmail: boolean;
  hasReviewUrl: boolean;
  unsubscribed: boolean;
};

export function ReviewRequestButton({
  leadId,
  alreadySentAt,
  hasEmail,
  hasReviewUrl,
  unsubscribed,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const blocker = !hasEmail
    ? "No email on file"
    : unsubscribed
      ? "Lead unsubscribed"
      : !hasReviewUrl
        ? "Property missing Google review URL"
        : null;

  function send() {
    setError(null);
    startTransition(async () => {
      const r = await sendManualReviewRequest({ leadId });
      if (r.ok) {
        setDone(true);
      } else {
        setError(r.error);
      }
    });
  }

  if (blocker) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>Review request unavailable: {blocker}.</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={send}
        disabled={pending || done}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : done ? (
          <Check className="h-3 w-3 text-emerald-600" />
        ) : (
          <Star className="h-3 w-3" />
        )}
        {done
          ? "Sent"
          : alreadySentAt
            ? "Re-send review request"
            : "Send review request"}
      </button>
      {alreadySentAt && !done ? (
        <p className="text-[10px] text-muted-foreground">
          Last sent {formatDistanceToNow(new Date(alreadySentAt), { addSuffix: true })}
        </p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
