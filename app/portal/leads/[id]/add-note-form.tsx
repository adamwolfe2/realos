"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tenant/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!res.ok) {
        const rb = await res.json().catch(() => ({}));
        setError(rb.error ?? "Failed to add note");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Log a call, email, or context about this lead."
        className={cn(
          "w-full resize-none rounded-[10px] bg-card px-3 py-2 text-sm",
          "text-foreground placeholder:text-muted-foreground",
          "ring-1 ring-border",
          "focus:outline-none focus:ring-primary",
          "transition-colors duration-200"
        )}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className={cn(
            "rounded-[10px] bg-primary px-3 py-1.5 text-xs font-medium",
            "text-background",
            "transition-colors duration-200",
            "hover:bg-[hsl(var(--primary)/0.9)]",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {pending ? "Saving\u2026" : "Add note"}
        </button>
        {error ? (
          <p className="text-xs text-[var(--error)]">{error}</p>
        ) : null}
      </div>
    </form>
  );
}
