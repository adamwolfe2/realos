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

const CONNECT_INITIAL: ConnectAppfolioResult = { ok: true, mode: "embed" };

type Mode = "embed" | "rest";

export function ConnectAppfolioForm() {
  const [mode, setMode] = useState<Mode>("rest");
  const [state, formAction, pending] = useActionState<
    ConnectAppfolioResult,
    FormData
  >(async (_prev, formData) => connectAppfolio(formData), CONNECT_INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="authMode" value={mode} />

      <div className="space-y-2">
        <span className="text-xs font-medium text-foreground">
          Connection type
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ModeCard
            active={mode === "rest"}
            onClick={() => setMode("rest")}
            title="Developer Portal API"
            body="Plus/Max plans. Reports API Client ID + Client Secret. Full lead + unit sync."
          />
          <ModeCard
            active={mode === "embed"}
            onClick={() => setMode("embed")}
            title="Public listings (Core)"
            body="No credentials required. We scrape the public listings page for available units."
          />
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

      {mode === "rest" ? (
        <>
          <Field
            label="Client ID"
            name="clientId"
            required
            autoComplete="off"
            mono
            hint="From AppFolio → Settings → API Settings → Reports API."
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
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Plan</span>
            <select
              name="plan"
              defaultValue="plus"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="plus">Plus</option>
              <option value="max">Max</option>
            </select>
            <span className="text-[11px] text-muted-foreground">
              Reports API requires Plus or Max.
            </span>
          </label>
        </>
      ) : (
        <Field
          label="Address filter (optional)"
          name="addressFilter"
          placeholder="e.g. 2490 Channing"
          hint="If your AppFolio account manages multiple properties, paste a snippet of the address to filter to just this property's units."
        />
      )}

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
        {state && state.ok && state.mode && state.listingsFound != null ? (
          <span className="text-xs text-emerald-700">
            Connected — found {state.listingsFound} listing
            {state.listingsFound === 1 ? "" : "s"}.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
        {body}
      </div>
    </button>
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
