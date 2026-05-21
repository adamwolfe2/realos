"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

type Props = {
  orgId: string;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
};

/**
 * Triggers POST /api/admin/site-intelligence/[orgId]/refresh with force=true,
 * then router.refresh() on success. Auto-disables for 5s after click so
 * impatient operators can't double-fire an expensive Firecrawl+Perplexity
 * pipeline. Used on the list page (per-row) and detail page (top bar).
 */
export function RefreshButton({
  orgId,
  label = "Refresh now",
  variant = "primary",
  className = "",
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const disabled = pending || cooldown;

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    setPending(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/admin/site-intelligence/${orgId}/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body && typeof body.error === "string" && body.error) ||
            `Refresh failed (${res.status})`,
        );
      }
      setCooldown(true);
      window.setTimeout(() => setCooldown(false), 5000);
      startTransition(() => router.refresh());
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setPending(false);
    }
  }

  const base =
    variant === "primary"
      ? "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      : "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`${base} ${className}`}
      >
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Refreshing…
          </>
        ) : cooldown ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Queued
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            {label}
          </>
        )}
      </button>
      {errorMsg ? (
        <span className="text-[11px] font-mono text-destructive" title={errorMsg}>
          {errorMsg.slice(0, 80)}
        </span>
      ) : null}
    </div>
  );
}
