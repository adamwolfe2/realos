"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, Link as LinkIcon } from "lucide-react";

interface Props {
  /** Marketing URL of the tenant's site (typically the first
   *  marketable property's websiteUrl). NULL when the org hasn't
   *  configured one yet — buttons render disabled in that case. */
  siteUrl: string | null;
}

/**
 * Two-button row for live-site preview from inside the campaign editor.
 *
 *   "Preview on live site"  — opens siteUrl + ?lspopup=preview in a new
 *                             tab. The embed JS reads that query param
 *                             and bypasses every frequency cap, URL
 *                             filter, and trigger threshold so the
 *                             popup fires immediately on page load.
 *                             First-class verification path for "does
 *                             this look right on my real site?"
 *
 *   "Copy preview link"     — same URL but to the clipboard. Useful
 *                             for sending to non-technical stakeholders
 *                             ("click this link to see your popup
 *                             live") without forwarding the whole
 *                             campaign-editor URL or asking them to
 *                             open DevTools.
 *
 * The buttons render disabled with an inline hint when no website URL
 * is configured, since the embed can't be verified without one.
 */
export function PreviewLiveSite({ siteUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const previewUrl = (() => {
    if (!siteUrl) return null;
    try {
      const u = new URL(siteUrl);
      // Append ?lspopup=preview without clobbering any existing query
      // string the operator may have on the saved URL (some platforms
      // tack on tracking params).
      u.searchParams.set("lspopup", "preview");
      return u.toString();
    } catch {
      return null;
    }
  })();

  async function handleCopy() {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — fall back to a selectable prompt.
      window.prompt("Copy the preview link:", previewUrl);
    }
  }

  if (!previewUrl) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
        <LinkIcon className="h-3.5 w-3.5" />
        Set a Public Website URL on your property to enable live-site preview.
      </div>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background transition-opacity hover:opacity-90"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Preview on live site
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy preview link
          </>
        )}
      </button>
      <span className="text-[11px] text-muted-foreground">
        Opens your site with <code className="rounded bg-muted px-1 py-0.5 text-[10.5px]">?lspopup=preview</code> — bypasses all dedup so the popup fires immediately.
      </span>
    </div>
  );
}
