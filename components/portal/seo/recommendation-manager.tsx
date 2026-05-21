"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

type SeoRecommendation = {
  id: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  estimateMinutes: number;
  score: number;
  actionHref: string | null;
  actionLabel: string | null;
  status: "OPEN" | "IN_PROGRESS";
};

type Props = {
  recommendations: SeoRecommendation[];
};

const SEV_TONE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-900/40",
  HIGH: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-900/40",
  MEDIUM: "bg-muted text-muted-foreground border-border",
  LOW: "bg-muted/60 text-muted-foreground border-border",
};

// ---------------------------------------------------------------------------
// RecommendationManager — the full operator workflow for SEO Agent
// recommendations. Each row supports:
//   - Mark in-progress (visual cue + status flip)
//   - Mark completed (terminal)
//   - Dismiss with reason (terminal, requires text)
//
// Calls PATCH /api/portal/seo/recommendations/[id], then router.refresh()
// to repaint the rest of the dashboard. Optimistic state would be
// nicer but the round-trip is <100ms typically — a full refresh is
// fine and avoids drift.
//
// Sibling to PropertyIntelligencePanel which is read-only on the
// property detail page. This one lives on /portal/seo/agent where
// operators actively triage their queue.
// ---------------------------------------------------------------------------
export function RecommendationManager({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Recommendations queue
          </p>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            {recommendations.length} open
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground hidden sm:block">
          Mark in-progress, completed, or dismiss
        </p>
      </header>
      <ul className="divide-y divide-border/60">
        {recommendations.map((r) => (
          <RecommendationRow key={r.id} rec={r} />
        ))}
      </ul>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: SeoRecommendation }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissReason, setDismissReason] = useState("");

  function patchStatus(
    status: "IN_PROGRESS" | "COMPLETED" | "DISMISSED",
    reason?: string,
  ) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/portal/seo/recommendations/${rec.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reason }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body?.error ?? "Update failed.");
          return;
        }
        const label =
          status === "IN_PROGRESS"
            ? "Marked in-progress"
            : status === "COMPLETED"
              ? "Marked completed"
              : "Dismissed";
        toast.success(label);
        setShowDismiss(false);
        setDismissReason("");
        router.refresh();
      } catch {
        toast.error("Network error.");
      }
    });
  }

  const tone = SEV_TONE[rec.severity] ?? SEV_TONE.MEDIUM;
  const isInProgress = rec.status === "IN_PROGRESS";

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide shrink-0 ${tone}`}
        >
          {rec.severity.toLowerCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground leading-snug">
            {rec.title}
            {isInProgress ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase text-primary">
                in progress
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug line-clamp-2">
            {rec.detail}
          </p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            <span className="font-mono uppercase tracking-wide">
              {rec.category.toLowerCase().replace(/_/g, " ")}
            </span>
            {" · "}
            ~{rec.estimateMinutes}m
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {rec.actionHref ? (
            <Link
              href={rec.actionHref}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              {rec.actionLabel ?? "Open"} →
            </Link>
          ) : null}
        </div>
      </div>

      {/* Action row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[68px]">
        {!isInProgress ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => patchStatus("IN_PROGRESS")}
            className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            In progress
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => patchStatus("COMPLETED")}
          className="rounded-md border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/20 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-300 hover:bg-green-100 disabled:opacity-50"
        >
          Done
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowDismiss((v) => !v)}
          className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>

      {showDismiss ? (
        <div className="mt-2 pl-[68px] flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            placeholder="Reason (not relevant, already done outside LeaseStack, etc.)"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && dismissReason.trim().length >= 4) {
                patchStatus("DISMISSED", dismissReason.trim());
              }
            }}
          />
          <button
            type="button"
            disabled={pending || dismissReason.trim().length < 4}
            onClick={() => patchStatus("DISMISSED", dismissReason.trim())}
            className="rounded-md bg-foreground px-2.5 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      ) : null}
    </li>
  );
}
