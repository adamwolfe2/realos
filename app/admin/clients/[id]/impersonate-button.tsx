"use client";

import { useState, useTransition } from "react";

export function ImpersonateButton({ orgId }: { orgId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/impersonate/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        // Hard navigation forces Clerk to refresh the session JWT so the
        // newly-set publicMetadata.impersonateOrgId claim is in scope. With
        // a soft router.push the existing JWT lacks the claim and getScope()
        // bounces the agency user back to /admin.
        window.location.href = "/portal";
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impersonation failed"
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold tracking-wide rounded disabled:opacity-40"
      >
        {pending ? "Switching…" : "Impersonate"}
      </button>
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
