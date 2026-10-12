"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Search } from "lucide-react";
import {
  bindSeoProperty,
  type BindSeoPropertyResult,
} from "@/lib/actions/seo-oauth-bind";
import type {
  GooglePropertyOption,
  SeoPickerProvider,
} from "@/lib/integrations/google-properties";
import {
  AccountPickerList,
  ConnectStepper,
  type AccountPickerItem,
} from "@/components/portal/connect/account-picker-list";
import { VerificationRow } from "@/components/portal/ui/status-chip";

const INITIAL: BindSeoPropertyResult = { ok: false, error: "" };

// Step 2 of the GA4 / Search Console Google sign-in: pick the property.
// Same shared list + stepper as the Google Ads and Meta pickers.
export function SeoPropertyPicker({
  provider,
  options,
}: {
  provider: SeoPickerProvider;
  options: GooglePropertyOption[];
}) {
  const [selected, setSelected] = useState<string | null>(
    options[0]?.id ?? null,
  );
  const [state, formAction, pending] = useActionState<
    BindSeoPropertyResult,
    FormData
  >(async (_prev, fd) => bindSeoProperty(fd), INITIAL);

  if (state.ok) {
    return (
      <div className="space-y-5">
        <ConnectStepper current={3} />
        <div className="ls-card p-4 space-y-3">
          <VerificationRow status="live" accountLabel={state.label} />
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Connected. The first backfill is running in the background; data
            appears on your SEO dashboard as it lands.
          </p>
          <div className="flex items-center gap-4 flex-wrap pt-1">
            <Link
              href="/portal/seo"
              className="inline-flex items-center gap-1.5 rounded-none bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              View SEO dashboard
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

  const icon = provider === "GA4" ? BarChart3 : Search;
  const items: AccountPickerItem[] = options.map((o) => ({
    id: o.id,
    name: o.name,
    icon,
    detail: o.detail ?? o.id,
  }));

  return (
    <form action={formAction} className="space-y-5">
      <ConnectStepper current={2} />
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="propertyIdentifier" value={selected ?? ""} />
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
          {pending ? "Connecting…" : "Connect this property"}
          {!pending ? <ArrowRight className="h-3.5 w-3.5" /> : null}
        </button>
        {!state.ok && state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
