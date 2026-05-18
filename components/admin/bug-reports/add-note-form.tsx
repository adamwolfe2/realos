"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBugReportNote } from "@/lib/actions/bug-report-actions";

// ---------------------------------------------------------------------------
// AddNoteForm — small client island inside the otherwise-server bug
// report detail page. Lets agency users append free-text notes to the
// timeline (e.g. "tested in staging — looks good" or "couldn't repro").
// ---------------------------------------------------------------------------

export function AddNoteForm({ reportId }: { reportId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addBugReportNote(reportId, { text: trimmed });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex items-start gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Add a note — visible to anyone with admin access."
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className="shrink-0 inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
      >
        {pending ? "Adding…" : "Add note"}
      </button>
      {error ? (
        <p className="absolute mt-12 text-[11px] text-destructive">{error}</p>
      ) : null}
    </form>
  );
}
