"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// "Scan now" button for /portal/reputation.
//
// Posts to /api/portal/reputation/scan and refreshes the route's server data
// on success so the inbox shows the freshly-pulled mentions without a
// full reload. The endpoint is rate-limited 1/hour/org — we surface a
// helpful inline message when we hit the cap rather than blanking out.
//
// Three visible states:
//   * idle  — neutral pill, "Scan now"
//   * busy  — spinning icon, "Scanning…", disabled
//   * done  — green checkmark, count of new mentions for ~3s
//   * error — red alert with the server message for ~5s
// ---------------------------------------------------------------------------

type ScanState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; scanned: number; backfilled: number }
  | { kind: "error"; message: string };

export function ReputationScanButton() {
  const router = useRouter();
  const [state, setState] = React.useState<ScanState>({ kind: "idle" });

  // Auto-clear transient states (done/error) so the button returns to idle.
  React.useEffect(() => {
    if (state.kind === "done") {
      const t = setTimeout(() => setState({ kind: "idle" }), 3000);
      return () => clearTimeout(t);
    }
    if (state.kind === "error") {
      const t = setTimeout(() => setState({ kind: "idle" }), 5000);
      return () => clearTimeout(t);
    }
  }, [state]);

  async function onClick() {
    if (state.kind === "busy") return;
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/portal/reputation/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        scanned?: number;
        backfilled?: number;
      };
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            data.error ??
            (res.status === 429
              ? "Rate limit hit — try again in an hour."
              : `Scan failed (${res.status})`),
        });
        return;
      }
      setState({
        kind: "done",
        scanned: data.scanned ?? 0,
        backfilled: data.backfilled ?? 0,
      });
      // Re-fetch server data so the inbox + KPIs reflect the new rows.
      router.refresh();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={state.kind === "busy"}
        className={
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors " +
          "border-foreground bg-foreground text-background hover:bg-foreground/90 " +
          "disabled:opacity-60 disabled:cursor-wait"
        }
      >
        <RefreshCcw
          className={
            "h-3.5 w-3.5 " + (state.kind === "busy" ? "animate-spin" : "")
          }
        />
        {state.kind === "busy" ? "Scanning…" : "Scan now"}
      </button>
      {state.kind === "done" ? (
        <span className="inline-flex items-center gap-1 text-xs text-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          Scanned {state.scanned} {state.scanned === 1 ? "property" : "properties"}
          {state.backfilled > 0 ? ` · classified ${state.backfilled}` : ""}
        </span>
      ) : null}
      {state.kind === "error" ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 text-foreground" />
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
