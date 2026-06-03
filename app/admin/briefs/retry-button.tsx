"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { retryBrief } from "./actions";

export function RetryButton({ briefId }: { briefId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await retryBrief(briefId);
            toast.success("Brief regenerated");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Retry failed");
          }
        });
      }}
      className="text-[12px] font-medium text-primary hover:underline disabled:opacity-50"
    >
      {pending ? "Retrying…" : "Retry"}
    </button>
  );
}
