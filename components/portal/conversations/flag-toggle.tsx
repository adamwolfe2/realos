"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  FLAG_LABEL,
  FLAG_TONE,
  FLAG_TYPES,
  type FlagType,
} from "./flag-pill";

// ---------------------------------------------------------------------------
// FlagToggle
//
// Button group in the conversation sidebar. Each flag type toggles on/off
// with optimistic UI. A per-button pending state blocks double-clicks while
// the server round-trip is in flight. Errors roll the row back.
//
// Data model: multiple flags of the same type are allowed per conversation
// in the schema, but from the operator surface we treat it as a set. The
// DELETE endpoint removes ALL rows of the given flag type for the conversation.
// ---------------------------------------------------------------------------

type FlagRow = {
  id: string;
  flag: string;
  note: string | null;
  createdAt: string;
};

export function FlagToggle({
  conversationId,
  initialFlags,
  onChange,
}: {
  conversationId: string;
  initialFlags: FlagRow[];
  onChange?: (next: FlagRow[]) => void;
}) {
  const [flags, setFlags] = React.useState<FlagRow[]>(initialFlags);
  const [pending, setPending] = React.useState<Set<FlagType>>(() => new Set());
  const [error, setError] = React.useState<string | null>(null);

  // Derived set of currently-active flag types for O(1) membership checks.
  const activeSet = React.useMemo(() => {
    const s = new Set<FlagType>();
    for (const f of flags) {
      if ((FLAG_TYPES as readonly string[]).includes(f.flag)) {
        s.add(f.flag as FlagType);
      }
    }
    return s;
  }, [flags]);

  async function applyChange(
    flag: FlagType,
    nextActive: boolean,
    snapshot: FlagRow[],
  ) {
    setError(null);
    setPending((prev) => {
      const next = new Set(prev);
      next.add(flag);
      return next;
    });
    try {
      const res = await fetch(
        `/api/portal/conversations/${conversationId}/flags`,
        {
          method: nextActive ? "POST" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ flag }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Request failed");
      }
      const data = (await res.json()) as { flags: FlagRow[] };
      setFlags(data.flags);
      onChange?.(data.flags);
    } catch (err) {
      // Roll back optimistic UI.
      setFlags(snapshot);
      onChange?.(snapshot);
      setError(err instanceof Error ? err.message : "Failed to update flag");
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(flag);
        return next;
      });
    }
  }

  function onToggle(flag: FlagType) {
    const currentlyActive = activeSet.has(flag);
    const snapshot = flags;
    // Optimistic update: add placeholder row or remove matching rows.
    if (currentlyActive) {
      setFlags((prev) => prev.filter((f) => f.flag !== flag));
    } else {
      setFlags((prev) => [
        ...prev,
        {
          id: `optimistic-${flag}-${Date.now()}`,
          flag,
          note: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    void applyChange(flag, !currentlyActive, snapshot);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-1.5">
        {FLAG_TYPES.map((flag) => {
          const active = activeSet.has(flag);
          const isPending = pending.has(flag);
          const tone = FLAG_TONE[flag];
          return (
            <button
              key={flag}
              type="button"
              onClick={() => onToggle(flag)}
              disabled={isPending}
              aria-pressed={active}
              className={cn(
                "group w-full inline-flex items-center justify-between gap-2 rounded-[6px] px-2.5 py-1.5",
                "text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors",
                "ring-1 ring-inset",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]",
                active
                  ? cn(tone.bg, tone.text, tone.ring)
                  : "bg-[var(--ivory)] text-[var(--olive-gray)] ring-[var(--border-cream)] hover:bg-[var(--warm-sand)]",
                isPending && "opacity-60 cursor-wait",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    active ? tone.dot : "bg-[var(--border-cream)]",
                  )}
                />
                {FLAG_LABEL[flag]}
              </span>
              <span className="text-[10px] opacity-70">
                {active ? "On" : "Off"}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="text-[11px] text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
