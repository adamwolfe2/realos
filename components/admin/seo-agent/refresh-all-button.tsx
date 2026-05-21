"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// AdminRefreshAllButton — kicks /api/admin/seo-agent/refresh-all to
// repopulate recommendations across every LIVE property in every
// CLIENT org. Returns a summary toast with scanned/written/expired
// counts. Confirms before firing because it's expensive.
// ---------------------------------------------------------------------------
export function AdminRefreshAllButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Re-run the recommendation engine for every LIVE property across every client org? This runs up to 200 properties.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/seo-agent/refresh-all", {
          method: "POST",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body?.error ?? "Refresh failed.");
          return;
        }
        toast.success(
          `Refreshed ${body.scanned} ${body.scanned === 1 ? "property" : "properties"}: ${body.written} written, ${body.expired} expired${body.errors?.length ? ` · ${body.errors.length} errors` : ""}.`,
        );
        router.refresh();
      } catch {
        toast.error("Network error.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-primary/15 transition-colors disabled:opacity-50"
    >
      {pending ? "Refreshing all clients…" : "Force-refresh all clients"}
    </button>
  );
}
