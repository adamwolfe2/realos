"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Layers,
} from "lucide-react";
import type { AeoEngine } from "@prisma/client";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// All Responses table — Searchable.ai-style. One row per AI response,
// or one row per prompt with engine responses collapsed when "Group:
// Prompt" is on (default). Columns mirror the reference: engine logo,
// response excerpt, mentioned?, cited?, position, mentions (brand
// chips), sources (URL chips), created.
//
// Status verdicts deliberately don't use green/red — Yes is text-primary
// with a check, No is text-muted-foreground with an X. That keeps the
// LeaseStack blue accent as the only signal of "good" and avoids the
// rainbow look of the prior table.

export type ResponseRow = {
  id: string;
  engine: AeoEngine;
  prompt: string;
  status: "CITED" | "NOT_CITED" | "COMPETITOR_CITED" | "SKIPPED";
  mentioned: boolean;
  position: number | null;
  responseExcerpt: string;
  citedUrl: string | null;
  competitorsCited: string[];
  queryRunAt: string; // ISO
};

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};

function EngineLogo({ engine, size = 16 }: { engine: AeoEngine; size?: number }) {
  switch (engine) {
    case "CHATGPT":
      return <ChatGPTMark size={size} />;
    case "PERPLEXITY":
      return <PerplexityMark size={size} />;
    case "CLAUDE":
      return <ClaudeMark size={size} />;
    case "GEMINI":
      return <GeminiMark size={size} />;
  }
}

function Verdict({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary tabular-nums">
      <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground tabular-nums">
      <X className="h-3.5 w-3.5" strokeWidth={2} />
      No
    </span>
  );
}

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function MentionChip({ name }: { name: string }) {
  return (
    <span
      title={name}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-semibold text-muted-foreground -ml-1 first:ml-0"
    >
      {initialsOf(name)}
    </span>
  );
}

