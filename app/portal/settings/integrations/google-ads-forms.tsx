"use client";

import { useActionState, useTransition, useState } from "react";
import {
  connectGoogleAds,
  disconnectGoogleAds,
  triggerGoogleAdsSync,
  type ConnectGoogleAdsResult,
} from "@/lib/actions/google-ads-connect";
import { cn } from "@/lib/utils";

const INITIAL: ConnectGoogleAdsResult = { ok: false, error: "" };

export function ConnectGoogleAdsForm() {
  const [state, formAction, pending] = useActionState<
    ConnectGoogleAdsResult,
    FormData
  >(async (_prev, fd) => connectGoogleAds(fd), INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">
          Step 1 — Generate an OAuth refresh token
        </p>
        <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
          <li>
            Open Google Cloud Console → APIs &amp; Services → Credentials →
            Create OAuth client ID (Web application). Note the Client ID and
            Client Secret.
          </li>
          <li>
            Visit{" "}
            <code className="font-mono text-foreground">
              developers.google.com/oauthplayground
            </code>{" "}
            → gear icon → check &quot;Use your own OAuth credentials&quot; →
            paste the Client ID and Secret.
          </li>
          <li>
            Under APIs, scroll to Google Ads API → select scope{" "}
            <code className="font-mono text-foreground">
              https://www.googleapis.com/auth/adwords
            </code>{" "}
            → Authorize → Exchange authorization code for tokens. Copy the
            refresh token.
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
          placeholder="e.g. Brand Search · Primary"
        />

        <Field
          label="Client customer ID"
          name="clientCustomerId"
          required
          placeholder="123-456-7890"
          mono
          hint="The Google Ads account whose metrics you want. 10 digits, dashes optional. Found in Google Ads → top-right of any page."
        />

        <Field
          label="OAuth client ID"
          name="oauthClientId"
          required
          autoComplete="off"
          mono
          hint="The Client ID from Step 1."
        />

        <Field
          label="OAuth client secret"
          name="oauthClientSecret"
          required
          type="password"
          autoComplete="off"
          mono
          hint="The Client Secret from Step 1. Stored encrypted at rest."
        />

        <Field
          label="Refresh token"
          name="refreshToken"
          required
          type="password"
          autoComplete="off"
          mono
          hint="The refresh token from the OAuth Playground in Step 1. We exchange it for short-lived access tokens at sync time."
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {pending ? "Testing & connecting…" : "Connect Google Ads"}
        </button>
        {state.ok ? (
          <span className="text-xs text-emerald-700">
            Connected. {state.currency ? `Currency: ${state.currency}.` : ""}
            First backfill is running.
          </span>
        ) : state.error ? (
          <span className="text-xs text-rose-700">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}

export function GoogleAdsManage({
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
        <DetailRow label="Account" value={displayName ?? "Google Ads"} />
        <DetailRow label="Customer ID" value={externalAccountId} mono />
        <DetailRow label="Currency" value={currency ?? "—"} />
        <DetailRow
          label="Last sync"
          value={lastSyncAt ? lastSyncAt.toLocaleString() : "Never"}
        />
        <DetailRow label="Status" value={accessStatus ?? "—"} />
      </dl>

      {lastSyncError ? (
        <p className="text-[11px] text-rose-700 rounded-md border border-rose-200 bg-rose-50 p-3">
          {lastSyncError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SyncButton accountId={accountId} kind="google" />
        <DisconnectGoogleAdsForm accountId={accountId} />
      </div>
    </div>
  );
}

export function DisconnectGoogleAdsForm({ accountId }: { accountId: string }) {
  const [state, formAction, pending] = useActionState<
    { ok: boolean; error?: string },
    FormData
  >(async (_prev, fd) => disconnectGoogleAds(fd), { ok: true });

  return (
    <form action={formAction} className="inline-flex items-center gap-3">
      <input type="hidden" name="accountId" value={accountId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-rose-700 hover:text-rose-900 hover:underline underline-offset-2 disabled:opacity-60"
      >
        {pending ? "Disconnecting…" : "Disconnect"}
      </button>
      {!state.ok && state.error ? (
        <span className="text-xs text-rose-700">{state.error}</span>
      ) : null}
    </form>
  );
}

export function SyncButton({
  accountId,
  kind,
}: {
  accountId: string;
  kind: "google" | "meta";
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { ok: true; campaigns: number; metrics: number }
    | { ok: false; error: string }
    | null
  >(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      if (kind === "google") {
        const r = await triggerGoogleAdsSync(accountId);
        setResult(r);
      } else {
        const { triggerMetaAdsSync } = await import(
          "@/lib/actions/meta-ads-connect"
        );
        const r = await triggerMetaAdsSync(accountId);
        setResult(r);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-60 transition-colors"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {result && result.ok ? (
        <span className="text-xs text-emerald-700">
          Synced {result.campaigns} campaigns, {result.metrics} metric rows.
        </span>
      ) : null}
      {result && !result.ok ? (
        <span className="text-xs text-rose-700">{result.error}</span>
      ) : null}
    </div>
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
