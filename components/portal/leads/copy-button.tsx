"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// Small icon button for copying a string to the clipboard. Shows a check for
// 1.6s after success so the user gets an unmistakable confirmation.
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string | null | undefined;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can fail in restricted contexts — swallow silently
      // since this is a convenience button, not a critical path.
    }
  }

  const disabled = !value;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleCopy}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[10px]",
        "bg-card ring-1 ring-border",
        "text-foreground",
        "transition-colors duration-200",
        "hover:bg-muted hover:text-foreground",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
    >
      {copied ? (
        <Check className="h-4 w-4 text-[var(--success)]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}
