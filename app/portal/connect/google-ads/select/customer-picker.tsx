"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, Network, ArrowRight } from "lucide-react";
import {
  bindGoogleAdsCustomer,
  type BindGoogleAdsResult,
} from "@/lib/actions/google-ads-bind-customer";
import type { AccessibleCustomer } from "@/lib/integrations/google-ads";
import {
  AccountPickerList,
  ConnectStepper,
  type AccountPickerItem,
} from "@/components/portal/connect/account-picker-list";
import { VerificationRow } from "@/components/portal/ui/status-chip";

const INITIAL: BindGoogleAdsResult = { ok: false, error: "" };

// ---------------------------------------------------------------------------
// CustomerPicker — step 2 (Choose account) of the OAuth journey.
//
// One row per accessible customer via the shared AccountPickerList. Manager
// (MCC) accounts are marked but selectable — picking an MCC binds it directly
// (the dashboard will show metrics for the whole MCC). Picking a leaf
// customer under an MCC stores the parent MCC as loginCustomerId so sync
// queries scope correctly.
//
// On bind success the picker mounts the Verify step in place — StatusChip
// Live + VerificationRow proof — instead of the old silent redirect to
// /portal/ads. Backfill stays fire-and-forget on the server; only the
// success rendering changed.
// ---------------------------------------------------------------------------
export function CustomerPicker({
  customers,
}: {
  customers: AccessibleCustomer[];
}) {
  const [selected, setSelected] = useState<string | null>(
    customers[0]?.customerId ?? null
  );
  // Captured at submit time so the Verify panel can name the account even
  // if selection state were to change afterwards.
  const [boundLabel, setBoundLabel] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<
    BindGoogleAdsResult,
    FormData
  >(async (_prev, fd) => {
    const result = await bindGoogleAdsCustomer(fd);
    if (result.ok) {
      const id = fd.get("customerId")?.toString() ?? "";
      const name = fd.get("displayName")?.toString();
      setBoundLabel(
        name && name.length > 0
          ? `${name} · ${formatCustomerId(id)}`
          : formatCustomerId(id)
      );
    }
    return result;
  }, INITIAL);

  const chosen = customers.find((c) => c.customerId === selected);

  if (state.ok) {
    return (
      <div className="space-y-5">
        <ConnectStepper current={3} />
        <div className="rounded-[2px] border border-border bg-card p-4 space-y-3">
          <VerificationRow
            status="live"
            accountLabel={boundLabel ?? "Google Ads account"}
          />
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Account bound. The first backfill is running in the background —
            campaign metrics appear on your Ads dashboard as data lands.
          </p>
          <div className="flex items-center gap-4 flex-wrap pt-1">
            <Link
              href="/portal/ads?oauth=google_ads_bound"
              className="inline-flex items-center gap-1.5 rounded-none bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              View Ads dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/portal/connect"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Back to data sources
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const items: AccountPickerItem[] = customers.map((c) => ({
    id: c.customerId,
    name: c.descriptiveName ?? "Untitled account",
    icon: c.isManager ? Network : Building2,
    detail: [
      formatCustomerId(c.customerId),
      c.currencyCode ?? null,
      c.timeZone ?? null,
    ]
      .filter(Boolean)
      .join(" · "),
    badge: c.isManager ? { label: "Manager (MCC)", tone: "neutral" } : null,
  }));

  return (
    <form action={formAction} className="space-y-5">
      <ConnectStepper current={2} />
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

      <AccountPickerList
        items={items}
        selectedId={selected}
        onSelect={setSelected}
      />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending || !selected}
          className="inline-flex items-center gap-1.5 rounded-none bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
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
