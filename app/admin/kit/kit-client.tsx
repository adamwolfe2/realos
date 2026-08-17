"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fillSnippet, kitUrl, type KitSection } from "@/lib/sales-kit/kit";

type KitClientProps = {
  sections: readonly KitSection[];
  siteUrl: string;
  /** Rep slug appended to every link as `?ref=`. Not named `ref` — React
   *  treats that prop name specially on components. */
  repRef: string;
  calUrl: string | null;
};

export function KitClient({
  sections,
  siteUrl,
  repRef,
  calUrl,
}: KitClientProps) {
  // Personalizes every snippet at once — the rep types the prospect's first
  // name once per outreach session instead of editing each paste.
  const [firstName, setFirstName] = useState("");

  return (
    <div className="space-y-6">
      <AuditRunner siteUrl={siteUrl} />

      <div className="ls-card">
        {/* Toolbar: personalization + attribution, one dense row. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--hair)] px-5 py-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="kit-first-name"
              className="ls-eyebrow whitespace-nowrap"
            >
              Prospect
            </label>
            <Input
              id="kit-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="h-8 w-40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Personalizes every message. Links tagged{" "}
            <span className="font-mono text-[11px]">?ref={repRef}</span>.
          </p>
          {calUrl ? (
            <div className="ml-auto">
              <CopyButton value={calUrl} label="Copy your Cal link" />
            </div>
          ) : null}
        </div>

        {sections.map((section) => (
          <div key={section.title}>
            <div className="border-b border-[var(--hair)] bg-[var(--color-surface,#F9FAFB)] px-5 py-2">
              <span className="ls-eyebrow">{section.title}</span>
            </div>
            <ul className="divide-y divide-[var(--hair)]">
              {section.links.map((link) => {
                const url = kitUrl(link.href, siteUrl, repRef);
                return (
                  <li
                    key={link.href}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors hover:bg-[var(--brand-wash,rgba(37,99,235,0.04))]"
                  >
                    <div className="min-w-0 flex-1">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
                      >
                        {link.label}
                        <ExternalLink
                          className="size-3 opacity-0 transition-opacity group-hover:opacity-60"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </a>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {link.whenToSend}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <CopyButton value={url} label="Link" />
                      {link.snippet ? (
                        <CopyButton
                          value={fillSnippet(link.snippet, url, firstName)}
                          label="Message"
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Run an audit on a prospect's behalf. Same public endpoint the marketing
 * form posts to, so the resulting report is identical — the rep just skips
 * making the prospect fill anything in.
 *
 * ponytail: the endpoint rate-limits 5/hr per IP, which is a real ceiling on
 * a batch outreach day. Raise the limit for authenticated admins if a rep
 * actually hits it.
 */
function AuditRunner({ siteUrl }: { siteUrl: string }) {
  const [url, setUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "done"; reportUrl: string; cached: boolean }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || state.kind === "running") return;
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          ...(brandName.trim() ? { brandName: brandName.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.shareToken) {
        throw new Error(data?.error ?? `Audit failed (${res.status})`);
      }
      setState({
        kind: "done",
        reportUrl: new URL(`/audit/${data.shareToken}`, siteUrl).toString(),
        cached: Boolean(data.cached),
      });
    } catch (error) {
      console.error("Audit start failed:", error);
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not start the audit. Try again.",
      });
    }
  }

  return (
    <form onSubmit={run} className="ls-card ls-card-accent p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="kit-audit-url" className="ls-eyebrow mb-1.5 block">
            Run an audit for a prospect
          </label>
          <Input
            id="kit-audit-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="theparkatwestend.com"
            className="h-10"
          />
        </div>
        <div className="w-52">
          <label htmlFor="kit-audit-brand" className="ls-eyebrow mb-1.5 block">
            Property name
          </label>
          <Input
            id="kit-audit-brand"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Optional"
            className="h-10"
          />
        </div>
        <Button type="submit" size="lg" disabled={state.kind === "running"}>
          {state.kind === "running" ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Zap className="size-4" strokeWidth={1.5} />
          )}
          {state.kind === "running" ? "Starting" : "Run audit"}
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Skips the form entirely. The link works immediately and fills in as the
        scan finishes, usually two minutes.
      </p>

      {state.kind === "error" ? (
        <p className="mt-3 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      {state.kind === "done" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--hair)] pt-3">
          <span className="min-w-0 flex-1 truncate font-mono text-xs">
            {state.reportUrl}
          </span>
          {state.cached ? (
            <span className="ls-pill ls-pill-neutral">Recent scan reused</span>
          ) : null}
          <CopyButton value={state.reportUrl} label="Report link" />
          <a
            href={state.reportUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Open
          </a>
        </div>
      ) : null}
    </form>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("Clipboard write failed:", error);
      // Older/locked-down browsers deny clipboard access — show the text so
      // the rep can select it manually instead of failing silently.
      window.prompt("Copy this:", value);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()}`}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        copied && "text-[var(--color-success,#24a148)]",
      )}
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={1.5} />
      ) : (
        <Copy className="size-3.5" strokeWidth={1.5} />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
