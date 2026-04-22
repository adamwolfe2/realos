"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { runDetectorsNow } from "@/app/portal/insights/actions";

export function RunDetectorsButton() {
  const [state, setState] = React.useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = React.useState<string | null>(null);

  async function handleClick() {
    setState("running");
    setMsg(null);
    const res = await runDetectorsNow();
    if ("error" in res) {
      setState("error");
      setMsg(res.error ?? "Unknown error");
    } else {
      setState("done");
      const total = res.inserted + res.updated;
      setMsg(total > 0 ? `${total} insight${total !== 1 ? "s" : ""} surfaced` : "No new insights");
      setTimeout(() => { setState("idle"); setMsg(null); }, 4000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "running"}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${state === "running" ? "animate-spin" : ""}`} />
        {state === "running" ? "Running…" : "Run detectors"}
      </button>
      {msg && (
        <span className={`text-xs font-medium ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
