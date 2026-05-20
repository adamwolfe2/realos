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
  | {
      kind: "done";
      scanned: number;
      backfilled: number;
      /** Per-source failures, e.g. ["yelp: rate limit (429)"]. Surface
       * these instead of swallowing so operators don't see "Scanned 1
       * property" while Yelp / Tavily silently failed. */
      sourceErrors: string[];
    }
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
        results?: Array<{
          propertyId: string;
          status: string;
          error?: string;
          sourceErrors?: Array<{ source: string; error: string }>;
        }>;
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
      // Collapse per-property sourceErrors into a compact list. The
      // server-side limit of 5 properties keeps this bounded.
      const sourceErrors: string[] = [];
      for (const r of data.results ?? []) {
        for (const se of r.sourceErrors ?? []) {
          sourceErrors.push(`${se.source}: ${se.error}`);
        }
      }
      setState({
        kind: "done",
        scanned: data.scanned ?? 0,
        backfilled: data.backfilled ?? 0,
        sourceErrors,
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
          {state.sourceErrors.length === 0 ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-foreground" />
          )}
          Scanned {state.scanned}{" "}
          {state.scanned === 1 ? "property" : "properties"}
          {state.backfilled > 0 ? ` · classified ${state.backfilled}` : ""}
          {state.sourceErrors.length > 0
            ? ` · ${state.sourceErrors.length} source ${state.sourceErrors.length === 1 ? "failure" : "failures"} (${[
                ...new Set(
                  state.sourceErrors.map((e) => e.split(":")[0]),
                ),
              ].join(", ")})`
            : ""}
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
