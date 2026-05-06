"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// AppFolio-backed; resident_directory fetches can throw on permissions
// gaps in the integration credentials. Boundary keeps navigation alive.
export default function ResidentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { surface: "portal/residents" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold tracking-tight mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        We couldn&apos;t load your residents. AppFolio occasionally returns
        partial data — try a refresh, or check the AppFolio integration if
        the issue keeps coming back.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/portal/settings/integrations")}
        >
          Check integrations
        </Button>
      </div>
      {error.digest && (
        <p className="mt-6 text-[10px] text-muted-foreground/50 font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
