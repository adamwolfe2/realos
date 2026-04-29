"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { refreshSegmentInsights } from "@/lib/actions/audiences";

export function RefreshInsightsButton({ segmentId }: { segmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await refreshSegmentInsights(segmentId);
      if (result.ok) {
        setMessage(
          `Sampled ${result.sampleSize} members. ${result.emailMatchPct}% email, ${result.phoneMatchPct}% phone.`,
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
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md"
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? "Sampling…" : "Refresh insights"}
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground max-w-xs text-right">
          {message}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs text-destructive max-w-xs text-right">
          {error}
        </span>
      ) : null}
    </div>
  );
}
