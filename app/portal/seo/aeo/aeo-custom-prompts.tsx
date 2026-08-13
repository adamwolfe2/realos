"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/admin/page-header";

// Custom-prompt manager for /portal/seo/aeo. Operators add their own
// user-style questions ("Is <property> worth it compared to <rival>?");
// each active prompt runs against every engine in every scan, so the API
// caps active prompts at 10 per property. Server data comes down via
// page.tsx; mutations POST/PATCH /api/portal/seo/aeo/custom-prompts then
// router.refresh().

export type CustomPromptRow = {
  id: string;
  propertyId: string;
  prompt: string;
  active: boolean;
};

export type CustomPromptsProps = {
  properties: Array<{ id: string; name: string }>;
  prompts: CustomPromptRow[];
};

export function AeoCustomPrompts({ properties, prompts }: CustomPromptsProps) {
  const router = useRouter();
  const [propertyId, setPropertyId] = React.useState(properties[0]?.id ?? "");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (properties.length === 0) return null;

  const forProperty = prompts.filter((p) => p.propertyId === propertyId);
  const activeCount = forProperty.filter((p) => p.active).length;

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const prompt = text.trim();
    if (prompt.length < 10 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/seo/aeo/custom-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, prompt }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Could not add prompt (${res.status})`);
        return;
      }
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(row: CustomPromptRow) {
    if (togglingId) return;
    setTogglingId(row.id);
    setError(null);
    try {
      const res = await fetch("/api/portal/seo/aeo/custom-prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, active: !row.active }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Could not update prompt (${res.status})`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <SectionCard
      label="Custom prompts"
      description="Your own questions, asked verbatim to every AI engine in each scan — alongside the automatic ones. Up to 10 active per property."
    >
      <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-2 mb-4">
        {properties.length > 1 ? (
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="h-9 rounded-[2px] border border-border bg-background px-2 text-[13px] text-foreground sm:w-56"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g. "Is Telegraph Commons cheaper than living in the dorms at UC Berkeley?"'
          maxLength={300}
          className="h-9 flex-1 rounded-[2px] border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy || text.trim().length < 10 || activeCount >= 10}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 text-xs font-semibold text-background hover:bg-foreground/90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Add prompt
        </button>
      </form>

      {error ? (
        <p className="mb-3 text-[12px] text-destructive">{error}</p>
      ) : null}

      {forProperty.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-1">
          No custom prompts yet. Add the exact questions you want to rank for —
          they run in the next scan and show up in the responses table above.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {forProperty.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span
                className={`text-[13px] leading-snug ${
                  row.active
                    ? "text-foreground"
                    : "text-muted-foreground line-through"
                }`}
              >
                {row.prompt}
              </span>
              <button
                type="button"
                onClick={() => onToggle(row)}
                disabled={togglingId === row.id}
                className="shrink-0 text-[11px] font-semibold text-primary hover:underline disabled:opacity-60"
              >
                {togglingId === row.id
                  ? "Saving…"
                  : row.active
                    ? "Deactivate"
                    : "Reactivate"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
