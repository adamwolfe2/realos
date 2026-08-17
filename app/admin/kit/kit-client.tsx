"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fillSnippet,
  kitUrl,
  type KitSection,
} from "@/lib/sales-kit/kit";

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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label
            htmlFor="kit-first-name"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Prospect first name (optional)
          </label>
          <Input
            id="kit-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Dana"
          />
        </div>
        <p className="pb-2 text-xs text-muted-foreground">
          Fills every &ldquo;Copy message&rdquo; below. Links are tagged{" "}
          <code className="rounded bg-muted px-1">?ref={repRef}</code>.
        </p>
      </div>

      <AuditRunner siteUrl={siteUrl} />

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.blurb}</p>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {section.links.map((link) => {
              const url = kitUrl(link.href, siteUrl, repRef);
              return (
                <div
                  key={link.href}
                  className="flex flex-wrap items-start justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{link.label}</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Open ${link.label} in a new tab`}
                      >
                        <ExternalLink className="size-3.5" strokeWidth={1.5} />
                      </a>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {link.whenToSend}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <CopyButton value={url} label="Copy link" />
                    {link.snippet ? (
                      <CopyButton
                        value={fillSnippet(link.snippet, url, firstName)}
                        label="Copy message"
                        variant="secondary"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {calUrl ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Direct calendar</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-0">
              <p className="font-medium">Your Cal.com link</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {calUrl}
              </p>
            </div>
            <CopyButton value={calUrl} label="Copy link" />
          </div>
        </section>
      ) : null}
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
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Run an audit for a prospect</h2>
        <p className="text-sm text-muted-foreground">
          Skip the form. Paste their site, get a report link you can send. The
          scan takes a couple of minutes — the link works immediately and fills
          in as it finishes.
        </p>
      </div>
      <form onSubmit={run} className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label
              htmlFor="kit-audit-url"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Property website
            </label>
            <Input
              id="kit-audit-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="theparkatwestend.com"
            />
          </div>
          <div className="w-48">
            <label
              htmlFor="kit-audit-brand"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Property name (optional)
            </label>
            <Input
              id="kit-audit-brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="The Park at West End"
            />
          </div>
          <Button type="submit" disabled={state.kind === "running"}>
            {state.kind === "running" ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Zap className="size-4" strokeWidth={1.5} />
            )}
            Run audit
          </Button>
        </div>

        {state.kind === "error" ? (
          <p className="mt-3 text-sm text-destructive">{state.message}</p>
        ) : null}

        {state.kind === "done" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[2px] border bg-muted/40 p-3">
            <span className="min-w-0 flex-1 truncate font-mono text-sm">
              {state.reportUrl}
            </span>
            {state.cached ? (
              <span className="text-xs text-muted-foreground">
                Recent scan reused
              </span>
            ) : null}
            <CopyButton value={state.reportUrl} label="Copy link" />
            <a
              href={state.reportUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline underline-offset-4"
            >
              Open
            </a>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function CopyButton({
  value,
  label,
  variant = "outline",
}: {
  value: string;
  label: string;
  variant?: "outline" | "secondary";
}) {
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
      variant={variant}
      size="sm"
      onClick={copy}
      aria-label={label}
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={1.5} />
      ) : (
        <Copy className="size-3.5" strokeWidth={1.5} />
      )}
      <span className={cn(copied && "tabular-nums")}>
        {copied ? "Copied" : label}
      </span>
    </Button>
  );
}
