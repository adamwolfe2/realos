"use client";

import { useEffect, useState } from "react";

type DraftRow = {
  id: string;
  format: string;
  brief: string;
  targetQuery: string | null;
  status: string;
  estimatedScore: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

type Props = {
  propertyId: string;
};

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  GENERATING: { label: "Generating", tone: "bg-muted text-muted-foreground" },
  PENDING_REVIEW: {
    label: "Pending review",
    tone: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  APPROVED: {
    label: "Approved",
    tone: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    tone: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  REJECTED: {
    label: "Rejected",
    tone: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  SHIPPED: {
    label: "Shipped",
    tone: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  EXPIRED: { label: "Expired", tone: "bg-muted text-muted-foreground" },
};

// ---------------------------------------------------------------------------
// DraftsInbox — shows the operator their content drafts in flight + recent.
// Surfaces review notes from the admin so operators see "Adam asked for X"
// without having to email back and forth.
//
// Polls every 8s when there's a GENERATING / PENDING_REVIEW draft so the
// state flips visibly when admin approves / requests changes.
// ---------------------------------------------------------------------------
export function DraftsInbox({ propertyId }: Props) {
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function fetchDrafts() {
    try {
      const res = await fetch(
        `/api/portal/seo/drafts?propertyId=${encodeURIComponent(propertyId)}`,
      );
      const body = await res.json();
      setDrafts(body.drafts ?? []);
    } catch {
      // Silent — the panel will show "no drafts" or stale data.
    }
  }

  useEffect(() => {
    fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Poll while there's any in-flight work. Stops when the queue is fully
  // settled to avoid hammering the API on a quiet dashboard.
  useEffect(() => {
    if (!drafts) return;
    const inFlight = drafts.some(
      (d) => d.status === "GENERATING" || d.status === "PENDING_REVIEW",
    );
    if (!inFlight) return;
    const t = setInterval(fetchDrafts, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  if (!drafts) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Drafts inbox</h3>
        <div className="mt-3 h-16 rounded-md bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return null; // Hide the panel entirely when the operator has no drafts.
  }

  const visible = showAll ? drafts : drafts.slice(0, 4);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Drafts inbox
          </h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Content you&apos;ve sent for review. Admin approves before anything ships.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground shrink-0">
          {drafts.length}
        </span>
      </div>

      <ul className="space-y-2">
        {visible.map((d) => {
          const meta = STATUS_LABELS[d.status] ?? {
            label: d.status,
            tone: "bg-muted text-muted-foreground",
          };
          const fmt = d.format.replace(/_/g, " ").toLowerCase();
          return (
            <li
              key={d.id}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">
                    {fmt}
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                  {d.estimatedScore != null ? (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      est. {d.estimatedScore}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatAge(d.createdAt)}
                </span>
              </div>
              <p className="text-[12.5px] text-foreground line-clamp-2 leading-snug">
                {d.brief}
              </p>
              {d.reviewNotes ? (
                <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 border border-amber-200 dark:border-amber-900/40">
                  <p className="text-[10px] font-mono uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-0.5">
                    Admin notes
                  </p>
                  <p className="text-[12px] text-foreground whitespace-pre-wrap leading-snug">
                    {d.reviewNotes}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {drafts.length > 4 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-[12px] text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Show less" : `Show ${drafts.length - 4} more`}
        </button>
      ) : null}
    </div>
  );
}

function formatAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