function MentionStack({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }
  const shown = names.slice(0, 4);
  const overflow = names.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((n, i) => (
        <MentionChip key={`${n}-${i}`} name={n} />
      ))}
      {overflow > 0 ? (
        <span className="ml-1 text-[11px] text-muted-foreground tabular-nums">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SourceChips({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }
  const shown = urls.slice(0, 3);
  const overflow = urls.length - shown.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map((u, i) => (
        <span
          key={`${u}-${i}`}
          title={u}
          className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground max-w-[120px] truncate"
        >
          {hostOf(u)}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

// CSV escaping per RFC 4180 — wrap in quotes, double internal quotes.
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(rows: ResponseRow[]) {
  const header = [
    "id",
    "engine",
    "prompt",
    "mentioned",
    "cited",
    "position",
    "response_excerpt",
    "cited_url",
    "competitors",
    "query_run_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.id),
        csvCell(r.engine),
        csvCell(r.prompt),
        csvCell(r.mentioned ? "yes" : "no"),
        csvCell(r.status === "CITED" ? "yes" : "no"),
        csvCell(r.position ?? ""),
        csvCell(r.responseExcerpt),
        csvCell(r.citedUrl ?? ""),
        csvCell(r.competitorsCited.join("; ")),
        csvCell(r.queryRunAt),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aeo-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type StatusFilter = "all" | "mentioned" | "cited" | "neither";

function matchesFilter(row: ResponseRow, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "mentioned":
      return row.mentioned;
    case "cited":
      return row.status === "CITED";
    case "neither":
      return !row.mentioned && row.status !== "CITED";
  }
}

// One leaf row — used both in flat mode and as the expanded child of a
// grouped prompt row. Keeps column widths identical between modes via
// the shared CSS grid track template.
function LeafRow({ row, indent = false }: { row: ResponseRow; indent?: boolean }) {
  return (
    <div
      className={
        "grid grid-cols-[28px_minmax(0,1fr)_70px_70px_60px_110px_140px_80px] items-center gap-3 px-3 py-2.5 text-[12.5px] " +
        (indent ? "pl-9 bg-muted/20" : "")
      }
    >
      <div className="flex items-center justify-center">
        <EngineLogo engine={row.engine} size={16} />
      </div>
      <div
        className="text-foreground/90 line-clamp-1 min-w-0"
        title={row.responseExcerpt}
      >
        {row.responseExcerpt || (
          <span className="text-muted-foreground italic">(empty response)</span>
        )}
      </div>
      <div>
        <Verdict value={row.mentioned} />
      </div>
      <div>
        <Verdict value={row.status === "CITED"} />
      </div>
      <div className="tabular-nums text-foreground/80">
        {row.position ?? <span className="text-muted-foreground">—</span>}
      </div>
      <div>
        <MentionStack names={row.competitorsCited} />
      </div>
      <div>
        <SourceChips urls={row.citedUrl ? [row.citedUrl] : []} />
      </div>
      <div className="text-[11px] text-muted-foreground tabular-nums text-right">
        {formatDistanceToNow(new Date(row.queryRunAt), { addSuffix: true })}
      </div>
    </div>
  );
}

function GroupedRow({
  prompt,
  responses,
  defaultOpen,
}: {
  prompt: string;
  responses: ResponseRow[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const anyMentioned = responses.some((c) => c.mentioned);
  const anyCited = responses.some((c) => c.status === "CITED");
  const latest = responses.reduce((a, b) =>
    new Date(a.queryRunAt) > new Date(b.queryRunAt) ? a : b,
  );
  // Engine logos shown on the grouped header — deduped, in canonical order.
  const order: AeoEngine[] = ["CHATGPT", "PERPLEXITY", "CLAUDE", "GEMINI"];
  const present = order.filter((e) => responses.some((c) => c.engine === e));

  return (
    <div className="border-b border-[var(--hair)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full grid grid-cols-[28px_minmax(0,1fr)_70px_70px_60px_110px_140px_80px] items-center gap-3 px-3 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center justify-center text-muted-foreground">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex items-center gap-2">
          <div className="flex items-center -space-x-1">
            {present.map((e) => (
              <span
                key={e}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card"
                title={ENGINE_LABELS[e]}
              >
                <EngineLogo engine={e} size={12} />
              </span>
            ))}
          </div>
          <span
            className="text-[13px] font-medium text-foreground truncate"
            title={prompt}
          >
            {prompt}
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums shrink-0">
            {responses.length}
          </span>
        </div>
        <div>
          <Verdict value={anyMentioned} />
        </div>
        <div>
          <Verdict value={anyCited} />
        </div>
        <div className="text-muted-foreground text-[12px]">—</div>
        <div className="text-muted-foreground text-[12px]">
          {/* Aggregate mentions: top competitor names from the group */}
          <MentionStack
            names={Array.from(
              new Set(responses.flatMap((c) => c.competitorsCited)),
            )}
          />
        </div>
        <div>
          <SourceChips
            urls={responses
              .map((c) => c.citedUrl)
              .filter((u): u is string => !!u)}
          />
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums text-right">
          {formatDistanceToNow(new Date(latest.queryRunAt), { addSuffix: true })}
        </div>
      </button>
      {open ? (
        <div className="divide-y divide-[var(--hair)] bg-secondary">
          {responses
            .slice()
            .sort(
              (a, b) =>
                new Date(b.queryRunAt).getTime() -
                new Date(a.queryRunAt).getTime(),
            )
            .map((c) => (
              <LeafRow key={c.id} row={c} indent />
            ))}
        </div>
      ) : null}
    </div>
  );
}

export function AeoResponsesTable({ rows }: { rows: ResponseRow[] }) {
  const [query, setQuery] = React.useState("");
  const [grouped, setGrouped] = React.useState(true);
  const [filter, setFilter] = React.useState<StatusFilter>("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesFilter(r, filter)) return false;
      if (!q) return true;
      return (
        r.prompt.toLowerCase().includes(q) ||
        r.responseExcerpt.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  const groups = React.useMemo(() => {
    const map = new Map<string, ResponseRow[]>();
    for (const r of filtered) {
      const list = map.get(r.prompt) ?? [];
      list.push(r);
      map.set(r.prompt, list);
    }
    // Order groups by most-recent response inside each group.
    return Array.from(map.entries())
      .map(([prompt, responses]) => ({
        prompt,
        responses,
        latest: Math.max(
          ...responses.map((c) => new Date(c.queryRunAt).getTime()),
        ),
      }))
      .sort((a, b) => b.latest - a.latest);
  }, [filtered]);

  const totalLabel = `${rows.length.toLocaleString()} response${rows.length === 1 ? "" : "s"}`;

  return (
    <section className="ls-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 border-b border-[var(--hair)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground tabular-nums">
            {totalLabel}
          </span>
          <span className="text-[11.5px] text-muted-foreground truncate">
            Every AI response across all prompts
          </span>
        </div>
        <div className="flex items-center gap-2 md:ml-auto flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts"
              className="h-8 w-[200px] rounded-md border border-border bg-card pl-7 pr-2 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/60"
            />
          </div>
          <button
            type="button"
            onClick={() => setGrouped((g) => !g)}
            className={
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[12px] font-medium transition-colors " +
              (grouped
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted")
            }
            title="Toggle grouping by prompt"
          >
            <Layers className="h-3.5 w-3.5" />
            Group: Prompt
          </button>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="ls-select h-8 px-2 text-[12px] font-medium text-foreground"
          >
            <option value="all">All statuses</option>
            <option value="mentioned">Mentioned</option>
            <option value="cited">Cited</option>
            <option value="neither">Neither</option>
          </select>
          <button
            type="button"
            onClick={() => downloadCsv(filtered)}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-card text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[28px_minmax(0,1fr)_70px_70px_60px_110px_140px_80px] items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground border-b border-[var(--hair)] bg-muted/30">
        <div></div>
        <div>{grouped ? "Prompt" : "Response"}</div>
        <div>Mentioned</div>
        <div>Cited</div>
        <div>Position</div>
        <div>Mentions</div>
        <div>Sources</div>
        <div className="text-right">Created</div>
      </div>

      {/* Body */}
      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
          No responses match the current filters.
        </div>
      ) : grouped ? (
        <div>
          {groups.map((g) => (
            <GroupedRow
              key={g.prompt}
              prompt={g.prompt}
              responses={g.responses}
              defaultOpen={false}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[var(--hair)]">
          {filtered.map((r) => (
            <LeafRow key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}
