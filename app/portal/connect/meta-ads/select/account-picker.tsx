"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ArrowRight, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bindMetaAdsAccount,
  type BindMetaAdsResult,
} from "@/lib/actions/meta-ads-bind-account";
import type { AccessibleMetaAdAccount } from "@/lib/integrations/meta-ads";

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

export function AdAccountPicker({
  accounts,
}: {
  accounts: AccessibleMetaAdAccount[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(
    accounts[0]?.externalAccountId ?? null,
  );
  const [state, formAction, pending] = useActionState<
    BindMetaAdsResult,
    FormData
  >(async (_prev, fd) => {
    const result = await bindMetaAdsAccount(fd);
    if (result.ok) {
      router.push("/portal/ads?oauth=meta_ads_bound");
    }
    return result;
  }, INITIAL);

  const chosen = accounts.find((a) => a.externalAccountId === selected);

  return (
    <form action={formAction} className="space-y-5">
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

      <ul className="space-y-2">
        {accounts.map((a) => {
          const isSelected = a.externalAccountId === selected;
          const isInactive =
            a.accountStatus !== null && a.accountStatus !== 1;
          return (
            <li key={a.externalAccountId}>
              <button
                type="button"
                onClick={() => setSelected(a.externalAccountId)}
                className={cn(
                  "w-full text-left rounded-md border px-4 py-3 flex items-center gap-3 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <Briefcase
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {a.name ?? "Untitled ad account"}
                    </span>
                    {isInactive ? (
                      <span className="text-[10px] uppercase tracking-wide rounded border border-amber-400/40 bg-amber-50 px-1.5 py-0.5 text-amber-800 inline-flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        {STATUS_LABEL[a.accountStatus!] ?? "Inactive"}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    {a.externalAccountId}
                    {a.currency ? ` · ${a.currency}` : ""}
                    {a.businessName ? ` · ${a.businessName}` : ""}
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
