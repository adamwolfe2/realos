"use client";

import * as React from "react";
import { Plus } from "lucide-react";

// ---------------------------------------------------------------------------
// SeoAnnotationsPanel — the right rail on the overview screen. Surfaces the
// last few HIGH/CRITICAL SEO action recommendations as "annotations" so
// operators reading the trend chart can correlate spikes/dips with the
// actions our recommendations engine flagged.
//
// "Create New" is a placeholder for now — clicking it does nothing. We
// surface the affordance so the UI matches the inspiration screen and so
// the future wire-up is obvious, but we don't pretend it works.
// ---------------------------------------------------------------------------

export type SeoAnnotation = {
  id: string;
  title: string;
  /** ISO-formatted timestamp string. */
  date: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

export function SeoAnnotationsPanel({
  annotations,
}: {
  annotations: SeoAnnotation[];
}) {
  return (
    <div className="ls-card p-4 flex flex-col h-full min-h-[320px]">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3
          className="text-[13px] font-semibold tracking-tight text-foreground leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Annotations
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {annotations.length}
        </span>
      </div>

      {annotations.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-6 leading-relaxed">
          No high-severity events in the current window. As the SEO Agent
          surfaces critical issues, they will appear here so you can correlate
          them with traffic movement.
        </p>
      ) : (
        <ul className="space-y-2.5 flex-1 overflow-y-auto pr-1">
          {annotations.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-card/40 px-3 py-2.5 hover:border-primary/40 transition-colors"
            >
              <span
                aria-hidden="true"
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: severityColor(a.severity) }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  {fmtDate(a.date)}
                </div>
                <div className="mt-0.5 text-[12px] text-foreground leading-snug line-clamp-2">
                  {a.title}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 pt-3 border-t border-border">
        <button
          type="button"
          disabled
          title="Coming soon"
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-[12px] font-medium text-muted-foreground cursor-not-allowed"
        >
          <Plus className="h-3 w-3" />
          Create New
        </button>
      </div>
    </div>
  );
}

function severityColor(severity: SeoAnnotation["severity"]): string {
  // Single-blue palette. CRITICAL = deepest primary, others step toward grey.
  switch (severity) {
    case "CRITICAL": return "#1D4ED8";
    case "HIGH":     return "#2563EB";
    case "MEDIUM":   return "#93C5FD";
    case "LOW":      return "#D1D5DB";
  }
}

function fmtDate(iso: string): string {
  // The annotation list is short and entries are local-time enough that
  // a compact "MMM D" format keeps the right rail tight.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
