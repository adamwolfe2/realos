"use client";

import { useActionState, useState, useTransition } from "react";
import {
  connectSeo,
  disconnectSeo,
  triggerSeoSync,
  type ConnectSeoResult,
  type SyncSeoResult,
} from "@/lib/actions/seo-connect";
import { cn } from "@/lib/utils";

const CONNECT_INITIAL: ConnectSeoResult = { ok: true, provider: "GSC" };

type Provider = "GSC" | "GA4";

// ConnectSeoForm renders identical fields for GSC and GA4 with provider-aware
// help text. The action server-side validates with Zod and probes the API
// before persisting anything.
export function ConnectSeoForm({ provider }: { provider: Provider }) {
  const [state, formAction, pending] = useActionState<
    ConnectSeoResult,
    FormData
  >(async (_prev, formData) => connectSeo(formData), CONNECT_INITIAL);

  const isGsc = provider === "GSC";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="provider" value={provider} />

      <Field
        label={isGsc ? "Site URL" : "GA4 property ID"}
        name="propertyIdentifier"
        placeholder={
          isGsc ? "https://www.example.com/" : "338445667"
        }
        required
        mono
        hint={
          isGsc ? (
            <>
              From Search Console, paste the full property URL (URL-prefix
              property) or use the format{" "}
              <code className="font-mono">sc-domain:example.com</code> for a
              domain property.
            </>
          ) : (
            <>
              From GA4 Admin to Property Settings to Property ID. Numeric
              only, e.g. <code className="font-mono">338445667</code>. This is
              not the <code className="font-mono">G-XXXX</code> measurement
              tag.
            </>
          )
        }
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground">
          Service account JSON
        </span>
        <textarea
          name="serviceAccountJson"
          required
          rows={6}
          placeholder={`{\n  "type": "service_account",\n  "project_id": "...",\n  "client_email": "seo-pull@your-project.iam.gserviceaccount.com",\n  "private_key": "..."\n}`}
          className="rounded-md border border-border bg-background px-3 py-2 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-[11px] text-muted-foreground leading-relaxed">
          Paste the full JSON file you downloaded from Google Cloud Console.
          We encrypt it at rest and never display the private key in the UI.
          Make sure the service account&apos;s{" "}
          <code className="font-mono">client_email</code> has been added as a
          {isGsc ? " user with at least Restricted permission on the GSC site" : " Viewer on the GA4 property"}
          .
        </span>
      </label>

      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {pending
            ? "Testing & connecting…"
            : `Connect ${isGsc ? "Search Console" : "Analytics"}`}
        </button>
        {state && !state.ok && state.error ? (
          <span className="text-xs text-rose-700">{state.error}</span>
        ) : null}
        {state && state.ok && state.provider === provider ? (
          <span className="text-xs text-emerald-700">
            Connected
            {state.propertyDisplayName
              ? ` to ${state.propertyDisplayName}`
              : state.permissionLevel
                ? ` (${state.permissionLevel})`
                : ""}
            . First backfill is running in the background.
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function DisconnectSeoForm({ provider }: { provider: Provider }) {
  const [state, formAction, pending] = useActionState<
    ConnectSeoResult,
    FormData
  >(async (_prev, formData) => disconnectSeo(formData), CONNECT_INITIAL);

  return (
    <form action={formAction} className="inline-flex items-center gap-3">
      <input type="hidden" name="provider" value={provider} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-rose-700 hover:text-rose-900 hover:underline underline-offset-2 disabled:opacity-60"
      >
        {pending ? "Disconnecting…" : `Disconnect ${provider}`}
      </button>
      {state && !state.ok && state.error ? (
        <span className="text-xs text-rose-700">{state.error}</span>
      ) : null}
    </form>
  );
}

export function SyncSeoButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncSeoResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const r = await triggerSeoSync();
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
          Pulled {result.stats.gscDays} GSC days, {result.stats.gscQueries}{" "}
          queries, {result.stats.ga4Days} GA4 days,{" "}
          {result.stats.ga4LandingPages} landing pages.
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
          mono && "font-mono text-[13px]",
        )}
      />
      {hint ? (
        <span className="text-[11px] text-muted-foreground leading-relaxed">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
