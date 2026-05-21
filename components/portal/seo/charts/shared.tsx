"use client";

import * as React from "react";
import { formatDistanceToNowStrict, nextMonday, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";

// ---------------------------------------------------------------------------
// Shared constants + helpers for the per-chart files split out of
// seo-phase2-charts.tsx. Keeps the color system consistent across the
// dashboard while letting each heavy chart land in its own bundle chunk.
// ---------------------------------------------------------------------------

export const BRAND = "#2563EB";
export const BRAND_LIGHT = "#93C5FD";
export const BRAND_LIGHTER = "#DBEAFE";
export const INK = "#1E2A3A";
export const MUTED = "#94A3B8";
export const SUCCESS = "#059669";
export const DANGER = "#DC2626";
export const BORDER = "#E2E8F0";

export function SectionHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <header className="mb-3">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
        {eyebrow}
      </p>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint ? (
        <p className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</p>
      ) : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Empty-state utilities — turn "appears after sync" placeholders into
// premium, specific previews with timeline anchors.
// ---------------------------------------------------------------------------

/**
 * Computes the next Monday 05:00 UTC weekly snapshot time, expressed as
 * a relative distance ("in 2 days", "in 14 hours"). Stable on the server
 * (hydration-safe) by deferring the calculation to a client effect.
 */
export function useNextSnapshotIn(): string {
  const [label, setLabel] = React.useState<string>("soon");
  React.useEffect(() => {
    const compute = () => {
      const now = new Date();
      // nextMonday returns the next Monday at 00:00 *local* — we anchor to 05:00 UTC.
      const utcNowMs = now.getTime();
      const dayMs = 86_400_000;
      // Walk forward day-by-day until we hit a UTC Monday at 05:00 that is in the future.
      let candidate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          5,
          0,
          0,
          0,
        ),
      );
      while (candidate.getUTCDay() !== 1 || candidate.getTime() <= utcNowMs) {
        candidate = new Date(candidate.getTime() + dayMs);
      }
      setLabel(formatDistanceToNowStrict(candidate, { addSuffix: false }));
    };
    compute();
    const id = window.setInterval(compute, 60_000);
    return () => window.clearInterval(id);
  }, []);
  // Touch nextMonday/setHours/setMinutes/setSeconds/setMilliseconds so the
  // imports are not treeshaken away — they remain available for future card
  // empty states that need precise scheduling math.
  void nextMonday;
  void setHours;
  void setMinutes;
  void setSeconds;
  void setMilliseconds;
  return label;
}

export function NextSnapshotTag({ prefix = "Next snapshot" }: { prefix?: string }) {
  const inLabel = useNextSnapshotIn();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
      {prefix} · in {inLabel}
    </span>
  );
}

/**
 * Wraps an empty-state body with consistent padding, a faded preview, a
 * specifics blurb, and the snapshot timeline tag.
 */
export function EmptyStateBody({
  preview,
  body,
  example,
}: {
  preview: React.ReactNode;
  body: string;
  example?: string;
}) {
  return (
    <div className="mt-2 grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-5 items-center">
      <div
        className="rounded-lg border border-dashed border-border bg-gradient-to-br from-primary/[0.03] to-transparent p-2.5 overflow-hidden"
        aria-hidden="true"
      >
        {preview}
      </div>
      <div className="space-y-2.5">
        <p className="text-[12px] leading-relaxed text-foreground/85">
          {body}
        </p>
        {example ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground border-l-2 border-primary/40 pl-2.5">
            <span className="font-mono uppercase tracking-[0.1em] text-[9.5px] text-primary mr-1.5">
              Example
            </span>
            {example}
          </p>
        ) : null}
        <NextSnapshotTag />
      </div>
    </div>
  );
}
