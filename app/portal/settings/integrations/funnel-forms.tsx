"use client";

import { useActionState, useState } from "react";
import {
  connectFunnel,
  disconnectFunnel,
  type ConnectFunnelResult,
} from "@/lib/actions/funnel-connect";
import { cn } from "@/lib/utils";

const INITIAL: ConnectFunnelResult = { ok: true, enabled: false };

// Sentinel value the write-only key field submits when the operator leaves the
// stored key untouched on an existing connection (keeps the encrypted key).
const KEEP_EXISTING_KEY = "__KEEP__";

export function ConnectFunnelForm({
  connected = false,
  hasKey = false,
  apiBaseUrl = "",
  groupId = "",
  discoverySourceId = "",
  enabled = false,
  lastPushAt = null,
  lastError = null,
}: {
  connected?: boolean;
  hasKey?: boolean;
  apiBaseUrl?: string;
  groupId?: string;
  discoverySourceId?: string;
  enabled?: boolean;
  lastPushAt?: string | null;
  lastError?: string | null;
}) {
  // On an existing connection the key field starts empty (write-only) and we
  // submit the sentinel unless the operator types a new key.
  const [apiKey, setApiKey] = useState("");
  const [state, formAction, pending] = useActionState<
    ConnectFunnelResult,
    FormData
  >(async (_prev, formData) => {
    // If the operator didn't type a new key but one is already stored, submit
    // the sentinel so the action preserves it.
    if (hasKey && apiKey.trim().length === 0) {
      formData.set("apiKey", KEEP_EXISTING_KEY);
    }
    return connectFunnel(formData);
  }, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Push captured leads into Funnel Leasing
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          When a lead is captured (chatbot, popup, form, tour), LeaseStack
          creates a matching Prospect in your Funnel account — the chatbot
          transcript lands in the prospect&apos;s notes. This never blocks lead
          capture: if Funnel is unreachable, we log it and move on.
        </p>
      </div>

      <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
        <Field
          label="Funnel Customer API key"
          name="apiKey"
          type="password"
          mono
          autoComplete="new-password"
          data-1p-ignore="true"
          data-lpignore="true"
          value={apiKey}
          placeholder={hasKey ? "•••••••• (stored — leave blank to keep)" : ""}
          onChange={setApiKey}
          hint="Request this from Funnel support — it's issued per Funnel account (account-level, not per property). Stored encrypted at rest; never shown again."
        />

        <Field
          label="API base URL"
          name="apiBaseUrl"
          mono
          defaultValue={apiBaseUrl}
          placeholder="https://…"
          hint="Confirm your account's Funnel API host with Funnel support before enabling — it isn't published in the general docs. Example shape: https://api.funnelleasing.com"
        />

        <Field
          label="Group id"
          name="groupId"
          mono
          defaultValue={groupId}
          placeholder="e.g. 1234"
          hint="Funnel's internal grouping id for your account (a whole number). Ask Funnel support if you don't know it."
        />

        <Field
          label="Discovery source id (optional)"
          name="discoverySourceId"
          mono
          defaultValue={discoverySourceId}
          hint="A lead-source id from your account's Discovery Sources list. Leave blank if you don't attribute a source, or ask Funnel to add a 'LeaseStack' source."
        />
      </div>

      <label className="flex items-start gap-2.5 rounded-md border border-border bg-card p-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span className="text-[12px] leading-snug text-foreground">
          <span className="font-medium">Enable live pushing</span>
          <span className="block text-muted-foreground">
            Off = fully configured but disconnected (nothing is sent). Turn on
            only once the API key, base URL, and group id are confirmed.
          </span>
        </span>
      </label>

      {connected && (lastPushAt || lastError) ? (
        <div className="rounded-md border border-border bg-muted/20 p-3 text-[11px] space-y-1">
          {lastPushAt ? (
            <p className="text-muted-foreground">
              Last push attempt:{" "}
              <span className="text-foreground">
                {new Date(lastPushAt).toLocaleString()}
              </span>
            </p>
          ) : null}
          {lastError ? (
            <p className="text-destructive break-words">
              Last error: {lastError}
            </p>
          ) : (
            <p className="text-primary">No recent errors.</p>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-1 flex-wrap border-t border-border">
        <button
          type="submit"
          disabled={pending}
          className="mt-3 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : connected ? "Save changes" : "Save & connect"}
        </button>
        {state && !state.ok && state.error ? (
          <span className="mt-3 text-xs text-destructive">{state.error}</span>
        ) : null}
        {state && state.ok && state.enabled ? (
          <span className="mt-3 text-xs text-primary">
            Saved — Funnel push is live.
          </span>
        ) : state && state.ok && connected ? (
          <span className="mt-3 text-xs text-muted-foreground">Saved.</span>
        ) : null}
      </div>

      {connected ? <DisconnectFunnelForm /> : null}
    </form>
  );
}

export function DisconnectFunnelForm() {
  const [state, formAction, pending] = useActionState<
    ConnectFunnelResult,
    FormData
  >(async () => disconnectFunnel(), INITIAL);

  return (
    <div className="pt-3 border-t border-border">
      <form action={formAction} className="inline-flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="text-xs font-medium text-destructive hover:underline underline-offset-2 disabled:opacity-60"
        >
          {pending ? "Disconnecting…" : "Disconnect Funnel"}
        </button>
        {state && !state.ok && state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  mono,
  hint,
  value,
  defaultValue,
  placeholder,
  autoComplete,
  onChange,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  mono?: boolean;
  hint?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
  onChange?: (v: string) => void;
  [key: `data-${string}`]: string | undefined;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        {...rest}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
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
