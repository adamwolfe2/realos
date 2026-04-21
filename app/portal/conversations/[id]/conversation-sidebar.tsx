"use client";

import * as React from "react";
import Link from "next/link";
import { FlagToggle } from "@/components/portal/conversations/flag-toggle";
import { humanLeadStatus, humanVisitorStatus } from "@/lib/format";
import type { LeadStatus, VisitorIdentificationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// ConversationSidebar
//
// Right-rail review panel for a single conversation. Three stacked cards:
//   1. Flag toggles (6 buttons, optimistic API writes)
//   2. Notes field (attached to the most recent flag row, or standalone)
//   3. Context links (lead, visitor, tune prompt)
// Everything lives in one client component so the notes textarea can share
// state with the flag list after mutations.
// ---------------------------------------------------------------------------

type FlagRow = {
  id: string;
  flag: string;
  note: string | null;
  createdAt: string;
};

export function ConversationSidebar({
  conversationId,
  initialFlags,
  lead,
  visitor,
}: {
  conversationId: string;
  initialFlags: FlagRow[];
  lead: { id: string; status: LeadStatus } | null;
  visitor: {
    id: string;
    displayName: string;
    status: VisitorIdentificationStatus;
  } | null;
}) {
  const [flags, setFlags] = React.useState<FlagRow[]>(initialFlags);

  // "Most recent flag" drives the note input: any new typed note attaches to
  // that row. If there are no flags yet, the operator can still save a note
  // by flagging anything first, or we fall back to a standalone note row.
  const mostRecent = flags[0] ?? null;
  const [noteDraft, setNoteDraft] = React.useState<string>(
    mostRecent?.note ?? "",
  );
  const [savingNote, setSavingNote] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [noteError, setNoteError] = React.useState<string | null>(null);

  // Keep the draft in sync when the flag set changes (e.g. after toggling).
  React.useEffect(() => {
    setNoteDraft(mostRecent?.note ?? "");
    setNoteError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostRecent?.id]);

  async function saveNote() {
    if (savingNote) return;
    setNoteError(null);
    setSavingNote(true);
    try {
      // Strategy: attach the note to the most-recent flag by re-posting that
      // flag type with the note body. The POST endpoint appends a new row
      // and returns the full list. If no flag exists yet, we add a neutral
      // `followup_needed` marker so the note has a home. The operator can
      // remove it afterwards.
      const targetFlag = mostRecent?.flag ?? "followup_needed";
      const res = await fetch(
        `/api/portal/conversations/${conversationId}/flags`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ flag: targetFlag, note: noteDraft }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to save note");
      }
      const data = (await res.json()) as { flags: FlagRow[] };
      setFlags(data.flags);
      setSavedAt(Date.now());
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {/* Flag toggles */}
      <section className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-4">
        <header className="mb-3">
          <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
            Review
          </div>
          <h2 className="text-sm font-semibold text-[var(--near-black)]">
            Flags
          </h2>
          <p className="text-[11px] text-[var(--olive-gray)] mt-0.5">
            Click to toggle. Patterns surface on the list view.
          </p>
        </header>
        <FlagToggle
          conversationId={conversationId}
          initialFlags={flags}
          onChange={setFlags}
        />
      </section>

      {/* Notes */}
      <section className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-4">
        <header className="mb-2">
          <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
            Notes
          </div>
          <h2 className="text-sm font-semibold text-[var(--near-black)]">
            Reviewer note
          </h2>
          <p className="text-[11px] text-[var(--olive-gray)] mt-0.5">
            Attaches to the most recent flag, or logs standalone.
          </p>
        </header>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={4}
          placeholder="What pattern did you see? What should the prompt address?"
          className="w-full rounded-[6px] border border-[var(--border-cream)] bg-[var(--ivory)] px-2.5 py-2 text-sm text-[var(--near-black)] placeholder:text-[var(--stone-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-blue)]"
          maxLength={2000}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={saveNote}
            disabled={savingNote || noteDraft.trim().length === 0}
            className="inline-flex items-center justify-center rounded-[6px] px-3 py-1.5 text-xs font-semibold bg-[var(--near-black)] text-[var(--ivory)] hover:bg-[var(--olive-gray)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingNote ? "Saving..." : "Save note"}
          </button>
          {savedAt ? (
            <span className="text-[11px] text-emerald-700">Saved</span>
          ) : null}
          {noteError ? (
            <span className="text-[11px] text-rose-700">{noteError}</span>
          ) : null}
        </div>
        {/* Prior notes */}
        {flags.some((f) => f.note && f.note.trim().length > 0) ? (
          <div className="mt-3 pt-3 border-t border-[var(--border-cream)] space-y-2">
            <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
              History
            </div>
            {flags
              .filter((f) => f.note && f.note.trim().length > 0)
              .slice(0, 5)
              .map((f) => (
                <div
                  key={f.id}
                  className="text-[11px] text-[var(--olive-gray)]"
                >
                  <span className="uppercase tracking-widest text-[var(--stone-gray)] text-[10px]">
                    {f.flag.replaceAll("_", " ")}
                  </span>
                  <p className="mt-0.5 text-[var(--near-black)] whitespace-pre-wrap">
                    {f.note}
                  </p>
                </div>
              ))}
          </div>
        ) : null}
      </section>

      {/* Context */}
      <section className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-4">
        <header className="mb-3">
          <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
            Context
          </div>
          <h2 className="text-sm font-semibold text-[var(--near-black)]">
            Linked records
          </h2>
        </header>
        <ul className="space-y-2 text-xs">
          {lead ? (
            <li>
              <Link
                href={`/portal/leads/${lead.id}`}
                className="flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 bg-[var(--warm-sand)] hover:bg-[var(--border-cream)] transition-colors"
              >
                <span className="text-[var(--olive-gray)]">Lead</span>
                <span className="font-semibold text-[var(--near-black)]">
                  {humanLeadStatus(lead.status)}
                </span>
              </Link>
            </li>
          ) : (
            <li className="flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 bg-[var(--warm-sand)]/50">
              <span className="text-[var(--olive-gray)]">Lead</span>
              <span className="text-[var(--stone-gray)]">Not captured</span>
            </li>
          )}
          {visitor ? (
            <li>
              <Link
                href={`/portal/visitors/${visitor.id}`}
                className="flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 bg-[var(--warm-sand)] hover:bg-[var(--border-cream)] transition-colors"
              >
                <span className="text-[var(--olive-gray)]">Visitor</span>
                <span className="font-semibold text-[var(--near-black)] truncate max-w-[160px]">
                  {humanVisitorStatus(visitor.status)}
                </span>
              </Link>
            </li>
          ) : (
            <li className="flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 bg-[var(--warm-sand)]/50">
              <span className="text-[var(--olive-gray)]">Visitor</span>
              <span className="text-[var(--stone-gray)]">No match</span>
            </li>
          )}
          <li>
            <Link
              href="/portal/chatbot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 bg-[var(--near-black)] text-[var(--ivory)] hover:bg-[var(--olive-gray)] transition-colors"
            >
              <span className="text-[11px] uppercase tracking-widest">
                Tune chatbot prompt
              </span>
              <span aria-hidden="true">{"\u2197"}</span>
            </Link>
          </li>
        </ul>
      </section>
    </aside>
  );
}
