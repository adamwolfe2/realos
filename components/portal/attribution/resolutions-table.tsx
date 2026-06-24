"use client";

import * as React from "react";
import { SourceLogo } from "@/components/portal/attribution/source-logo";
import type { GraphFilter } from "@/components/portal/attribution/reverse-attribution-graph";

// ---------------------------------------------------------------------------
// ResolutionsTable — Cursive-style per-visit feed: every identified visit with
// its referrer, landing page, identity, location, and age. Filters live to the
// node selected in the graph above.
// ---------------------------------------------------------------------------

export type ResolutionRow = {
  id: string;
  occurredAt: string;
  sourceId: string;
  sourceLabel: string;
  referrer: string;
  landingPath: string;
  name: string;
  location: string;
  ageRange: string;
  intentScore: number;
  isLead: boolean;
};

export function ResolutionsTable({
  rows,
  filter,
}: {
  rows: ResolutionRow[];
  filter: GraphFilter;
}) {
  const filtered = React.useMemo(() => {
    if (!filter) return rows;
    if (filter.type === "source")
      return rows.filter((r) => r.sourceId === filter.value);
    return rows.filter((r) => r.landingPath === filter.value);
  }, [rows, filter]);

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No identified visits in this window yet. As the pixel resolves visitors,
        each one appears here with the site they came from.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <Th>When</Th>
            <Th>Source</Th>
            <Th>Referrer</Th>
            <Th>Landing</Th>
            <Th>Name</Th>
            <Th>Location</Th>
            <Th>Age</Th>
            <Th className="text-right">Intent</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr
              key={r.id}
              className="border-b border-border/40 hover:bg-muted/30 transition-colors"
            >
              <Td className="whitespace-nowrap text-muted-foreground font-mono">
                {fmt(r.occurredAt)}
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1.5">
                  <SourceLogo logo={r.sourceId} size={20} />
                  <span className="truncate max-w-[110px]">{r.sourceLabel}</span>
                </span>
              </Td>
              <Td className="max-w-[180px] truncate text-muted-foreground font-mono">
                {r.referrer}
              </Td>
              <Td className="max-w-[160px] truncate font-mono text-muted-foreground">
                {r.landingPath}
              </Td>
              <Td className="font-medium text-foreground">
                <span className="inline-flex items-center gap-1.5">
                  {r.name}
                  {r.isLead ? (
                    <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-primary">
                      Lead
                    </span>
                  ) : null}
                </span>
              </Td>
              <Td className="text-muted-foreground">{r.location}</Td>
              <Td className="text-muted-foreground whitespace-nowrap">
                {r.ageRange}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {r.intentScore}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No identified visits match this filter.
        </div>
      ) : null}
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-2 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-2 py-2 align-middle ${className}`}>{children}</td>;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
