"use client";

import { useEffect } from "react";
import Link from "next/link";

// Error boundary for /portal/reputation. Catches anything that bubbles
// past the page-level try/catch (rare in async server components but
// possible for child Server Component throws). Renders a friendly
// fallback + the error.digest so we can grep Vercel logs.

export default function ReputationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[reputation] error.tsx caught:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Brand health
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Reputation
        </h1>
      </header>
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
        <p className="font-semibold">Reputation view temporarily unavailable.</p>
        <p className="mt-1 text-xs leading-snug">
          A render error escaped the page-level handler. The data may be
          partially seeded — refresh in a moment, or drill into reviews per
          property at{" "}
          <Link href="/portal/properties" className="underline font-medium">
            Properties
          </Link>{" "}
          → choose a property → Reputation tab.
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

      {/* Stack traces and error.message are intentionally NOT surfaced to
          the client — they leak internal file paths and route chunk
          structure. Engineers can grep Vercel logs by the digest above
          (we log message + stack from the useEffect at the top of this
          component). End-users see the friendly banner only. */}
    </div>
  );
}
