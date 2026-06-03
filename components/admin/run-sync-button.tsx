"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import type { SinkProvider } from "@/lib/admin/data-sinks";

// ---------------------------------------------------------------------------
// RunSyncButton — fires the per-provider data-sinks run endpoint, then
// router.refresh()es so the parent server component re-pulls fresh status
// and the cards repaint with the new lastRunAt timestamp.
//
// We deliberately keep this a client component (the parent is a server
// component) so we can show a "Running…" spinner while the cron is being
// kicked off. The actual sync runs async on Vercel; we only need to
// confirm the kickoff returned 200 before refreshing.
// ---------------------------------------------------------------------------

type Props = {
  provider: SinkProvider;
  cronJobName: string | null;
  scope: "platform" | "tenant";
  orgId?: string;
};

export function RunSyncButton({ provider, cronJobName, scope, orgId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!cronJobName) {
    // Push-driven sinks with no scheduled cron get a disabled hint
    // instead of a misleading button. Cursive pixel etc.
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        Push-driven · no manual run
      </span>
    );
  }

  async function handleClick() {
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/data-sinks/${provider}/run`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope, orgId: orgId ?? null }),
        }
      );
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start sync");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        {pending ? "Running…" : "Run sync now"}
      </button>
      {error ? (
        <span className="text-[10px] text-destructive line-clamp-1">
          {error}
        </span>
      ) : null}
    </div>
  );
}
