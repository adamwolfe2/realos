"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Draft = {
  id: string;
  format: string;
  brief: string;
  status: string;
  estimatedScore: number | null;
  submittedAt: string | null;
  createdAt: string;
  orgName: string;
  propertyName: string | null;
};

type Props = {
  drafts: Draft[];
};

const STATUS_TONE: Record<string, string> = {
  GENERATING: "bg-muted text-muted-foreground",
  PENDING_REVIEW:
    "bg-amber-50 text-amber-800",
  APPROVED:
    "bg-green-50 text-green-700",
  CHANGES_REQUESTED:
    "bg-amber-50 text-amber-800",
  REJECTED: "bg-red-50 text-red-700",
  SHIPPED: "bg-blue-50 text-blue-700",
  EXPIRED: "bg-muted text-muted-foreground",
};

function fmtAge(d: string | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return `${Math.max(0, Math.floor(ms / 60000))}m ago`;
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// BulkActions — admin queue with row-level checkboxes + a sticky bar that
// shows action buttons once at least one row is selected.
//
// Actions:
//   - Approve selected     (no notes required)
//   - Request changes      (modal — notes required)
//   - Reject               (modal — notes required)
//
// Calls POST /api/admin/content-drafts/bulk. Up to 50 ids per call;
// the queue rendering caps at 200 anyway.
// ---------------------------------------------------------------------------
export function BulkActions({ drafts }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNotesModal, setShowNotesModal] = useState<null | "reject" | "request_changes">(
    null,
  );
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const allSelected = selected.size > 0 && selected.size === drafts.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected || someSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(drafts.map((d) => d.id)));
    }
  }

  function call(
    action: "approve" | "ship" | "reject" | "request_changes",
    notesValue?: string,
  ) {
    if (selected.size === 0) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/content-drafts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: Array.from(selected),
            action,
            notes: notesValue,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body?.error ?? "Bulk action failed.");
          return;
        }
        toast.success(
          `Updated ${body.updated} draft${body.updated === 1 ? "" : "s"}${body.skipped > 0 ? ` · ${body.skipped} skipped` : ""}.`,
        );
        setSelected(new Set());
        setShowNotesModal(null);
        setNotes("");
        router.refresh();
      } catch {
        toast.error("Network error.");
      }
    });
  }

  function openNotesModal(action: "reject" | "request_changes") {
    if (selected.size === 0) {
      toast.error("Select drafts first.");
      return;
    }
    setShowNotesModal(action);
  }

  if (drafts.length === 0) return null;

  return (
    <>
      {/* Select-all header bar */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <label className="inline-flex items-center gap-2 text-[12px] text-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="h-3.5 w-3.5"
          />
          {selected.size > 0
            ? `${selected.size} selected`
            : `Select drafts to bulk-act on ${drafts.length}`}
        </label>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={pending}
              onClick={() => openNotesModal("reject")}
              className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-[11.5px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => openNotesModal("request_changes")}
              className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              Request changes
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => call("approve")}
              className="rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "Working…" : "Approve"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Rows with checkboxes */}
      <ul className="space-y-3 mt-3">
        {drafts.map((d) => {
          const meta = STATUS_TONE[d.status] ?? STATUS_TONE.GENERATING;
          const isSelected = selected.has(d.id);
          return (
            <li
              key={d.id}
              className={`rounded-2xl border bg-card p-4 transition-colors ${
                isSelected ? "border-primary" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(d.id)}
                  className="h-4 w-4 mt-1 shrink-0"
                  aria-label="Select this draft"
                />
                <a
                  href={`/admin/content-drafts/${d.id}`}
                  className="block flex-1 min-w-0"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">
                        {d.format.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase ${meta}`}
                      >
                        {d.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="text-[12px] font-medium text-foreground truncate">
                        {d.orgName}
                        {d.propertyName ? ` · ${d.propertyName}` : ""}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {fmtAge(d.submittedAt ?? d.createdAt)}
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground line-clamp-2 leading-snug">
                    {d.brief}
                  </p>
                  {d.estimatedScore != null ? (
                    <p className="mt-1 text-[11px] font-mono text-muted-foreground">
                      est. score{" "}
                      <span
                        className={
                          d.estimatedScore >= 80
                            ? "text-green-600"
                            : d.estimatedScore >= 60
                              ? "text-amber-600"
                              : "text-red-600"
                        }
                      >
                        {d.estimatedScore}
                      </span>
                    </p>
                  ) : null}
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Notes modal for reject + request_changes */}
      {showNotesModal !== null ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNotesModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                {showNotesModal === "reject"
                  ? `Reject ${selected.size} draft${selected.size === 1 ? "" : "s"}`
                  : `Request changes on ${selected.size} draft${selected.size === 1 ? "" : "s"}`}
              </h2>
              <button
                type="button"
                onClick={() => setShowNotesModal(null)}
                className="text-[18px] text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (applied to every selected draft, sent to operator via bell + email)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Same notes go to every selected draft. Make them generic enough
                to apply broadly.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setShowNotesModal(null)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || notes.trim().length < 4}
                onClick={() => call(showNotesModal, notes.trim())}
                className="rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
