"use client";

import { useActionState, useState, useTransition } from "react";
import {
  connectAppfolio,
  disconnectAppfolio,
  triggerAppfolioSync,
  type ConnectAppfolioResult,
  type SyncAppfolioResult,
} from "@/lib/actions/appfolio-connect";

const CONNECT_INITIAL: ConnectAppfolioResult = { ok: true };

export function ConnectAppfolioForm() {
  const [state, formAction, pending] = useActionState<
    ConnectAppfolioResult,
    FormData
  >(async (_prev, formData) => connectAppfolio(formData), CONNECT_INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Subdomain
        </span>
        <input
          name="subdomain"
          required
          placeholder="sgrealestate"
          className="border rounded px-3 py-2 text-sm bg-background"
        />
        <span className="text-[11px] opacity-60">
          The part before <code>.appfolio.com</code> in your portal URL.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Client ID
        </span>
        <input
          name="clientId"
          required
          autoComplete="off"
          className="border rounded px-3 py-2 text-sm bg-background font-mono"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Client secret
        </span>
        <input
          name="clientSecret"
          type="password"
          required
          autoComplete="off"
          className="border rounded px-3 py-2 text-sm bg-background font-mono"
        />
        <span className="text-[11px] opacity-60">
          Stored encrypted at rest. You can rotate it at any time.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Plan
        </span>
        <select
          name="plan"
          defaultValue="plus"
          className="border rounded px-3 py-2 text-sm bg-background"
        >
          <option value="core">Core</option>
          <option value="plus">Plus</option>
          <option value="max">Max</option>
        </select>
        <span className="text-[11px] opacity-60">
          REST API access requires Plus or Max. Core tenants can still use
          the embed fallback for listings.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
        >
          {pending ? "Testing & connecting…" : "Connect AppFolio"}
        </button>
        {state && !state.ok && state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}

export function DisconnectAppfolioForm() {
  const [state, formAction, pending] = useActionState<
    ConnectAppfolioResult,
    FormData
  >(async () => disconnectAppfolio(), CONNECT_INITIAL);

  return (
    <form action={formAction} className="pt-3 border-t flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-destructive underline underline-offset-2 disabled:opacity-40"
      >
        {pending ? "Disconnecting…" : "Disconnect AppFolio"}
      </button>
      {state && !state.ok && state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
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
        className="bg-foreground text-background px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-40"
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
        <span className="text-xs text-destructive">
          {result.error}
        </span>
      ) : null}
    </div>
  );
}
