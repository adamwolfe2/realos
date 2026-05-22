"use client";

import { useState } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  Link as LinkIcon,
  RefreshCw,
  HelpCircle,
} from "lucide-react";

interface Props {
  /** Marketing URL of the tenant's site (typically the first
   *  marketable property's websiteUrl). NULL when the org hasn't
   *  configured one yet — buttons render disabled in that case. */
  siteUrl: string | null;
  /** When true, the "Why isn't this firing?" help panel opens by
   *  default. Page passes true when the popup is ACTIVE but has 0
   *  recorded impressions after 24h — strong signal the operator
   *  is hitting the dedup cap / can't see it firing. */
  defaultShowHelp?: boolean;
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
export function PreviewLiveSite({
  siteUrl,
  defaultShowHelp = false,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(defaultShowHelp);

  // Build the three test URLs. All append a single ?lspopup=<mode>
  // — the embed script reads that param and behaves accordingly.
  // See public/embed/popup.js for the full mode reference.
  function withMode(mode: "preview" | "clear"): string | null {
    if (!siteUrl) return null;
    try {
      const u = new URL(siteUrl);
      u.searchParams.set("lspopup", mode);
      return u.toString();
    } catch {
      return null;
    }
  }
  const previewUrl = withMode("preview");
  const clearUrl = withMode("clear");

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
    <div className="space-y-2">
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
        {/* Norman May 22: "the pop-up on the Telegraph Commons website
            is not firing… It only shows up if there's a pop-up in the
            URL." Root cause is almost always the sessionStorage dedup
            flag from a previous visit. This second button opens the
            live site with ?lspopup=clear which wipes every dedup key
            (sessionStorage + localStorage) and then runs the normal
            trigger flow — so the operator sees the popup fire on the
            real threshold (e.g. 8s dwell) instead of forced-preview
            mode. Closes the gap between "preview works" and "live
            doesn't work" for nearly every reported case. */}
        <a
          href={clearUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Clear cap &amp; re-test on live
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
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {showHelp ? "Hide help" : "Why isn't this firing?"}
        </button>
      </div>

      {/* Plain-English explainer — Norman's exact reported case. Most
          operators don't realize their browser caches a "popup shown"
          flag the first time they see it, which then silences every
          subsequent normal visit. */}
      {showHelp ? (
        <div className="rounded-md border border-primary/20 bg-primary/[0.04] p-3 text-[12px] text-foreground leading-relaxed space-y-2">
          <p>
            <strong>Most common cause:</strong> your browser already saw
            this popup once and stored a &ldquo;shown&rdquo; flag in
            sessionStorage. Every subsequent visit in the same tab is
            silently skipped (working as designed — visitors shouldn&apos;t
            see the same popup over and over).
          </p>
          <p className="text-muted-foreground">
            Three ways to re-test on the live site:
          </p>
          <ol className="list-decimal pl-5 text-muted-foreground space-y-1">
            <li>
              Click <strong className="text-foreground">Clear cap &amp; re-test on live</strong> above — wipes the
              dedup keys and runs the normal trigger flow.
            </li>
            <li>
              Open the site in an{" "}
              <strong className="text-foreground">Incognito / Private window</strong> — fresh storage, popup
              fires naturally.
            </li>
            <li>
              Open DevTools → Console — every block reason is logged with{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10.5px]">
                [leasestack-popup]
              </code>
              {" "}
              prefix (URL mismatch, frequency cap, trigger waiting, etc.).
            </li>
          </ol>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Preview mode</strong>{" "}
            (top button) always fires regardless of caps — useful for
            verifying the design but doesn&apos;t test the real trigger.
            Use <strong className="text-foreground">Clear cap &amp; re-test</strong>{" "}
            to confirm the live trigger actually fires.
          </p>
        </div>
      ) : null}
    </div>
  );
}
