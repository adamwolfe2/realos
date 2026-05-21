"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  propertyId?: string;
  label?: string;
};

// ---------------------------------------------------------------------------
// Triggers the recommendation engine to re-run for the current property
// (or org-wide when propertyId omitted). Refreshes the page so the new
// recs render immediately.
// ---------------------------------------------------------------------------
export function RefreshRecommendationsButton({
  propertyId,
  label = "Refresh recommendations",
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function go() {
    start(async () => {
      try {
        const res = await fetch("/api/portal/seo/recommendations/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(propertyId ? { propertyId } : {}),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body?.error ?? "Refresh failed.");
          return;
        }
        toast.success(
          `Refreshed ${body?.scanned ?? 0} ${
            body?.scanned === 1 ? "property" : "properties"
          }.`,
        );
        router.refresh();
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
    >
      {pending ? "Refreshing…" : label}
    </button>
  );
}
