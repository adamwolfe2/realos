"use client";

import { useState, useTransition } from "react";

export function BillingPortalButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/tenant/billing", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not open Stripe portal");
        return;
      }
      if (body?.url && typeof body.url === "string") {
        window.location.href = body.url;
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
      >
        {pending ? "Opening…" : "Open Stripe portal"}
      </button>
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
