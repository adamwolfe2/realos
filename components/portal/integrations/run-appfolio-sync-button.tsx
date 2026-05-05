"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triggerAppfolioSync } from "@/lib/actions/appfolio-connect";
import { Loader2, RefreshCw } from "lucide-react";

// Tenant-scoped manual AppFolio sync trigger. Wraps the existing
// triggerAppfolioSync server action so any operations page can offer a
// one-click "run sync now" without bouncing through Settings → Integrations.

type Props = {
  label?: string;
  /** Render as a quieter ghost button (used on the healthy/synced banner). */
  subtle?: boolean;
};

type State =
  | { kind: "idle" }
  | { kind: "ok"; created: number; updated: number }
  | { kind: "error"; message: string };

export function RunAppFolioSyncButton({ label = "Run sync now", subtle = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<State>({ kind: "idle" });

  function onClick() {
    setState({ kind: "idle" });
    startTransition(async () => {
      try {
        const res = await triggerAppfolioSync();
        if (!res.ok) {
          setState({ kind: "error", message: res.error ?? "Sync failed" });
          return;
        }
        const stats = res.stats ?? { propertiesUpserted: 0, listingsUpserted: 0 };
        setState({
          kind: "ok",
          created: stats.propertiesUpserted ?? 0,
          updated: stats.listingsUpserted ?? 0,
        });
        router.refresh();
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Sync failed",
        });
      }
    });
  }

  const cls = subtle
    ? "inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-card px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={cls}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {pending ? "Syncing…" : label}
      </button>
      {state.kind === "ok" ? (
        <span className="text-[11px] text-primary">
          Done · {state.updated} listings refreshed
        </span>
      ) : null}
      {state.kind === "error" ? (
        <span className="text-[11px] text-destructive max-w-[260px] text-right">
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
