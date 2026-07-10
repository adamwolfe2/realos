"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// MarketIntelligenceClient — refresh button + status pill for the Market
// Intelligence section header. Posts to the per-property refresh route
// (rate-limited 1/day), then forces a router refresh so the server
// component pulls the new snapshot from the cache.
// ---------------------------------------------------------------------------

type Props = {
  propertyId: string;
  freshnessLabel: string;
};

export function MarketIntelligenceClient({ propertyId, freshnessLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; refreshedAt: string }
    | { kind: "limit" }
    | { kind: "upsell"; copy: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function onRefresh() {
    if (pending) return;
    setStatus({ kind: "idle" });
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/portal/properties/${propertyId}/rentcast/refresh`,
          { method: "POST" },
        );

        if (res.status === 429) {
          setStatus({ kind: "limit" });
          return;
        }
        if (res.status === 402) {
          const body = (await res.json().catch(() => ({}))) as {
            upgrade?: { headline?: string; body?: string };
          };
          setStatus({
            kind: "upsell",
            copy:
              body.upgrade?.headline ??
              "You've hit your RentCast credit cap for the month.",
          });
          return;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setStatus({
            kind: "error",
            message: text.length > 0 ? text.slice(0, 120) : `HTTP ${res.status}`,
          });
          return;
        }

        const body = (await res.json()) as { refreshedAt: string };
        setStatus({ kind: "ok", refreshedAt: body.refreshedAt });
        // Server component re-renders with the fresh cached snapshot.
        router.refresh();
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Refresh failed",
        });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline text-[10.5px] text-muted-foreground">
        {status.kind === "ok"
          ? "Refreshed just now"
          : status.kind === "limit"
            ? "Daily refresh limit reached — try again tomorrow"
            : status.kind === "upsell"
              ? status.copy
              : status.kind === "error"
                ? status.message
                : freshnessLabel}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hair)] bg-background px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
      >
        <span
          className={`inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent ${
            pending ? "animate-spin" : "border-t-current"
          }`}
          aria-hidden
        />
        {pending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
