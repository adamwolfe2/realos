"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ShoppingBag } from "lucide-react";

export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/portal/marketplace] error:", error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto mt-16 rounded-xl border border-border bg-card p-8 text-center space-y-3">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 text-primary mx-auto">
        <ShoppingBag className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-foreground">
        Couldn&apos;t load the marketplace.
      </h2>
      <p className="text-sm text-muted-foreground">
        Module activation status is briefly unavailable. Try again — your
        active modules are unaffected.
      </p>
      {error.digest ? (
        <p className="text-[10px] font-mono text-muted-foreground">
          ref: {error.digest}
        </p>
      ) : null}
      <div className="flex items-center justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 h-9 text-xs font-semibold hover:bg-primary-dark transition-colors"
        >
          Try again
        </button>
        <Link
          href="/portal"
          className="inline-flex items-center rounded-md border border-border bg-card px-4 h-9 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
