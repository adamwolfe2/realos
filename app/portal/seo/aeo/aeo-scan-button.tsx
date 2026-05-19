"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";

// "Scan now" button for /portal/seo/aeo. Posts to /api/portal/seo/aeo/scan
// then refreshes the route's server data on success. The endpoint is
// rate-limited to 1 scan / 12h / org — we surface the 429 message inline.
type ScanState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; rowsWritten: number; propertiesScanned: number }
  | { kind: "error"; message: string };

export function AeoScanButton() {
  const router = useRouter();
  const [state, setState] = React.useState<ScanState>({ kind: "idle" });

  React.useEffect(() => {
    if (state.kind === "done") {
      const t = setTimeout(() => setState({ kind: "idle" }), 4000);
      return () => clearTimeout(t);
    }
    if (state.kind === "error") {
      const t = setTimeout(() => setState({ kind: "idle" }), 6000);
      return () => clearTimeout(t);
    }
  }, [state]);

  async function onClick() {
    if (state.kind === "busy") return;
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/portal/seo/aeo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        rowsWritten?: number;
        propertiesScanned?: number;
      };
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            data.error ??
            (res.status === 429
              ? "Already ran a scan in the last 12 hours."
              : `Scan failed (${res.status})`),
        });
        return;
      }
      setState({
        kind: "done",
        rowsWritten: data.rowsWritten ?? 0,
        propertiesScanned: data.propertiesScanned ?? 0,
      });
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
          {state.rowsWritten} queries · {state.propertiesScanned} properties
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
