"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Shared route error boundary. Used by every app/portal/<route>/error.tsx
// and app/admin/<route>/error.tsx so error UI is consistent + reportable.
//
// Captures the error to Sentry (with a `surface` tag so we can filter by
// route in the dashboard), shows a calm fallback, and gives the operator
// two clear recovery paths: Try again (re-mounts the segment via Next's
// `reset` prop) or go back to the section dashboard.
// ---------------------------------------------------------------------------

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  /** e.g. "portal/leads", "admin/clients". Surfaces as a Sentry tag. */
  surface: string;
  /** Override the "back to dashboard" link target. Defaults: /portal or /admin. */
  homeHref?: string;
  title?: string;
  body?: string;
};

export function RouteErrorBoundary({
  error,
  reset,
  surface,
  homeHref,
  title = "Something went wrong",
  body = "An unexpected error occurred loading this page. Try refreshing — if it persists, contact your account manager.",
}: Props) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { surface },
      extra: { digest: error.digest },
    });
  }, [error, surface]);

  const fallbackHome =
    homeHref ?? (surface.startsWith("admin") ? "/admin" : "/portal");

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" aria-hidden="true" />
      <h2 className="text-xl font-semibold tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{body}</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = fallbackHome;
          }}
        >
          Back to dashboard
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-[10px] text-muted-foreground/50 font-mono">
          Error ID: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
