"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Slice 1b — on-demand install verification. Calls the tenant-scoped probe
// (/api/portal/pixel/check-install) which fetches the client's site server-side
// and confirms the Cursive pixel loader is actually present. Replaces the old
// "paste-and-pray" flow where the only signal was a webhook eventually landing.

type ProbeResult = {
  ok: boolean;
  status:
    | "DETECTED_OK"
    | "DETECTED_WRONG_PIXEL"
    | "NOT_DETECTED"
    | "NO_URL"
    | "FETCH_FAILED";
  message: string;
};

const TONE: Record<ProbeResult["status"], string> = {
  DETECTED_OK:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
  DETECTED_WRONG_PIXEL: "border-amber-500/30 bg-amber-500/5 text-amber-700",
  NOT_DETECTED: "border-amber-500/30 bg-amber-500/5 text-amber-700",
  NO_URL: "border-border bg-muted/30 text-muted-foreground",
  FETCH_FAILED: "border-border bg-muted/30 text-muted-foreground",
};

export function PixelInstallCheck() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/pixel/check-install?force=1", {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(
          res.status === 400
            ? "That website URL isn't allowed."
            : "Couldn't run the check right now.",
        );
        setResult(null);
        return;
      }
      const data = (await res.json()) as ProbeResult;
      setResult(data);
    } catch {
      setError("Couldn't run the check right now.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" size="sm" variant="outline" onClick={check} disabled={loading}>
          {loading ? "Checking your site…" : "Verify install"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          We&apos;ll load your site and confirm the pixel is live.
        </span>
      </div>
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : null}
      {result ? (
        <div
          className={`rounded-md border px-3 py-2 text-[12px] leading-relaxed ${TONE[result.status]}`}
          style={{ borderRadius: 6 }}
        >
          {result.message}
        </div>
      ) : null}
    </div>
  );
}
