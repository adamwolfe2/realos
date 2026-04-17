"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="bg-foreground text-background px-3 py-2 text-xs font-semibold rounded disabled:opacity-40"
        >
          {pending ? "Saving…" : "Add note"}
        </button>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
      </div>
    </form>
  );
}
