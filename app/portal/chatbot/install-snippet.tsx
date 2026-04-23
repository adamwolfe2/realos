"use client";

import { useState } from "react";

export function InstallSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
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
    <section className="rounded-lg border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold">Install snippet</h2>
      <p className="text-xs opacity-70">
        Paste this before the closing <code>&lt;/head&gt;</code> tag on your
        site. Works on Wix, WordPress, Webflow, custom sites — anywhere you
        can add a script.
      </p>
      <div className="relative">
        <pre className="border rounded bg-muted/40 px-3 py-3 pr-24 text-xs font-mono overflow-x-auto">
          <code>{snippet}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute top-2 right-2 bg-primary text-primary-foreground hover:bg-primary-dark transition-colors text-[11px] font-semibold px-2.5 py-1 rounded"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {copyFailed && (
        <p className="text-[11px] text-destructive">
          Copy failed — select the snippet manually and copy with Ctrl+C / Cmd+C.
        </p>
      )}
      <p className="text-[11px] opacity-60">
        The widget reads live config from the server, so changes above
        propagate without re-installing.
      </p>
    </section>
  );
}
