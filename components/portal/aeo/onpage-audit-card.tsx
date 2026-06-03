"use client";

import * as React from "react";
import { Check, X, Sparkles, Play } from "lucide-react";
import { SectionCard } from "@/components/admin/page-header";

// AEO v2 W3: AEO Page Health card. Two states based on whether the org
// has the AEO Boost add-on:
//
// - Gated → teaser score (always 50, deliberately mid) + upgrade hook
// - Active → URL input + Run button + latest audit checklist + history
//
// The gated teaser is monochrome / un-actionable on purpose: operators
// without the add-on should see WHAT they'd get without seeing real data
// from their own site (which would defeat the gating).

export type OnPageAuditCheck = {
  key: string;
  label: string;
  pass: boolean;
  reason: string;
};

export type OnPageAuditHistoryRow = {
  id: string;
  url: string;
  score: number;
  capturedAt: string;
};

export type OnPageAuditProps = {
  hasAddon: boolean;
  defaultUrl: string | null;
  latest:
    | {
        url: string;
        score: number;
        checks: OnPageAuditCheck[];
        excerpt: string | null;
        capturedAt: string;
      }
    | null;
  history: OnPageAuditHistoryRow[];
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function ChecklistRow({ check }: { check: OnPageAuditCheck }) {
  return (
    <li className="flex items-start gap-2.5 py-2 border-b border-[var(--hair)] last:border-b-0">
      <div className="mt-0.5 shrink-0">
        {check.pass ? (
          <Check className="w-3.5 h-3.5 text-foreground" />
        ) : (
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-foreground">{check.label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {check.reason}
        </div>
      </div>
      <div className="text-[10px] tabular-nums text-muted-foreground uppercase tracking-wide">
        {check.pass ? "Pass" : "Fail"}
      </div>
    </li>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-foreground/30 bg-background">
      <span className="text-[14px] font-semibold tabular-nums text-foreground">
        {score}
      </span>
    </div>
  );
}

function GatedView() {
  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-[var(--hair)] bg-background">
          <Sparkles className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] text-foreground">
            Per-page AEO audits unlock with AEO Boost
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            8-check scorecard for FAQ schema, JSON-LD, canonical, content
            depth, Q&amp;A structure, and freshness. Run on any page.
          </div>
        </div>
      </div>
      <a
        href="/portal/billing"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
      >
        Upgrade — $199/mo
      </a>
    </div>
  );
}

function ActiveView({
  defaultUrl,
  latest,
  history,
}: {
  defaultUrl: string | null;
  latest: OnPageAuditProps["latest"];
  history: OnPageAuditHistoryRow[];
}) {
  const [url, setUrl] = React.useState(latest?.url ?? defaultUrl ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] =
    React.useState<OnPageAuditProps["latest"]>(latest);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/portal/seo/aeo/onpage-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            score?: number;
            checks?: OnPageAuditCheck[];
            excerpt?: string;
          }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Audit failed");
        return;
      }
      setResult({
        url,
        score: data.score ?? 0,
        checks: data.checks ?? [],
        excerpt: data.excerpt ?? null,
        capturedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onSubmit}
        className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end"
      >
        <label className="flex-1 space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Page URL to audit
          </span>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-property.com/about"
            className="w-full px-3 py-2 text-[13px] bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground/30"
          />
        </label>
        <button
          type="submit"
          disabled={pending || url.trim().length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-background bg-foreground hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          <Play className="w-3 h-3" />
          {pending ? "Auditing…" : "Run audit"}
        </button>
      </form>
      {error && (
        <div className="text-[12px] text-foreground bg-[var(--hair)] px-2.5 py-2 rounded">
          {error}
        </div>
      )}
      {result && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <ScoreRing score={result.score} />
            <div className="min-w-0 flex-1">
              <div
                className="text-[13px] text-foreground truncate"
                title={result.url}
              >
                {result.url}
              </div>
              {result.excerpt && (
                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {result.excerpt}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground/80 mt-1 uppercase tracking-wide">
                {formatDate(result.capturedAt)} ·{" "}
                {result.checks.filter((c) => c.pass).length} of{" "}
                {result.checks.length} checks passing
              </div>
            </div>
          </div>
          <ul>
            {result.checks.map((c) => (
              <ChecklistRow key={c.key} check={c} />
            ))}
          </ul>
        </div>
      )}
      {history.length > 0 && (
        <div className="pt-2 border-t border-[var(--hair)]">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            Recent audits
          </div>
          <ul className="space-y-1.5">
            {history.slice(0, 5).map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 text-[12px]"
              >
                <span
                  className="truncate text-foreground/85"
                  title={h.url}
                >
                  {h.url}
                </span>
                <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                  <span className="tabular-nums">{h.score}</span>
                  <span>{formatDate(h.capturedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function OnPageAuditCard({
  hasAddon,
  defaultUrl,
  latest,
  history,
}: OnPageAuditProps) {
  return (
    <SectionCard
      label="AEO Page Health"
      description={
        hasAddon
          ? "Audit any URL on your site for AI-citability signals: FAQ schema, Article JSON-LD, canonical, content depth, Q&A structure, freshness."
          : "Run AI-citability audits on any page. Included with the AEO Boost add-on."
      }
    >
      {hasAddon ? (
        <ActiveView
          defaultUrl={defaultUrl}
          latest={latest}
          history={history}
        />
      ) : (
        <GatedView />
      )}
    </SectionCard>
  );
}
