"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  draftId: string;
};

// ---------------------------------------------------------------------------
// DraftReviewControls — three buttons (approve / request changes / reject)
// with a notes textarea. Approve also has a "ship now" toggle.
// ---------------------------------------------------------------------------
export function DraftReviewControls({ draftId }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [ship, setShip] = useState(false);
  const [pending, startTransition] = useTransition();

  function call(path: "approve" | "reject", body: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/content-drafts/${draftId}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(json?.error ?? "Action failed.");
          return;
        }
        toast.success("Updated.");
        router.refresh();
        router.push("/admin/content-drafts");
      } catch {
        toast.error("Network error.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
        Review
      </h2>

      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional notes for approve. Required for request-changes / reject."
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 text-[12px] text-foreground">
          <input
            type="checkbox"
            checked={ship}
            onChange={(e) => setShip(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Mark as shipped (I&apos;m pasting it live now)
        </label>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (notes.trim().length < 4) {
                toast.error("Add notes describing what to fix.");
                return;
              }
              call("reject", { mode: "reject", notes });
            }}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (notes.trim().length < 4) {
                toast.error("Add notes describing what to fix.");
                return;
              }
              call("reject", { mode: "request_changes", notes });
            }}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Request changes
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              call("approve", {
                notes: notes.trim() || undefined,
                ship,
              })
            }
            className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {ship ? "Approve + ship" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
