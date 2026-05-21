"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

type Intent = "transactional" | "local" | "informational" | "branded";

type TargetQuery = {
  id: string;
  propertyId: string | null;
  query: string;
  intent: Intent | string | null;
  active: boolean;
  createdAt: string;
  latestRanking: {
    position: number | null;
    url: string | null;
    scannedAt: string;
  } | null;
};

type Props = {
  propertyId: string;
};

const INTENT_OPTIONS: Intent[] = [
  "local",
  "transactional",
  "informational",
  "branded",
];

// ---------------------------------------------------------------------------
// TargetQueryManager — inline CRUD table for SeoTargetQuery rows. Surfaces
// the latest SerpRanking position so operators can see at a glance which
// queries are paying off.
//
// Used in /portal/seo/agent inside an expandable panel. Independent of
// the main page so we don't have to re-fetch the whole agent dashboard
// after every CRUD action.
// ---------------------------------------------------------------------------
export function TargetQueryManager({ propertyId }: Props) {
  const [queries, setQueries] = useState<TargetQuery[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [newQuery, setNewQuery] = useState("");
  const [newIntent, setNewIntent] = useState<Intent>("local");
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/portal/seo/target-queries?propertyId=${encodeURIComponent(propertyId)}`,
      );
      const body = await res.json();
      setQueries(body.queries ?? []);
    } catch {
      toast.error("Could not load target queries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function addQuery() {
    const q = newQuery.trim();
    if (q.length < 2) {
      toast.error("Add a real query.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/portal/seo/target-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, query: q, intent: newIntent }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? "Could not add query.");
        return;
      }
      setNewQuery("");
      toast.success("Query added. Next scan will pull SERP data.");
      refresh();
    });
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/portal/seo/target-queries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      toast.error("Could not update.");
      return;
    }
    refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/portal/seo/target-queries/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove.");
      return;
    }
    refresh();
  }

  const active = queries?.filter((q) => q.active) ?? [];
  const inactive = queries?.filter((q) => !q.active) ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Target queries
          </h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Queries we track for this property. Max 20 active.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
          {active.length}/20
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-4">
        <input
          type="text"
          value={newQuery}
          onChange={(e) => setNewQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addQuery();
          }}
          placeholder="apartments near…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={newIntent}
          onChange={(e) => setNewIntent(e.target.value as Intent)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] text-foreground"
        >
          {INTENT_OPTIONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addQuery}
          disabled={isPending || active.length >= 20}
          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add"}
        </button>
      </div>

      {loading ? (
        <div className="text-[12px] text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-1">
          {active.length === 0 && inactive.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground">
              No queries yet. Add 3-5 to start tracking your rank.
            </div>
          ) : null}

          {active.map((q) => (
            <QueryRow
              key={q.id}
              q={q}
              onToggle={(active) => toggleActive(q.id, active)}
              onRemove={() => remove(q.id)}
            />
          ))}

          {inactive.length > 0 ? (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1">
                {inactive.length} inactive
              </summary>
              <div className="mt-2 space-y-1 opacity-70">
                {inactive.map((q) => (
                  <QueryRow
                    key={q.id}
                    q={q}
                    onToggle={(active) => toggleActive(q.id, active)}
                    onRemove={() => remove(q.id)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}

function QueryRow({
  q,
  onToggle,
  onRemove,
}: {
  q: TargetQuery;
  onToggle: (active: boolean) => void;
  onRemove: () => void;
}) {
  const rank = q.latestRanking?.position ?? null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground truncate">
            {q.query}
          </span>
          {q.intent ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
              {q.intent}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rank != null ? (
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-mono ${
              rank <= 10
                ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : rank <= 30
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
            }`}
            title={q.latestRanking?.url ?? undefined}
          >
            #{rank}
          </span>
        ) : (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
            no rank
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggle(!q.active)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {q.active ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-muted-foreground hover:text-red-600"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
