"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// One-click "Convert to lead" CTA on /portal/visitors/[id]. Shown only
// when the visitor has an email but no matched Lead yet. Calls the
// idempotent POST /api/tenant/visitors/[visitorId]/convert endpoint
// and refreshes the page so the matched-lead card appears next render.
export function ConvertToLeadButton({
  visitorId,
  disabled,
  disabledReason,
}: {
  visitorId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function convert() {
    if (disabled) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/tenant/visitors/${visitorId}/convert`,
          { method: "POST" },
        );
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          leadId?: string;
          created?: boolean;
          error?: string;
        };
        if (!res.ok || !body.ok) {
          toast.error(body.error ?? `Convert failed (${res.status})`);
          return;
        }
        toast.success(
          body.created
            ? "Lead created — visitor promoted to MATCHED_TO_LEAD."
            : "Lead already existed — linked it back.",
        );
        setDone(true);
        // Refresh the visitor page so the "Matched lead" card renders.
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Convert failed");
      }
    });
  }

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className="px-3 py-1.5 text-xs font-medium border border-border rounded-md text-muted-foreground cursor-not-allowed"
      >
        Convert to lead
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={convert}
      disabled={pending || done}
      className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
    >
      {pending ? "Converting…" : done ? "Converted ✓" : "Convert to lead"}
    </button>
  );
}
