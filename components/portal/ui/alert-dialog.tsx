"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// AlertDialog — the single confirm primitive for destructive / consequential
// actions. Replaces scattered window.confirm() calls: native confirms are
// unstyled, silently suppressible by the browser, and read as broken next
// to the rest of the portal chrome.
//
// Controlled: the parent owns `open`. Escape, backdrop click, and Cancel all
// call onCancel. onConfirm is a plain callback — run your transition there
// and pass `pending` back down to disable the confirm button.
// ---------------------------------------------------------------------------

export function AlertDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get a red confirm button. */
  destructive?: boolean;
  /** Disables the confirm button while the action runs. */
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-lg">
        <header className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {body ? (
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {body}
            </div>
          ) : null}
        </header>
        <footer className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-foreground/40 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={cn(
              "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary-dark",
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
