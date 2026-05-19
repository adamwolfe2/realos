"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";

// Expandable "Recent prompts" table. Server passes the most recent N rows;
// each row collapses to one line by default and reveals the full response
// text on click.
export interface CheckRow {
  id: string;
  engine: "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI";
  prompt: string;
  status: "CITED" | "NOT_CITED" | "COMPETITOR_CITED";
  responseText: string;
  citedUrl: string | null;
  competitorsCited: string[];
  queryRunAt: string; // ISO
  propertyName: string | null;
}

const ENGINE_LABELS: Record<CheckRow["engine"], string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};

const STATUS_STYLES: Record<
  CheckRow["status"],
  { label: string; classes: string }
> = {
  CITED: {
    label: "Cited",
    classes:
      "bg-primary/10 text-primary border-primary/30",
  },
  COMPETITOR_CITED: {
    label: "Competitor cited",
    classes:
      "bg-amber-50 text-amber-900 border-amber-200",
  },
  NOT_CITED: {
    label: "Not cited",
    classes:
      "bg-muted text-muted-foreground border-border",
  },
};

export function RecentChecksTable({ rows }: { rows: CheckRow[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="text-[13px] text-muted-foreground py-6 text-center">
        No AI-search checks yet. Run a scan to see how each engine
        responds.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--hair)]">
      {rows.map((row) => {
        const isOpen = expandedId === row.id;
        const status = STATUS_STYLES[row.status];
        const excerpt =
          row.responseText.length > 200
            ? row.responseText.slice(0, 200).trim() + "…"
            : row.responseText.trim();
        return (
          <div key={row.id} className="py-3">
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : row.id)}
              className="w-full text-left flex items-start gap-3 group"
            >
              <span className="mt-0.5 text-muted-foreground shrink-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                    {ENGINE_LABELS[row.engine]}
                  </span>
                  <span
                    className={
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                      status.classes
                    }
                  >
                    {status.label}
                  </span>
                  {row.propertyName ? (
                    <span className="text-[11px] text-muted-foreground">
                      {row.propertyName}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(row.queryRunAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div className="text-[13px] font-medium text-foreground truncate">
                  {row.prompt}
                </div>
                {!isOpen ? (
                  <div className="text-[12px] text-muted-foreground mt-1 line-clamp-2">
                    {excerpt}
                  </div>
                ) : null}
              </div>
            </button>
            {isOpen ? (
              <div className="mt-3 ml-7 space-y-2">
                <div className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-md p-3 border border-[var(--hair)]">
                  {row.responseText || "(empty response)"}
                </div>
                {row.citedUrl ? (
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Cited URL: </span>
                    <a
                      href={row.citedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {row.citedUrl}
                    </a>
                  </div>
                ) : null}
                {row.competitorsCited.length > 0 ? (
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">
                      Competitors mentioned:{" "}
                    </span>
                    <span className="text-foreground">
                      {row.competitorsCited.join(", ")}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
