"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { refreshAudienceSegments } from "@/lib/actions/audiences";

export function RefreshSegmentsButton({
  variant = "default",
  size = "sm",
}: {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await refreshAudienceSegments();
      if (result.ok) {
        if (result.total === 0) {
          setMessage("No audiences found in AudienceLab.");
        } else {
          const parts: string[] = [];
          if (result.created > 0) parts.push(`${result.created} new`);
          if (result.updated > 0) parts.push(`${result.updated} updated`);
          if (result.failed > 0) parts.push(`${result.failed} failed`);
          setMessage(
            `Synced ${result.total} audience${result.total === 1 ? "" : "s"}${parts.length ? ` — ${parts.join(", ")}` : ""}`,
          );
        }
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={pending}
        className="rounded-md"
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? "Refreshing…" : "Refresh"}
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
      {error ? (
        <span className="text-xs text-destructive max-w-xs text-right">
          {error}
        </span>
      ) : null}
    </div>
  );
}
