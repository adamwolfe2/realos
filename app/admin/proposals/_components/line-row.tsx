"use client";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/proposals/totals-shared";
import { MAX_PRICE_CENTS, MAX_QUANTITY } from "@/lib/proposals/constants";
import type { ComposerLine } from "./types";

// ---------------------------------------------------------------------------
// LineRow — one editable row inside the composer. Inline qty + unit-price
// inputs, recurring toggle, delete button. Drag-handle is a label cell with
// `data-drag-handle` so the parent's drag wiring can target it later.
// ---------------------------------------------------------------------------

export function LineRow({
  line,
  onPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled,
  index,
  total,
}: {
  line: ComposerLine;
  onPatch: (patch: Partial<ComposerLine>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
  index: number;
  total: number;
}) {
  const subtotalCents = line.unitPriceCents * Math.max(1, line.quantity);
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card p-3 space-y-2",
        disabled ? "opacity-70" : "",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <input
            value={line.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            disabled={disabled}
            placeholder="Line label"
            className="w-full bg-transparent border-0 border-b border-border focus:border-primary outline-none text-sm font-medium text-foreground px-0 py-0.5"
          />
          <textarea
            value={line.description ?? ""}
            onChange={(e) => onPatch({ description: e.target.value })}
            disabled={disabled}
            placeholder="Optional description shown on the proposal"
            rows={1}
            className="mt-1 w-full bg-transparent border-0 outline-none text-[11.5px] text-muted-foreground placeholder:text-muted-foreground/60 resize-none px-0"
          />
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="inline-flex items-center gap-0.5">
            <button
              type="button"
              disabled={disabled || index === 0}
              onClick={onMoveUp}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
              title="Move up"
              aria-label="Move up"
            >
              <span aria-hidden="true">↑</span>
            </button>
            <button
              type="button"
              disabled={disabled || index === total - 1}
              onClick={onMoveDown}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
              title="Move down"
              aria-label="Move down"
            >
              <span aria-hidden="true">↓</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
              title="Remove"
              aria-label="Remove"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-border/60">
        <Field label="Unit price">
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-1">$</span>
            <input
              type="number"
              min={0}
              max={MAX_PRICE_CENTS / 100}
              step="0.01"
              disabled={disabled}
              value={(line.unitPriceCents / 100).toString()}
              onChange={(e) => {
                const dollars = Number(e.target.value);
                const cents = Number.isFinite(dollars)
                  ? Math.round(dollars * 100)
                  : 0;
                onPatch({
                  unitPriceCents: Math.min(
                    MAX_PRICE_CENTS,
                    Math.max(0, cents),
                  ),
                });
              }}
              className="w-24 rounded-md border border-border bg-card px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </Field>

        <Field label="Qty">
          <input
            type="number"
            min={1}
            max={MAX_QUANTITY}
            step={1}
            disabled={disabled}
            value={line.quantity}
            onChange={(e) => {
              const v = Math.min(
                MAX_QUANTITY,
                Math.max(1, Math.floor(Number(e.target.value) || 1)),
              );
              onPatch({ quantity: v });
            }}
            className="w-16 rounded-md border border-border bg-card px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>

        <Field label="Billing">
          <select
            disabled={disabled}
            value={line.recurring ? "recurring" : "one_time"}
            onChange={(e) =>
              onPatch({ recurring: e.target.value === "recurring" })
            }
            className="rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="recurring">Recurring</option>
            <option value="one_time">One-time</option>
          </select>
        </Field>

        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Subtotal
          </div>
          <div className="text-sm tabular-nums text-foreground">
            {formatCents(subtotalCents)}
            {line.recurring ? (
              <span className="text-muted-foreground text-xs">/mo</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
