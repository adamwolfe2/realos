"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Network, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bindGoogleAdsCustomer,
  type BindGoogleAdsResult,
} from "@/lib/actions/google-ads-bind-customer";
import type { AccessibleCustomer } from "@/lib/integrations/google-ads";

const INITIAL: BindGoogleAdsResult = { ok: false, error: "" };

// ---------------------------------------------------------------------------
// CustomerPicker — interactive cards.
//
// One radio-row per accessible customer. The user clicks a row, then hits
// "Connect this account". Manager (MCC) accounts are marked but selectable
// — picking an MCC binds it directly (the dashboard will show metrics for
// the whole MCC). Picking a leaf customer under an MCC stores the parent
// MCC as loginCustomerId so sync queries scope correctly.
// ---------------------------------------------------------------------------
export function CustomerPicker({
  customers,
}: {
  customers: AccessibleCustomer[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(
    customers[0]?.customerId ?? null
  );
  const [state, formAction, pending] = useActionState<
    BindGoogleAdsResult,
    FormData
  >(async (_prev, fd) => {
    const result = await bindGoogleAdsCustomer(fd);
    if (result.ok) {
      // Backfill is fire-and-forget on the server. Route the operator to
      // the Ads dashboard so they see their new account row even before
      // the first sync completes.
      router.push("/portal/ads?oauth=google_ads_bound");
    }
    return result;
  }, INITIAL);

  const chosen = customers.find((c) => c.customerId === selected);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="customerId" value={selected ?? ""} />
      <input
        type="hidden"
        name="loginCustomerId"
        value={chosen?.loginCustomerId ?? ""}
      />
      <input
        type="hidden"
        name="displayName"
        value={chosen?.descriptiveName ?? ""}
      />
      <input
        type="hidden"
        name="currencyCode"
        value={chosen?.currencyCode ?? ""}
      />

      <ul className="space-y-2">
        {customers.map((c) => {
          const isSelected = c.customerId === selected;
          const Icon = c.isManager ? Network : Building2;
          return (
            <li key={c.customerId}>
              <button
                type="button"
                onClick={() => setSelected(c.customerId)}
                className={cn(
                  "w-full text-left rounded-md border px-4 py-3 flex items-center gap-3 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/40"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {c.descriptiveName ?? "Untitled account"}
                    </span>
                    {c.isManager ? (
                      <span className="text-[10px] uppercase tracking-wide rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground">
                        Manager (MCC)
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    {formatCustomerId(c.customerId)}
                    {c.currencyCode ? ` · ${c.currencyCode}` : ""}
                    {c.timeZone ? ` · ${c.timeZone}` : ""}
                  </p>
                </div>
                {isSelected ? (
                  <Check
                    className="h-4 w-4 text-primary shrink-0"
                    strokeWidth={2}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending || !selected}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {pending ? "Connecting…" : "Connect this account"}
          {!pending ? <ArrowRight className="h-3.5 w-3.5" /> : null}
        </button>
        {!state.ok && state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}

// Display the 10-digit customer ID as Google does: XXX-XXX-XXXX. Cosmetic
// only; we strip back to digits when posting.
function formatCustomerId(id: string): string {
  if (id.length !== 10) return id;
  return `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;
}
