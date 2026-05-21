"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  id: string;
};

// ---------------------------------------------------------------------------
// ReopenForm — one-click reopen of an archived recommendation. PATCHes
// status back to OPEN via the existing endpoint, which clears every
// terminal column (completedAt, dismissedAt, etc.). router.refresh()
// repaints the archive list.
// ---------------------------------------------------------------------------
export function ReopenForm({ id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function reopen() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/portal/seo/recommendations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "OPEN" }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body?.error ?? "Could not reopen.");
          return;
        }
        toast.success("Reopened — back in your active queue.");
        router.refresh();
      } catch {
        toast.error("Network error.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={reopen}
      disabled={pending}
      className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
      title="Move this recommendation back to OPEN"
    >
      Reopen
    </button>
  );
}
