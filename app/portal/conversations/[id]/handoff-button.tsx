"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function HandoffButton({
  conversationId,
  disabled,
}: {
  conversationId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/tenant/conversations/${conversationId}/handoff`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Handoff failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        title="Marks the conversation as Handed off. Notifies the property team via portal inbox + email so a teammate can pick it up. Also lands a note on the lead record for the audit trail."
        className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
      >
        {pending ? "Handing off…" : "Hand off to team"}
      </button>
      <p className="text-[11px] text-muted-foreground max-w-[220px] text-right leading-snug">
        Notifies the team via portal inbox + email. A note lands on the lead.
      </p>
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
