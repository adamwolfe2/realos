"use client";

import { useEffect } from "react";
import { BRAND_EMAIL } from "@/lib/brand";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      console.error("[marketing]", error.digest ?? error.message);
    }
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-body)",
      }}
    >
      <p
        className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Something went wrong
      </p>
      <h1
        className="font-serif text-3xl sm:text-4xl mb-3 text-center"
        style={{ color: "var(--text-headline)" }}
      >
        We hit an unexpected error.
      </h1>
      <p
        className="font-mono text-sm mb-8 max-w-md text-center leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        This page failed to load. Try refreshing. If it persists, email{" "}
        <a
          href={`mailto:${BRAND_EMAIL}`}
          className="underline underline-offset-2"
        >
          {BRAND_EMAIL}
        </a>
        .
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="font-mono text-xs font-semibold px-5 py-3 rounded"
          style={{
            border: "1px solid var(--border-strong)",
            color: "var(--text-headline)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Try again
        </button>
        <a
          href="/"
          className="font-mono text-xs font-semibold px-5 py-3 rounded"
          style={{
            backgroundColor: "var(--blue)",
            color: "white",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Back to home
        </a>
      </div>
      {error.digest ? (
        <p
          className="mt-8 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Error ID: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
