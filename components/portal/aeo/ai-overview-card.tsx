"use client";

import * as React from "react";
import { SectionCard } from "@/components/admin/page-header";

// AEO v2 W2: Google AI Overview row. For the top-5 GSC queries (last 28d),
// shows the AI Overview text captured from Google + the cited URLs +
// whether the org's primary domain is one of them. Truncated by default,
// click to expand.

export type AiOverviewRow = {
  query: string;
  summary: string;
  citedUrls: string[];
  cited: boolean;
  capturedAt: string;
};

export type AiOverviewProps = {
  rows: AiOverviewRow[];
  engineSource: "direct" | "dataforseo";
  bare?: boolean;
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

function OverviewItem({ row }: { row: AiOverviewRow }) {
  const [expanded, setExpanded] = React.useState(false);
  const trimmed = (row.summary ?? "").trim();
  const isLong = trimmed.length > 220;
  const displayText = expanded || !isLong ? trimmed : `${trimmed.slice(0, 220).trimEnd()}…`;

  return (
    <li className="py-3.5 border-b border-border last:border-b-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-foreground" title={row.query}>
            {row.query}
          </div>
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mt-0.5">
            captured {formatDate(row.capturedAt)}
          </div>
        </div>
        <span
          className={
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border " +
            (row.cited
              ? "bg-[rgba(36,161,72,0.10)] text-[#24a148] border-[#24a148]/30"
              : "bg-muted text-muted-foreground border-border")
          }
        >
          {row.cited ? "Cited" : "Not cited"}
        </span>
      </div>
      {trimmed.length === 0 ? (
        <div className="text-[12px] text-muted-foreground italic">
          Google didn&apos;t surface an AI Overview for this query.
        </div>
      ) : (
        <>
          <p className="text-[13px] text-foreground/85 leading-relaxed">
            {displayText}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] text-primary hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </>
      )}
      {row.citedUrls.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap text-[11px] text-muted-foreground">
          <span className="mr-0.5">Sources:</span>
          {row.citedUrls.slice(0, 5).map((u) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-[2px] bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              title={u}
            >
              {(() => {
                try {
                  return new URL(u).hostname.replace(/^www\./, "");
                } catch {
                  return u;
                }
              })()}
            </a>
          ))}
        </div>
      )}
    </li>
  );
}

export function AiOverviewCard({
  rows,
  engineSource,
  bare = false,
}: AiOverviewProps) {
  return (
    <SectionCard
      bare={bare}
      label="Google AI Overview"
      description="What Google's AI Overview is saying for your top-ranked queries over the last 28 days."
    >
      {rows.length === 0 ? (
        <div className="text-[13px] text-muted-foreground py-2">
          {engineSource === "dataforseo"
            ? "AI Overview snapshots populate on your next scheduled scan."
            : "AI search intelligence is being activated for your account. Your first AI Overview report lands within 24 hours."}
        </div>
      ) : (
        <>
          {/* Context strip — the headline read before the per-query list. */}
          {(() => {
            const cited = rows.filter((r) => r.cited).length;
            return (
              <div className="mb-3 rounded-[2px] border border-border bg-secondary px-3 py-2 text-[12px] text-foreground">
                Google&apos;s AI Overview cites you in{" "}
                <span
                  className={
                    "font-semibold " +
                    (cited > 0 ? "text-[#24a148]" : "text-[#da1e28]")
                  }
                >
                  {cited} of {rows.length}
                </span>{" "}
                of your top queries.{" "}
                {cited < rows.length
                  ? "Uncited queries are where competitors get the click instead."
                  : "Every tracked query currently links back to you."}
              </div>
            );
          })()}
          <ul>
            {rows.map((row) => (
              <OverviewItem key={`${row.query}-${row.capturedAt}`} row={row} />
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
