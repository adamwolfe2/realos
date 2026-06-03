"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
// build-fix (audit 2026-06-02): `createDraft` is defined in actions.ts so
// it stays imported from there; `searchProspects` + the
// `ProspectSuggestion` type come straight from the source file because
// Next 16 + Turbopack doesn't allow `type` or re-export passthroughs in
// a `"use server"` file. See `app/admin/proposals/actions.ts` block
// comment for full rationale.
import { createDraft } from "../actions";
import {
  searchProspects,
  type ProspectSuggestion,
} from "../_actions/prospect-search";

// ---------------------------------------------------------------------------
// Prospect picker for /admin/proposals/new.
//
// Search input → debounced server action → suggestion list. Clicking a row
// (or hitting "Start blank") fires `createDraft` and redirects to
// /admin/proposals/[id]?edit=1.
// ---------------------------------------------------------------------------

export function ProspectPicker() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProspectSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const out = await searchProspects({ q: trimmed });
        if (!cancelled) setResults(out);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  function pick(s: ProspectSuggestion) {
    startTransition(async () => {
      const { proposalId } = await createDraft({
        prospect: {
          name: s.name || s.email || "Untitled prospect",
          email: s.email || "",
          company: s.company,
          intakeId: s.intakeId,
          orgId: s.orgId,
        },
      });
      router.push(`/admin/proposals/${proposalId}?edit=1`);
    });
  }

  function startBlank() {
    startTransition(async () => {
      const { proposalId } = await createDraft({
        prospect: {
          name: "Untitled prospect",
          email: "",
        },
      });
      router.push(`/admin/proposals/${proposalId}?edit=1`);
    });
  }

  return (
    <div className="space-y-4">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search email, name, company"
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {q.trim().length >= 2 ? (
        <div className="rounded-md border border-border bg-card">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              No matches. Start blank below if this is a fresh prospect.
            </div>
          ) : (
            <ul>
              {results.map((s) => (
                <li
                  key={`${s.source}-${s.id}`}
                  className="border-b border-border last:border-b-0"
                >
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => pick(s)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {s.name}
                          {s.company ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {s.company}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.email || "(no email)"}
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                        {s.source}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          Don't see them? Start blank and fill in the prospect details.
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={startBlank}
          className="inline-flex items-center rounded-md bg-card border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-60"
        >
          Start from blank
        </button>
      </div>
    </div>
  );
}
