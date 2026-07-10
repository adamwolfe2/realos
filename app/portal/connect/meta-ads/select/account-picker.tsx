"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Briefcase, ArrowRight } from "lucide-react";
import {
  bindMetaAdsAccount,
  type BindMetaAdsResult,
} from "@/lib/actions/meta-ads-bind-account";
import type { AccessibleMetaAdAccount } from "@/lib/integrations/meta-ads";
import {
  AccountPickerList,
  ConnectStepper,
  type AccountPickerItem,
} from "@/components/portal/connect/account-picker-list";
import { VerificationRow } from "@/components/portal/ui/status-chip";

const INITIAL: BindMetaAdsResult = { ok: false, error: "" };

// Meta account_status mapping per Graph API docs.
const STATUS_LABEL: Record<number, string> = {
  1: "Active",
  2: "Disabled",
  3: "Unsettled",
  7: "Pending risk review",
  9: "In grace period",
  100: "Pending closure",
  101: "Closed",
  201: "Any active",
  202: "Any closed",
};

// Statuses that can never produce usable ad data — binding one would just
// yield a permanently-empty dashboard. These rows render disabled with the
// reason instead of letting the operator bind a dead account.
const UNBINDABLE_STATUSES = new Set([2, 100, 101]);

function isUnbindable(a: AccessibleMetaAdAccount): boolean {
  return a.accountStatus !== null && UNBINDABLE_STATUSES.has(a.accountStatus);
}

// ---------------------------------------------------------------------------
// AdAccountPicker — step 2 (Choose account) of the Meta OAuth journey.
// Meta equivalent of the Google Ads CustomerPicker; both render through the
// shared AccountPickerList so the two pickers can't drift.
//
// Disabled / Closed / Pending-closure accounts are gated (disabled row +
// reason). Other non-Active statuses (Unsettled, grace period, risk review)
// stay selectable with a warning badge — they can recover and start
// producing data.
//
// On bind success the picker mounts the Verify step in place — StatusChip
// Live + VerificationRow proof — instead of the old silent redirect.
// ---------------------------------------------------------------------------
export function AdAccountPicker({
  accounts,
}: {
  accounts: AccessibleMetaAdAccount[];
}) {
  const firstBindable =
    accounts.find((a) => !isUnbindable(a))?.externalAccountId ?? null;
  const [selected, setSelected] = useState<string | null>(firstBindable);
  const [boundLabel, setBoundLabel] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<
    BindMetaAdsResult,
    FormData
  >(async (_prev, fd) => {
    const result = await bindMetaAdsAccount(fd);
    if (result.ok) {
      const id = fd.get("externalAccountId")?.toString() ?? "";
      const name = fd.get("displayName")?.toString();
      setBoundLabel(name && name.length > 0 ? `${name} · ${id}` : id);
    }
    return result;
  }, INITIAL);

  const chosen = accounts.find((a) => a.externalAccountId === selected);

  if (state.ok) {
    return (
      <div className="space-y-5">
        <ConnectStepper current={3} />
        <div className="rounded-[2px] border border-border bg-card p-4 space-y-3">
          <VerificationRow
            status="live"
            accountLabel={boundLabel ?? "Meta ad account"}
          />
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Account bound. The first backfill is running in the background —
            campaign metrics appear on your Ads dashboard as data lands.
          </p>
          <div className="flex items-center gap-4 flex-wrap pt-1">
            <Link
              href="/portal/ads?oauth=meta_ads_bound"
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

  const items: AccountPickerItem[] = accounts.map((a) => {
    const gated = isUnbindable(a);
    const statusLabel =
      a.accountStatus !== null && a.accountStatus !== 1
        ? (STATUS_LABEL[a.accountStatus] ?? "Inactive")
        : null;
    return {
      id: a.externalAccountId,
      name: a.name ?? "Untitled ad account",
      icon: Briefcase,
      detail: [a.externalAccountId, a.currency ?? null, a.businessName ?? null]
        .filter(Boolean)
        .join(" · "),
      badge: statusLabel ? { label: statusLabel, tone: "warning" } : null,
      disabled: gated,
      disabledReason: gated
        ? `Meta reports this account as ${statusLabel ?? "inactive"} — it can't be bound until it's active again in Meta Ads Manager.`
        : null,
    };
  });

  return (
    <form action={formAction} className="space-y-5">
      <ConnectStepper current={2} />
      <input
        type="hidden"
        name="externalAccountId"
        value={selected ?? ""}
      />
      <input type="hidden" name="displayName" value={chosen?.name ?? ""} />
      <input
        type="hidden"
        name="currencyCode"
        value={chosen?.currency ?? ""}
      />

      <AccountPickerList
        items={items}
        selectedId={selected}
        onSelect={setSelected}
      />

      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <button
          type="submit"
          disabled={pending || !selected}
          className="inline-flex items-center gap-1.5 rounded-none bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {pending ? "Connecting…" : "Connect this account"}
          {!pending ? <ArrowRight className="h-3.5 w-3.5" /> : null}
        </button>
        {firstBindable === null ? (
          <span className="text-xs text-muted-foreground">
            None of these accounts are active in Meta, so there&apos;s nothing
            to bind yet.
          </span>
        ) : null}
        {!state.ok && state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
