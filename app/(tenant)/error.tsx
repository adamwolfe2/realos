"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Tenant marketing site error boundary. Tenants are public-facing — we cannot
// let prospects see the Next.js default error page on telegraphcommons.com or
// any other client domain. Show a clean fallback and report to Sentry.
export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "tenant-marketing" } });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white text-slate-900">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">
        Something went wrong
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl mb-3 text-center text-slate-900">
        We hit an unexpected error.
      </h1>
      <p className="font-mono text-sm mb-8 max-w-md text-center leading-relaxed text-slate-600">
        This page failed to load. Try refreshing in a moment.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="font-mono text-xs font-semibold px-5 py-3 rounded border border-slate-300 text-slate-900 uppercase tracking-wider"
        >
          Try again
        </button>
        <a
          href="/"
          className="font-mono text-xs font-semibold px-5 py-3 rounded text-white uppercase tracking-wider"
          style={{ backgroundColor: "var(--tenant-primary, #111827)" }}
        >
          Back to home
        </a>
      </div>
      {error.digest ? (
        <p className="mt-8 text-[10px] font-mono text-slate-400">
          Error ID: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
