"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { recordTriageVerdict, saveInspirationPrd } from "./actions";

// ---------------------------------------------------------------------------
// PromptRunner — surfaces the site-engine prompts inline so Adam can run
// them in his browser Claude session without copy-pasting from
// site-engine-kit. Two modes:
//
//   1. Triage: shows Prompt 00 + the intake JSON pre-formatted. Adam pastes
//      the resulting JSON back; we parse it, stamp an event, and offer to
//      transition status.
//
//   2. PRD: per-inspiration-URL Prompt 01 with copy-to-clipboard. Adam runs
//      it in Claude browser per URL, pastes each PRD JSON into the field
//      below the URL.
// ---------------------------------------------------------------------------

interface PromptRunnerProps {
  siteRequestId: string;
  intakePayload: unknown;
  inspirationUrls: string[];
  prompt00: string;
  prompt01: string;
}

export function PromptRunner({
  siteRequestId,
  intakePayload,
  inspirationUrls,
  prompt00,
  prompt01,
}: PromptRunnerProps) {
  const [tab, setTab] = React.useState<"triage" | "prd">("triage");

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab("triage")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "triage"
              ? "bg-card text-foreground border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Run triage (Prompt 00)
        </button>
        <button
          type="button"
          onClick={() => setTab("prd")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "prd"
              ? "bg-card text-foreground border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Extract PRDs (Prompt 01)
        </button>
      </div>

      <div className="p-5">
        {tab === "triage" ? (
          <TriagePanel
            siteRequestId={siteRequestId}
            intakePayload={intakePayload}
            prompt00={prompt00}
          />
        ) : (
          <PrdPanel
            siteRequestId={siteRequestId}
            inspirationUrls={inspirationUrls}
            prompt01={prompt01}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Triage panel
// ---------------------------------------------------------------------------

function TriagePanel({
  siteRequestId,
  intakePayload,
  prompt00,
}: {
  siteRequestId: string;
  intakePayload: unknown;
  prompt00: string;
}) {
  const router = useRouter();
  const promptWithInput = React.useMemo(
    () => `${prompt00}\n${JSON.stringify(intakePayload, null, 2)}`,
    [prompt00, intakePayload],
  );

  const [result, setResult] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [parsedVerdict, setParsedVerdict] = React.useState<{
    totalScore?: number;
    verdict?: "GO" | "NEEDS_INFO" | "DISQUALIFY";
    reasoningOneLine?: string;
    missingItems?: string[];
    redFlags?: string[];
    estimatedTier?: string;
  } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [transition, setTransition] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(promptWithInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const parse = () => {
    setError(null);
    if (!result.trim()) {
      setParsedVerdict(null);
      return;
    }
    try {
      const json = JSON.parse(extractJsonBlock(result));
      setParsedVerdict(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse JSON");
      setParsedVerdict(null);
    }
  };

  const onSave = async () => {
    if (!parsedVerdict) {
      setError("Parse the verdict JSON first.");
      return;
    }
    setSaving(true);
    try {
      await recordTriageVerdict(siteRequestId, parsedVerdict, { transition });
      setResult("");
      setParsedVerdict(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Step 1 · Copy the prompt</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Run this in your browser Claude session. It already includes the
          intake JSON for this request.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? "Copied!" : "Copy prompt + intake"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {promptWithInput.length.toLocaleString()} chars
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Step 2 · Paste the result</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Paste the JSON Claude returned. We&apos;ll parse it and stamp the
          decision on the timeline.
        </p>
        <textarea
          value={result}
          onChange={(e) => setResult(e.target.value)}
          onBlur={parse}
          rows={8}
          placeholder='{"totalScore": 24, "verdict": "GO", ...}'
          className="mt-2 w-full rounded-md border border-input bg-transparent p-3 text-sm font-mono shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      {parsedVerdict ? (
        <div className="rounded-md border border-border bg-background p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Parsed verdict
              </div>
              <div className="text-lg font-semibold mt-1">
                {parsedVerdict.verdict}{" "}
                {parsedVerdict.totalScore != null ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    · {parsedVerdict.totalScore}/30
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {parsedVerdict.reasoningOneLine ? (
            <p className="text-sm">{parsedVerdict.reasoningOneLine}</p>
          ) : null}
          {parsedVerdict.estimatedTier ? (
            <p className="text-xs text-muted-foreground">
              Estimated tier: {parsedVerdict.estimatedTier}
            </p>
          ) : null}
          {parsedVerdict.missingItems?.length ? (
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Missing
              </div>
              <ul className="mt-1 text-sm list-disc list-inside text-muted-foreground">
                {parsedVerdict.missingItems.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {parsedVerdict.redFlags?.length ? (
            <div>
              <div className="text-xs uppercase tracking-widest text-destructive font-semibold">
                Red flags
              </div>
              <ul className="mt-1 text-sm list-disc list-inside text-destructive">
                {parsedVerdict.redFlags.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={transition}
            onChange={(e) => setTransition(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Auto-transition status based on verdict
        </label>
        <Button onClick={onSave} disabled={saving || !parsedVerdict}>
          {saving ? "Saving…" : "Record verdict"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PRD panel
// ---------------------------------------------------------------------------

function PrdPanel({
  siteRequestId,
  inspirationUrls,
  prompt01,
}: {
  siteRequestId: string;
  inspirationUrls: string[];
  prompt01: string;
}) {
  const router = useRouter();

  if (inspirationUrls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No inspiration URLs on this intake. Add some via NEEDS_INFO or move
        directly to spec generation if the client picked a preset.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Run Prompt 01 once per URL in your browser Claude session, then paste
        each PRD JSON below the corresponding URL.
      </p>
      {inspirationUrls.map((url, idx) => (
        <PrdUrlRow
          key={url}
          index={idx + 1}
          url={url}
          prompt01={prompt01}
          onSaved={() => router.refresh()}
          siteRequestId={siteRequestId}
        />
      ))}
    </div>
  );
}

function PrdUrlRow({
  index,
  url,
  prompt01,
  siteRequestId,
  onSaved,
}: {
  index: number;
  url: string;
  prompt01: string;
  siteRequestId: string;
  onSaved: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [prd, setPrd] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(`${prompt01}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await saveInspirationPrd(siteRequestId, url, extractJsonBlock(prd));
      setSaved(true);
      setPrd("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <Label className="text-xs font-medium">
          {index}.{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 break-all"
          >
            {url}
          </a>
        </Label>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? "Copied!" : "Copy prompt + URL"}
        </Button>
      </div>
      <textarea
        value={prd}
        onChange={(e) => setPrd(e.target.value)}
        rows={5}
        placeholder="Paste the PRD JSON Claude returned..."
        className="w-full rounded-md border border-input bg-transparent p-2 text-xs font-mono shadow-xs"
      />
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
      {saved ? (
        <p className="mt-2 text-xs text-emerald-600">Saved to the timeline.</p>
      ) : null}
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={onSave} disabled={saving || !prd.trim()}>
          {saving ? "Saving…" : "Save PRD"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the first JSON object from a string. Claude often wraps results
 * in ```json ... ``` fences or includes a one-line preamble — strip those
 * so the parse doesn't fail on otherwise-valid output.
 */
function extractJsonBlock(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
