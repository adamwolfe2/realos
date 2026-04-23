"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function LeadDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { surface: "portal/leads/detail" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold tracking-tight mb-2">
        Could not load lead
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        An error occurred loading this lead record. It may have been deleted or
        there was a temporary issue.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/portal/leads">All leads</Link>
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
