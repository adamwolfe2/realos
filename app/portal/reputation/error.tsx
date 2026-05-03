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
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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

      {/* Surface the actual error message for quick debugging. Wrap in
          <details> so it's collapsed by default for end-users but
          one-click expandable for support. */}
      {error.message ? (
        <details className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
          <summary className="cursor-pointer font-semibold">
            Diagnostic — share with engineering
          </summary>
          <div className="mt-2 space-y-2">
            <div>
              <span className="font-semibold">Error: </span>
              <code className="font-mono break-all">{error.message}</code>
            </div>
            {error.stack ? (
              <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] font-mono opacity-80 max-h-[200px] overflow-auto">
                {error.stack}
              </pre>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
