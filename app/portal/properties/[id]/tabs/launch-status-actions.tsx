"use client";

import { useState, useTransition } from "react";
import { Rocket, Pause, Play, Undo2, Loader2 } from "lucide-react";
import { setPropertyLaunchStatus } from "@/lib/actions/properties";
import { cn } from "@/lib/utils";

export function LaunchStatusActions({
  propertyId,
  currentStatus,
  allRequiredComplete,
}: {
  propertyId: string;
  currentStatus: string;
  allRequiredComplete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function act(action: "mark_live" | "mark_onboarding" | "pause" | "resume") {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await setPropertyLaunchStatus({ propertyId, action });
      if (!result.ok) setErrorMessage(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        {currentStatus === "PAUSED" ? (
          <button
            type="button"
            onClick={() => act("resume")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-foreground bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            Resume
          </button>
        ) : (
          <>
            {currentStatus !== "LIVE" ? (
              <button
                type="button"
                onClick={() => act("mark_live")}
                disabled={pending || !allRequiredComplete}
                title={
                  allRequiredComplete
                    ? "Promote to LIVE — counts in marketing dashboards"
                    : "Complete all required steps to enable"
                }
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  allRequiredComplete
                    ? "border border-foreground bg-foreground text-background hover:bg-foreground/90"
                    : "border border-border bg-muted/40 text-muted-foreground cursor-not-allowed",
                  pending && "opacity-50",
                )}
              >
                {pending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Mark live
              </button>
            ) : (
              <button
                type="button"
                onClick={() => act("mark_onboarding")}
                disabled={pending}
                title="Move back to ONBOARDING — useful if integrations need re-verification"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground rounded-md border border-border hover:bg-muted/40 disabled:opacity-50"
              >
                <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                Mark onboarding
              </button>
            )}
            <button
              type="button"
              onClick={() => act("pause")}
              disabled={pending}
              title="Pause reporting for this property without removing it"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground rounded-md border border-border hover:bg-muted/40 disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
              Pause
            </button>
          </>
        )}
      </div>
      {errorMessage ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
