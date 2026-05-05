"use client";

import { useActionState } from "react";
import {
  connectMetaAds,
  disconnectMetaAds,
  type ConnectMetaAdsResult,
} from "@/lib/actions/meta-ads-connect";
import { SyncButton } from "./google-ads-forms";
import { cn } from "@/lib/utils";

const INITIAL: ConnectMetaAdsResult = { ok: false, error: "" };

export function ConnectMetaAdsForm() {
  const [state, formAction, pending] = useActionState<
    ConnectMetaAdsResult,
    FormData
  >(async (_prev, fd) => connectMetaAds(fd), INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">
          Step 1 — Generate a System User access token in Business Manager
        </p>
        <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
          <li>
            Open{" "}
            <code className="font-mono text-foreground">
              business.facebook.com
            </code>{" "}
            and select the Business Manager that owns the ad account.
          </li>
          <li>
            Business Settings → Users → System Users → Add → give it Admin
            access.
          </li>
          <li>
            Click Generate New Token → select the app → scopes:{" "}
            <code className="font-mono text-foreground">ads_read</code> and{" "}
            <code className="font-mono text-foreground">ads_management</code>{" "}
            → set Token Expiration to Never. Copy the token now (only shown
            once).
          </li>
          <li>
            Still in Business Settings → Accounts → Ad Accounts → assign the
            ad account to the System User with at least Analyst access.
          </li>
        </ol>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-4">
        <p className="text-xs font-medium text-foreground">
          Step 2 — Paste your credentials
        </p>

        <Field
          label="Account label (shown in your dashboard)"
          name="displayName"
          placeholder="e.g. Prospecting · Instagram"
        />

        <Field
          label="System User access token"
          name="systemUserAccessToken"
          required
          type="password"
          autoComplete="off"
          mono
          hint="The never-expiring token from Step 1. Stored encrypted at rest."
        />

        <Field
          label="Ad account ID"
          name="adAccountId"
          required
          placeholder="1234567890 or act_1234567890"
          mono
          hint="The numeric ID at the top of your Meta Ads Manager URL. Either form works — we'll normalize it."
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {pending ? "Testing & connecting…" : "Connect Meta Ads"}
        </button>
        {state.ok ? (
          <span className="text-xs text-primary">
            Connected to {state.accountName ?? "ad account"}.
            {state.currency ? ` Currency: ${state.currency}.` : ""}
          </span>
        ) : state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}

export function MetaAdsManage({
  accountId,
  externalAccountId,
  displayName,
  currency,
  lastSyncAt,
  lastSyncError,
  accessStatus,
}: {
  accountId: string;
  externalAccountId: string;
  displayName: string | null;
  currency: string | null;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  accessStatus: string | null;
}) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailRow label="Account" value={displayName ?? "Meta Ads"} />
        <DetailRow
          label="Ad account ID"
          value={`act_${externalAccountId}`}
          mono
        />
        <DetailRow label="Currency" value={currency ?? "—"} />
        <DetailRow
          label="Last sync"
          value={lastSyncAt ? lastSyncAt.toLocaleString() : "Never"}
        />
        <DetailRow label="Status" value={accessStatus ?? "—"} />
      </dl>

      {lastSyncError ? (
        <p className="text-[11px] text-destructive rounded-md border border-destructive/30 bg-destructive/10 p-3">
          {lastSyncError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SyncButton accountId={accountId} kind="meta" />
        <DisconnectMetaAdsForm accountId={accountId} />
      </div>
    </div>
  );
}

export function DisconnectMetaAdsForm({ accountId }: { accountId: string }) {
  const [state, formAction, pending] = useActionState<
    { ok: boolean; error?: string },
    FormData
  >(async (_prev, fd) => disconnectMetaAds(fd), { ok: true });

  return (
    <form action={formAction} className="inline-flex items-center gap-3">
      <input type="hidden" name="accountId" value={accountId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-destructive hover:opacity-80 hover:underline underline-offset-2 disabled:opacity-60"
      >
        {pending ? "Disconnecting…" : "Disconnect"}
      </button>
      {!state.ok && state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  autoComplete,
  mono,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  mono?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(
          "rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
          mono && "font-mono text-[13px]"
        )}
      />
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm mt-0.5 break-all text-foreground",
          mono && "font-mono text-[12px]"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
