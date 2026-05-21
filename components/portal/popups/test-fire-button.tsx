"use client";

import { useState } from "react";
import { Zap, Loader2, Check, AlertCircle } from "lucide-react";

interface Props {
  campaignId: string;
}

/**
 * Operator-initiated synthetic-event button. POSTs to
 * /api/portal/popups/{id}/test-fire, which writes a PopupEvent
 * marked as a portal probe (sessionId prefix "operator-test-",
 * pageUrl "[portal-test-fire]") so the Live activity feed picks it
 * up within ~3s.
 *
 * Purpose: end-to-end verification that the events pipeline works
 * BEFORE the operator embeds the snippet on their real site. If they
 * can fire a synthetic event and see it land in the feed, they know
 * the only remaining variable is the embed itself.
 */
export function TestFireButton({ campaignId }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch(
        `/api/portal/popups/${encodeURIComponent(campaignId)}/test-fire`,
        { method: "POST", credentials: "same-origin" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("done");
      setTimeout(() => setState("idle"), 3_000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4_000);
    }
  }

  const isBusy = state === "loading";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-60"
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "done" ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : state === "error" ? (
        <AlertCircle className="h-3.5 w-3.5 text-red-600" />
      ) : (
        <Zap className="h-3.5 w-3.5" />
      )}
      {state === "done"
        ? "Test event fired"
        : state === "error"
          ? "Test failed — retry"
          : state === "loading"
            ? "Firing…"
            : "Test-fire SHOWN event"}
    </button>
  );
}
