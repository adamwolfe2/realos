"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// AppFolio-backed; lease + property fetches can throw if the integration
// row is in a half-configured state. This boundary keeps the rest of the
// portal usable while the operator fixes the integration.
export default function RenewalsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { surface: "portal/renewals" },
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
        We couldn&apos;t load your renewals. If AppFolio just synced this
        sometimes resolves with a refresh — if it persists, check your
        AppFolio integration in Settings.
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
