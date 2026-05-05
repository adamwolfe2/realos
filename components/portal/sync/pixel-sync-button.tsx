"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";
import { syncPixelFromSegment } from "@/lib/actions/tenant-pixel-sync";

// ---------------------------------------------------------------------------
// Visitors-page sync control.
//
// Two responsibilities:
//   1. Manual "Sync now" button — operator clicks → server action pulls the
//      latest identified visitors from AudienceLab, upserts them, and
//      revalidates the page.
//   2. Auto-sync on mount when the pixel data is stale (lastEventAt older
//      than the configured threshold OR never fired). Avoids the
//      operator-has-to-remember problem; the page self-heals on load.
//
// Both paths share a 1-min throttle on the server, so even if multiple
// tabs auto-trigger at once they collapse into one AL round-trip.
// ---------------------------------------------------------------------------

type Props = {
  // Last successful pixel webhook event for this tenant. null means we've
  // never seen one — auto-sync fires unconditionally in that case.
  lastEventAt: Date | string | null;
  // True when CursiveIntegration.cursiveSegmentId is bound. Without it the
  // pull-from-segment path is unavailable; we render the button as
  // disabled with a clear reason.
  hasSegment: boolean;
  // Threshold in ms past which auto-sync fires on mount.
  staleThresholdMs?: number;
};

export function PixelSyncButton({
  lastEventAt,
  hasSegment,
  staleThresholdMs = 15 * 60 * 1000,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "success"; pulled: number; created: number; throttled?: boolean }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const autoTriggered = useRef(false);

  function runSync() {
    setStatus({ kind: "idle" });
    startTransition(async () => {
      try {
        const r = await syncPixelFromSegment();
        if (r.ok) {
          setStatus({
            kind: "success",
            pulled: r.pulled,
            created: r.created,
            throttled: r.throttled,
          });
          // Refresh server data so the new visitors render in the table.
          router.refresh();
          // Reset the flash to idle after a few seconds so it doesn't
          // sit stale on the screen.
          setTimeout(() => setStatus({ kind: "idle" }), 6000);
        } else {
          setStatus({ kind: "error", message: r.error });
        }
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Sync failed",
        });
      }
    });
  }

  // Auto-sync on mount when stale.
  useEffect(() => {
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    if (!hasSegment) return;
    const last = lastEventAt ? new Date(lastEventAt).getTime() : 0;
    const ageMs = Date.now() - last;
    const isStale = !lastEventAt || ageMs > staleThresholdMs;
    if (isStale) runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasSegment) {
    return (
      <button
        type="button"
        disabled
        title="Bind an AudienceLab segment in admin to enable on-demand sync"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground/70 cursor-not-allowed"
      >
        <RefreshCw className="h-3 w-3" />
        Sync unavailable
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={runSync}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-60 transition-colors"
      >
        <RefreshCw className={"h-3 w-3 " + (pending ? "animate-spin" : "")} />
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {status.kind === "success" ? (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold"
          aria-live="polite"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
          {status.throttled
            ? "Up to date"
            : `Synced · ${status.pulled} pulled, ${status.created} new`}
        </span>
      ) : null}
      {status.kind === "error" ? (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-semibold max-w-[280px] truncate"
          title={status.message}
          aria-live="polite"
        >
          <AlertTriangle className="h-3 w-3" />
          {status.message}
        </span>
      ) : null}
    </div>
  );
}
