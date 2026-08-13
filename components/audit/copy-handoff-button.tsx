"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// CopyHandoffButton — "Copy instructions for your web person"
// (2026-08-14). Copies the plain-English brief (+ finished code snippet
// when generated) so the PM forwards a done task, not advice.

export function CopyHandoffButton({
  instructions,
  snippet,
}: {
  instructions: string;
  snippet?: string;
}) {
  const [copied, setCopied] = useState(false);
  const payload = snippet ? `${instructions}\n\n${snippet}` : instructions;
  return (
    <button
      type="button"
      onClick={() => {
        // navigator.clipboard is undefined in non-secure contexts and
        // old webviews — the member access itself would throw before
        // any promise exists, so guard synchronously.
        if (!navigator.clipboard?.writeText) return;
        void navigator.clipboard
          .writeText(payload)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => undefined);
      }}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium"
      style={{ color: copied ? "#0e6027" : "#6B7280" }}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden /> Copy instructions for
          your web person
        </>
      )}
    </button>
  );
}
