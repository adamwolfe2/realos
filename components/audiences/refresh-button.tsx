"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { refreshAudienceSegments } from "@/lib/actions/audiences";

export function RefreshSegmentsButton() {
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
        setMessage(
          `Synced ${result.total} segments (${result.created} new, ${result.updated} updated)`,
        );
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
        variant="default"
        onClick={handleClick}
        disabled={pending}
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? "Syncing…" : "Refresh segments"}
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
