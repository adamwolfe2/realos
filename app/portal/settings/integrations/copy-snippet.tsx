"use client";

import { useState } from "react";

export function CopySnippetButton({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onCopy}
        className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-1.5 text-xs font-semibold rounded"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      {copyFailed && (
        <p className="text-[11px] text-destructive">
          Copy failed — select and copy manually.
        </p>
      )}
    </div>
  );
}
