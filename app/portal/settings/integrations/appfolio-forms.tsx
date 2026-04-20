"use client";

import { useActionState, useState, useTransition } from "react";
import {
  connectAppfolio,
  disconnectAppfolio,
  triggerAppfolioSync,
  type ConnectAppfolioResult,
  type SyncAppfolioResult,
} from "@/lib/actions/appfolio-connect";
import { cn } from "@/lib/utils";

const CONNECT_INITIAL: ConnectAppfolioResult = { ok: true };

export function ConnectAppfolioForm() {
  const [authMode, setAuthMode] = useState<"oauth" | "api_key">("api_key");
  const [state, formAction, pending] = useActionState<
    ConnectAppfolioResult,
    FormData
  >(async (_prev, formData) => connectAppfolio(formData), CONNECT_INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="authMode" value={authMode} />

      <div className="space-y-2">
        <span className="text-xs font-medium text-foreground">
          Authentication
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAuthMode("api_key")}
            className={cn(
              "rounded-md border p-3 text-left transition-colors",
              authMode === "api_key"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:bg-muted/50",
            )}
          >
            <div className="text-sm font-semibold text-foreground">
              API key
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Paste a single AppFolio API key. Easiest to set up.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("oauth")}
            className={cn(
              "rounded-md border p-3 text-left transition-colors",
              authMode === "oauth"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:bg-muted/50",
            )}
          >
            <div className="text-sm font-semibold text-foreground">
              OAuth credentials
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Client ID + secret from the AppFolio Developer Portal.
            </div>
          </button>
        </div>
      </div>

      <Field
        label="Subdomain"
        name="subdomain"
        placeholder="sgrealestate"
        required
        hint={
          <>
            The part before <code>.appfolio.com</code> in your portal URL.
          </>
        }
      />

      {authMode === "api_key" ? (
        <Field
          label="API key"
          name="apiKey"
          type="password"
          required
          autoComplete="off"
          mono
          hint="Stored encrypted at rest. You can rotate it at any time."
        />
      ) : (
        <>
          <Field
            label="Client ID"
            name="clientId"
            required
            autoComplete="off"
            mono
          />
          <Field
            label="Client secret"
            name="clientSecret"
            type="password"
            required
            autoComplete="off"
            mono
            hint="Stored encrypted at rest. You can rotate it at any time."
          />
        </>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground">Plan</span>
        <select
          name="plan"
          defaultValue="plus"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="core">Core</option>
          <option value="plus">Plus</option>
          <option value="max">Max</option>
        </select>
        <span className="text-[11px] text-muted-foreground">
          REST API access requires Plus or Max.
        </span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {pending ? "Testing & connecting…" : "Connect AppFolio"}
        </button>
        {state && !state.ok && state.error ? (
          <span className="text-xs text-rose-700">{state.error}</span>
        ) : null}
      </div>
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
          mono && "font-mono text-[13px]",
        )}
      />
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function DisconnectAppfolioForm() {
  const [state, formAction, pending] = useActionState<
    ConnectAppfolioResult,
    FormData
  >(async () => disconnectAppfolio(), CONNECT_INITIAL);

  return (
    <form action={formAction} className="inline-flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-rose-700 hover:text-rose-900 hover:underline underline-offset-2 disabled:opacity-60"
      >
        {pending ? "Disconnecting…" : "Disconnect AppFolio"}
      </button>
      {state && !state.ok && state.error ? (
        <span className="text-xs text-rose-700">{state.error}</span>
      ) : null}
    </form>
  );
}

export function SyncAppfolioButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncAppfolioResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const r = await triggerAppfolioSync();
      setResult(r);
    });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {result && result.ok ? (
        <span className="text-xs text-emerald-700">
          Synced {result.stats.leadsUpserted} leads,{" "}
          {result.stats.toursUpserted} tours,{" "}
          {result.stats.tenantsMatched} tenants,{" "}
          {result.stats.listingsUpserted} listings
          {result.stats.warnings.length > 0
            ? ` (${result.stats.warnings.length} warnings)`
            : ""}
          .
        </span>
      ) : null}
      {result && !result.ok ? (
        <span className="text-xs text-rose-700">{result.error}</span>
      ) : null}
    </div>
  );
}
