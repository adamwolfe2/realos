"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStartTrialCheckout } from "./use-start-trial-checkout";

export function AddCardButton({
  tierId,
  propertyCount,
  label,
  className,
}: {
  tierId: "starter" | "growth" | "scale";
  propertyCount: number;
  label: string;
  className?: string;
}) {
  const { submitting, start } = useStartTrialCheckout();
  return (
    <button
      type="button"
      onClick={() => start(tierId, propertyCount)}
      disabled={submitting}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-none transition-colors px-3 py-1.5 text-xs font-semibold disabled:opacity-60 disabled:cursor-progress",
        className,
      )}
    >
      {submitting ? (
        <>
          <Loader2 className="animate-spin" size={12} strokeWidth={2.5} aria-hidden="true" />
          Opening checkout…
        </>
      ) : (
        label
      )}
    </button>
  );
}
