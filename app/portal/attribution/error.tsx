"use client";

import { useEffect } from "react";

export default function AttributionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[attribution] error.tsx caught:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Attribution
        </h1>
      </div>
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
        <p className="font-semibold">
          Attribution view temporarily unavailable.
        </p>
        <p className="mt-1 text-xs leading-snug">
          The data may be partially seeded. Refresh in a moment, or check the
          dashboard for the rolled-up version.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
          {error.digest ? (
            <span className="text-[10px] font-mono opacity-70">
              ref: {error.digest}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
