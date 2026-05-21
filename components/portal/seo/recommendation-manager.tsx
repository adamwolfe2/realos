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
  // Enterprise-blue severity treatment. Severity now reads from
  // saturation + a thin left rule rather than hue, so the rec queue
  // stays cohesive with the rest of the portal (no amber/coral/red).
  // Critical is the densest primary; LOW lives in muted with no fill.
  CRITICAL: "bg-primary text-primary-foreground border-primary",
  HIGH: "bg-primary/15 text-primary border-primary/25",
  MEDIUM: "bg-muted text-foreground border-border",
  LOW: "bg-background text-muted-foreground border-border",
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
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const [bulkMode, setBulkMode] = useState<null | "dismiss" | "snooze">(null);
  const [bulkReason, setBulkReason] = useState("");

  if (recommendations.length === 0) {
    return null;
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === recommendations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recommendations.map((r) => r.id)));
    }
  }
  function callBulk(
    action: "in_progress" | "completed" | "dismissed" | "snoozed",
    extra: { reason?: string; snoozeUntil?: string } = {},
  ) {
    if (selected.size === 0) return;
    startBulk(async () => {
      try {
        const res = await fetch("/api/portal/seo/recommendations/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: Array.from(selected),
            action,
            ...extra,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body?.error ?? "Bulk action failed.");
          return;
        }
        toast.success(
          `Updated ${body.updated} rec${body.updated === 1 ? "" : "s"}${body.skipped > 0 ? ` · ${body.skipped} skipped` : ""}.`,
        );
        setSelected(new Set());
        setBulkMode(null);
        setBulkReason("");
        router.refresh();
      } catch {
        toast.error("Network error.");
      }
    });
  }
  function bulkSnooze(days: number) {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    callBulk("snoozed", { snoozeUntil: date.toISOString() });
  }

  const allSelected =
    selected.size > 0 && selected.size === recommendations.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="h-3.5 w-3.5"
          />
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
              Recommendations queue
            </p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">
              {selected.size > 0
                ? `${selected.size} selected`
                : `${recommendations.length} open`}
            </h3>
          </div>
        </label>
        {selected.size > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={bulkPending}
              onClick={() => callBulk("completed")}
              className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/15 hover:border-primary/40 disabled:opacity-50 transition-colors"
            >
              Mark done
            </button>
            <button
              type="button"
              disabled={bulkPending}
              onClick={() => setBulkMode("snooze")}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Snooze
            </button>
            <button
              type="button"
              disabled={bulkPending}
              onClick={() => setBulkMode("dismiss")}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Select rows for bulk actions, or use per-row controls
          </p>
        )}
      </header>

      {bulkMode === "snooze" ? (
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border/60 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-1">
            Snooze {selected.size} for:
          </span>
          {[
            { label: "1 week", days: 7 },
            { label: "2 weeks", days: 14 },
            { label: "1 month", days: 30 },
            { label: "1 quarter", days: 90 },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              disabled={bulkPending}
              onClick={() => bulkSnooze(opt.days)}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBulkMode(null)}
            className="ml-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {bulkMode === "dismiss" ? (
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border/60 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder={`Reason for dismissing ${selected.size} rec${selected.size === 1 ? "" : "s"}`}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && bulkReason.trim().length >= 4) {
                callBulk("dismissed", { reason: bulkReason.trim() });
              }
            }}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={bulkPending || bulkReason.trim().length < 4}
              onClick={() =>
                callBulk("dismissed", { reason: bulkReason.trim() })
              }
              className="rounded-md bg-foreground px-2.5 py-1 text-[11.5px] font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              Confirm dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkMode(null);
                setBulkReason("");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-border/60">
        {recommendations.map((r) => (
          <RecommendationRow
            key={r.id}
            rec={r}
            selected={selected.has(r.id)}
            onSelect={() => toggleSelect(r.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function RecommendationRow({
  rec,
  selected,
  onSelect,
}: {
  rec: SeoRecommendation;
  selected: boolean;
  onSelect: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [showSnooze, setShowSnooze] = useState(false);

  function patchStatus(
    status: "IN_PROGRESS" | "COMPLETED" | "DISMISSED" | "SNOOZED",
    extra: { reason?: string; snoozeUntil?: string } = {},
  ) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/portal/seo/recommendations/${rec.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, ...extra }),
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
              : status === "SNOOZED"
                ? "Snoozed"
                : "Dismissed";
        toast.success(label);
        setShowDismiss(false);
        setShowSnooze(false);
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
    <li className={`px-4 py-3 transition-colors ${selected ? "bg-primary/5" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-3.5 w-3.5 mt-1 shrink-0"
          aria-label="Select this recommendation"
        />
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
          className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/15 hover:border-primary/40 disabled:opacity-50 transition-colors"
        >
          Done
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowSnooze((v) => !v)}
          className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          Snooze
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

      {showSnooze ? (
        <div className="mt-2 pl-[68px] flex flex-wrap gap-1.5">
          {(
            [
              { label: "1 week", days: 7 },
              { label: "2 weeks", days: 14 },
              { label: "1 month", days: 30 },
              { label: "Until next quarter", days: 90 },
            ] as const
          ).map((opt) => (
            <button
              key={opt.label}
              type="button"
              disabled={pending}
              onClick={() => {
                const date = new Date(
                  Date.now() + opt.days * 24 * 60 * 60 * 1000,
                );
                patchStatus("SNOOZED", { snoozeUntil: date.toISOString() });
              }}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowSnooze(false)}
            className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : null}

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
                patchStatus("DISMISSED", { reason: dismissReason.trim() });
              }
            }}
          />
          <button
            type="button"
            disabled={pending || dismissReason.trim().length < 4}
            onClick={() =>
              patchStatus("DISMISSED", { reason: dismissReason.trim() })
            }
            className="rounded-md bg-foreground px-2.5 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      ) : null}
    </li>
  );
}
