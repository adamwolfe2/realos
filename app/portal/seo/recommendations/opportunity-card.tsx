"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Severity treatment + row actions for the Opportunities table (DataTable).
//
// This used to render a full stand-alone card per recommendation; the list
// is now a DataTable (see opportunities-client.tsx) with one column per
// dimension (title, category, severity, score) and this file supplies the
// two pieces that still need their own markup + state: the severity chip
// and the Done/Decline action cell.
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
// On Done / Decline we optimistically remove the row from the local list via
// the `onResolved(id)` callback so the next render in the parent skips it.
// The PATCH endpoint and a router.refresh() keep server state in sync.
// Decline opens an inline reason input (4+ chars required, same as the
// original RecommendationManager).
// ---------------------------------------------------------------------------

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const SEVERITY_DOT: Record<Severity, string> = {
  CRITICAL: "bg-primary",
  HIGH: "bg-primary/70",
  MEDIUM: "bg-primary/40",
  LOW: "bg-muted-foreground/60",
};

export const SEVERITY_TEXT: Record<Severity, string> = {
  CRITICAL: "text-foreground font-semibold",
  HIGH: "text-foreground font-medium",
  MEDIUM: "text-muted-foreground font-medium",
  LOW: "text-muted-foreground",
};

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={["h-2 w-2 rounded-full shrink-0", SEVERITY_DOT[severity]].join(
          " ",
        )}
        aria-hidden
      />
      <span
        className={[
          "text-[11px] uppercase tracking-wide whitespace-nowrap",
          SEVERITY_TEXT[severity],
        ].join(" ")}
      >
        {SEVERITY_LABEL[severity]}
      </span>
    </span>
  );
}

type ActionsProps = {
  id: string;
  onResolved: (id: string) => void;
};

export function OpportunityRowActions({ id, onResolved }: ActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");

  function patch(
    status: "COMPLETED" | "DISMISSED",
    extra: { reason?: string } = {},
  ) {
    // We trust the PATCH will succeed because the schema validates
    // client-side; on failure we just surface a toast and leave the row in
    // place (no optimistic removal has happened, so there's nothing to
    // revert).
    startTransition(async () => {
      try {
        const res = await fetch(`/api/portal/seo/recommendations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, ...extra }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body?.error ?? "Update failed.");
          return;
        }
        toast.success(status === "COMPLETED" ? "Marked done" : "Declined");
        onResolved(id);
        router.refresh();
      } catch {
        toast.error("Network error.");
      }
    });
  }

  if (showDecline) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (not relevant, already handled, etc.)"
          className="w-64 min-w-0 rounded-[2px] border border-border bg-background px-1.5 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/30"
          onKeyDown={(e) => {
            if (e.key === "Enter" && reason.trim().length >= 4) {
              patch("DISMISSED", { reason: reason.trim() });
            }
          }}
        />
        <button
          type="button"
          disabled={pending || reason.trim().length < 4}
          onClick={() => patch("DISMISSED", { reason: reason.trim() })}
          className="rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          OK
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
    );
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={pending}
        onClick={() => patch("COMPLETED")}
        className="rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Done
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setShowDecline(true)}
        className="rounded-md border border-border bg-background px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  );
}
