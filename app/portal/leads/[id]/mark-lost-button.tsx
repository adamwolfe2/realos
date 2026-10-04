"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MarkLostButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tenant/leads/${leadId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "LOST" }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Failed to update");
        } else {
          toast.success("Status updated");
          router.refresh();
        }
      } catch (err) {
        console.error("[lead-mark-lost] update failed", err);
        setError("Network error. Try again.");
      }
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={cn(
          "w-full text-left rounded-[2px] px-3 py-2 text-xs font-medium",
          "text-[var(--error)] bg-card ring-1 ring-border",
          "hover:bg-[var(--error)]/8 transition-colors",
          pending && "opacity-60 cursor-not-allowed"
        )}
      >
        {pending ? "Marking as lost…" : "Mark as lost"}
      </button>
      {error ? <p className="text-[11px] text-[var(--error)]">{error}</p> : null}
    </div>
  );
}
