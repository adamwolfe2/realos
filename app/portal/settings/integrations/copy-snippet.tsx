"use client";

import { useState } from "react";

export function CopySnippetButton({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors; user can still copy manually
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-1.5 text-xs font-semibold rounded"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
