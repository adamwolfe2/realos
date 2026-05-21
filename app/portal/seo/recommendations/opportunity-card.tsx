"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TopCategory } from "@/lib/seo/categorize-recommendation";

// ---------------------------------------------------------------------------
// OpportunityCard — one recommendation, rendered Searchable-style:
//   ┌──────────────────────────────────────────────────────────────┐
//   │ [Basics]                          ● Critical                 │
//   │ Title in semibold                                            │
//   │ One-or-two-line description, line-clamp-2 …                  │
//   │ ─                                                            │
//   │ [Done]  [Decline]                                            │
//   └──────────────────────────────────────────────────────────────┘
//
// Severity treatment: single-blue cohesion (#2563EB) for the dot, with the
// severity *label* carrying the weight. Saturation steps down for lower
// severities so the queue still scans visually:
//   CRITICAL   primary           + bold label
//   HIGH       primary/70        + semibold label
//   MEDIUM     primary/40        + medium label
//   LOW        muted-foreground  + regular label
//
// No greens / ambers / reds anywhere — that's the brief.
//
// On Done / Decline we optimistically remove the card from the local list
// via the `onResolved(id)` callback so the next render in the parent skips
// it. The PATCH endpoint and a router.refresh() keep server state in sync.
// Decline opens an inline reason input (4+ chars required, same as the
// existing RecommendationManager).
// ---------------------------------------------------------------------------

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const SEVERITY_DOT: Record<Severity, string> = {
  CRITICAL: "bg-primary",
  HIGH: "bg-primary/70",
  MEDIUM: "bg-primary/40",
  LOW: "bg-muted-foreground/60",
};

const SEVERITY_TEXT: Record<Severity, string> = {
  CRITICAL: "text-foreground font-semibold",
  HIGH: "text-foreground font-medium",
  MEDIUM: "text-muted-foreground font-medium",
  LOW: "text-muted-foreground",
};

export type OpportunityCardData = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  category: string;
  topCategory: TopCategory;
  subBucket: string;
  propertyName: string | null;
};

type Props = {
  rec: OpportunityCardData;
  onResolved: (id: string) => void;
};

export function OpportunityCard({ rec, onResolved }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState(false);

  function patch(
    status: "COMPLETED" | "DISMISSED",
    extra: { reason?: string } = {},
  ) {
    // Optimistic fade — we trust the PATCH will succeed because the schema
    // validates client-side. If it errors we restore the card via setRemoving
    // and surface the toast.
    setRemoving(true);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/portal/seo/recommendations/${rec.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, ...extra }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRemoving(false);
          toast.error(body?.error ?? "Update failed.");
          return;
        }
        toast.success(status === "COMPLETED" ? "Marked done" : "Declined");
        onResolved(rec.id);
        router.refresh();
      } catch {
        setRemoving(false);
        toast.error("Network error.");
      }
    });
  }

  return (
    <article
      className={[
        "rounded-2xl border border-border bg-card p-4 transition-all duration-200",
        removing
          ? "opacity-0 -translate-y-1 pointer-events-none"
          : "opacity-100",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          {rec.subBucket}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={[
              "h-2 w-2 rounded-full",
              SEVERITY_DOT[rec.severity],
            ].join(" ")}
            aria-hidden
          />
          <span
            className={[
              "text-[11px] uppercase tracking-wide",
              SEVERITY_TEXT[rec.severity],
            ].join(" ")}
          >
            {SEVERITY_LABEL[rec.severity]}
          </span>
        </div>
      </div>

      <h3 className="mt-2 text-[14px] font-semibold text-foreground leading-snug">
        {rec.title}
      </h3>
      <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug line-clamp-2">
        {rec.detail}
      </p>
      {rec.propertyName ? (
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
          {rec.propertyName}
        </p>
      ) : null}

      {showDecline ? (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (not relevant, already handled, etc.)"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && reason.trim().length >= 4) {
                patch("DISMISSED", { reason: reason.trim() });
              }
            }}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={pending || reason.trim().length < 4}
              onClick={() => patch("DISMISSED", { reason: reason.trim() })}
              className="rounded-md bg-foreground px-2.5 py-1 text-[11.5px] font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDecline(false);
                setReason("");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => patch("COMPLETED")}
            className="rounded-md bg-primary px-3 py-1 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Done
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowDecline(true)}
            className="rounded-md border border-border bg-background px-3 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
    </article>
  );
}
