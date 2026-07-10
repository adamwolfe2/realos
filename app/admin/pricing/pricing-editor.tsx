"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { saveFeaturePrices, syncFeaturePricesToStripeAction } from "./actions";
import type { FeaturePriceRow } from "@/lib/billing/feature-prices";

// Admin pricing editor — one row per feature (+ base platform). Prices are
// entered in whole dollars (per property / month); the action converts to
// cents. The base platform row can't be toggled off.

export function PricingEditor({ rows }: { rows: FeaturePriceRow[] }) {
  const [pending, startTransition] = useTransition();
  const [syncing, startSync] = useTransition();
  const allSynced = rows.every((r) => r.synced);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await saveFeaturePrices(formData);
      if (res.ok) toast.success("Pricing saved");
      else toast.error(res.error);
    });
  }

  function onSync() {
    startSync(async () => {
      const res = await syncFeaturePricesToStripeAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.errors.length) {
        toast.error(`Synced ${res.synced}, ${res.errors.length} failed: ${res.errors[0]}`);
      } else {
        toast.success(`Synced ${res.synced} price${res.synced === 1 ? "" : "s"} to Stripe (${res.skipped} unchanged)`);
      }
    });
  }

  return (
    <form action={onSubmit} className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1fr_140px_90px] gap-3 px-4 py-2.5 border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Feature</span>
        <span>Price / property / mo</span>
        <span className="text-center">Shown</span>
      </div>

      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.key}
            className="grid grid-cols-1 sm:grid-cols-[1fr_140px_90px] gap-2 sm:gap-3 items-center px-4 py-3"
          >
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              {row.isBase ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  always included
                </span>
              ) : null}
              <span
                className={
                  row.synced
                    ? "text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                    : "text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                }
              >
                {row.synced ? "in Stripe" : "not synced"}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                type="number"
                name={`price_${row.key}`}
                defaultValue={(row.monthlyCents / 100).toString()}
                min={0}
                max={100000}
                step="1"
                inputMode="decimal"
                className="w-full rounded-md border border-border bg-background pl-6 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label={`${row.label} price`}
              />
            </div>

            <div className="flex sm:justify-center">
              {row.isBase ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                <input
                  type="checkbox"
                  name={`active_${row.key}`}
                  defaultChecked={row.active}
                  className="h-4 w-4 rounded border-border accent-primary"
                  aria-label={`${row.label} shown in onboarding`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-border bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          {allSynced
            ? "All prices are live in Stripe. Edit + Save, then Sync to push changes."
            : "Save your prices, then Sync to Stripe to make them billable at conversion."}
        </p>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || syncing}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save pricing"}
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={pending || syncing}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
            title="Create/update the per-feature prices in Stripe from the amounts above"
          >
            {syncing ? "Syncing…" : "Sync to Stripe"}
          </button>
        </div>
      </div>
    </form>
  );
}
