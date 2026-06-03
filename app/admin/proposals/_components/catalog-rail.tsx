"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/proposals/totals-shared";
import type { ComposerCatalogItem } from "./types";

// ---------------------------------------------------------------------------
// CatalogRail — left rail of the composer. Search-filtered, grouped by
// kind (Tier vs Add-on), click to add.
// ---------------------------------------------------------------------------

export function CatalogRail({
  catalog,
  onAdd,
  disabled,
}: {
  catalog: ComposerCatalogItem[];
  onAdd: (catalogItemId: string) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");

  const { tiers, addons } = useMemo(() => {
    const lower = q.trim().toLowerCase();
    const matches = (i: ComposerCatalogItem) =>
      !lower ||
      i.label.toLowerCase().includes(lower) ||
      i.description.toLowerCase().includes(lower);
    const visible = catalog.filter((i) => i.active && matches(i));
    return {
      tiers: visible.filter((i) => i.kind === "TIER"),
      addons: visible.filter((i) => i.kind === "ADDON"),
    };
  }, [catalog, q]);

  return (
    <div className="space-y-3">
      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search catalog"
          className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {catalog.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">
          Catalog is empty. Seed it from /admin/proposals/catalog.
        </p>
      ) : null}

      <Group label="Tiers" items={tiers} onAdd={onAdd} disabled={disabled} />
      <Group label="Add-ons" items={addons} onAdd={onAdd} disabled={disabled} />
    </div>
  );
}

function Group({
  label,
  items,
  onAdd,
  disabled,
}: {
  label: string;
  items: ComposerCatalogItem[];
  onAdd: (catalogItemId: string) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted-foreground px-1">
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAdd(i.id)}
              className={cn(
                "w-full text-left rounded-md border border-border bg-card px-3 py-2 hover:bg-muted/40 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              title={i.description}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-foreground truncate">
                  {i.label}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                  {formatCents(i.defaultPriceCents)}
                  {i.cadence ? "/mo" : ""}
                </span>
              </div>
              {i.description ? (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {i.description}
                </p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
