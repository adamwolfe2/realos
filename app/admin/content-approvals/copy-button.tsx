"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  value: string;
  label?: string;
  className?: string;
};

/**
 * Small clipboard helper used in the Approvals detail tabs. Flips to a
 * checkmark for 1.5s on success. Falls back silently if the Clipboard API
 * isn't available — the textarea is already selectable next to it.
 */
export function CopyButton({ value, label = "Copy", className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // ignore — user can still select + copy manually
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors " +
        className
      }
      aria-label={label}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  );
}
