"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
// build-fix (audit 2026-06-02): import server actions directly from
// their source `_actions/*` files instead of via the `actions.ts`
// re-export barrel — Next 16 + Turbopack rejects re-exports inside a
// `"use server"` file (only async functions defined locally are
// allowed). See the block comment in `app/admin/proposals/actions.ts`.
import {
  seedCatalogDefaults,
  setCatalogActive,
  updateCatalogItem,
} from "../_actions/catalog-actions";
import { formatCents } from "@/lib/proposals/totals-shared";
import type { ComposerCatalogItem } from "../_components/types";

// ---------------------------------------------------------------------------
// CatalogEditor — operator-facing CRUD-lite for ProposalCatalogItem.
// ---------------------------------------------------------------------------

export function CatalogEditor({ items }: { items: ComposerCatalogItem[] }) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  async function seed() {
    setSeeding(true);
    try {
      await seedCatalogDefaults();
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={seed}
          disabled={seeding}
          className="inline-flex items-center rounded-md bg-card border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40 transition-colors disabled:opacity-60"
        >
          {seeding ? "Seeding…" : "Seed from defaults"}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Catalog is empty. Click "Seed from defaults" to load tiers + add-ons.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id}>
              <CatalogRow item={i} onMutated={() => router.refresh()} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CatalogRow({
  item,
  onMutated,
}: {
  item: ComposerCatalogItem;
  onMutated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [description, setDescription] = useState(item.description);
  const [priceCents, setPriceCents] = useState(item.defaultPriceCents);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateCatalogItem({
        catalogItemId: item.id,
        label,
        description,
        defaultPriceCents: priceCents,
      });
      setEditing(false);
      onMutated();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    try {
      await setCatalogActive({ catalogItemId: item.id, active: !item.active });
      onMutated();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-transparent border-0 border-b border-border focus:border-primary outline-none text-sm font-medium text-foreground"
            />
          ) : (
            <div className="text-sm font-medium text-foreground">
              {item.label}
            </div>
          )}
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-0.5">
            {item.kind} · {item.slug}
            {item.cadence ? ` · ${item.cadence.toLowerCase()}` : " · one-time"}
          </div>
          {editing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
            />
          ) : (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">$</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={(priceCents / 100).toString()}
                onChange={(e) =>
                  setPriceCents(
                    Math.max(0, Math.round(Number(e.target.value) * 100) || 0),
                  )
                }
                className="w-24 rounded-md border border-border bg-card px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ) : (
            <div className="text-sm tabular-nums text-foreground">
              {formatCents(item.defaultPriceCents)}
              {item.cadence ? (
                <span className="text-muted-foreground text-xs">/mo</span>
              ) : null}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleActive}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              {item.active ? "Active" : "Inactive"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setLabel(item.label);
                setDescription(item.description);
                setPriceCents(item.defaultPriceCents);
              }}
              className="text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-muted/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-muted/40"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
