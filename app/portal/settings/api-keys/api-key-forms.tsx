"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createApiKey,
  revokeApiKey,
  type CreateApiKeyResult,
} from "@/lib/actions/api-keys";

const SCOPE_OPTIONS = [
  { value: "ingest:lead", label: "Leads" },
  { value: "ingest:visitor", label: "Visitors" },
  { value: "ingest:tour", label: "Tours" },
  { value: "ingest:chatbot", label: "Chatbot" },
] as const;

const CREATE_INITIAL: CreateApiKeyResult = {
  ok: false,
  error: "",
};

export function CreateApiKeyForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    CreateApiKeyResult,
    FormData
  >(async (_prev, formData) => createApiKey(formData), CREATE_INITIAL);

  const justCreated = state.ok ? state : null;

  return (
    <div className="space-y-4">
      {justCreated ? (
        <NewKeyBanner
          rawKey={justCreated.rawKey}
          name={justCreated.name}
          scopes={justCreated.scopes}
        />
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold rounded"
        >
          Create new key
        </button>
      ) : (
        <form action={formAction} className="space-y-4 border rounded-md p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs tracking-widest uppercase opacity-70">
              Name
            </span>
            <input
              name="name"
              required
              maxLength={100}
              placeholder="Zapier production"
              className="border rounded px-3 py-2 text-sm bg-background"
            />
            <span className="text-[11px] opacity-60">
              Operator-facing label so you can tell keys apart later.
            </span>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs tracking-widest uppercase opacity-70">
              Scopes
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {SCOPE_OPTIONS.map((s) => (
                <label
                  key={s.value}
                  className="flex items-center gap-2 text-sm border rounded px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="scopes"
                    value={s.value}
                    defaultChecked
                  />
                  <span>{s.label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm border rounded px-3 py-2 cursor-pointer col-span-2">
                <input type="checkbox" name="scopes" value="*" />
                <span>
                  Grant all current and future ingest scopes (
                  <code className="font-mono">*</code>)
                </span>
              </label>
            </div>
            <p className="text-[11px] opacity-60">
              Choosing the wildcard overrides the specific boxes.
            </p>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
            >
              {pending ? "Generating…" : "Generate key"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs opacity-70 underline underline-offset-2"
            >
              Cancel
            </button>
            {state && !state.ok && state.error ? (
              <span className="text-xs text-destructive">{state.error}</span>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}

function NewKeyBanner({
  rawKey,
  name,
  scopes,
}: {
  rawKey: string;
  name: string;
  scopes: string[];
}) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Best-effort.
    }
  }

  return (
    <div className="border-2 border-amber-500/60 bg-amber-500/10 rounded-md p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            Copy this key now — it won't be shown again.
          </p>
          <p className="text-[11px] opacity-70 mt-1">
            We only store a hash. If you lose the raw key, revoke this one and
            generate a new one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[11px] opacity-70 underline underline-offset-2"
        >
          Dismiss
        </button>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-[11px] bg-background border rounded px-3 py-2 overflow-x-auto whitespace-nowrap">
          {rawKey}
        </code>
        <button
          type="button"
          onClick={copy}
          className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-2 text-xs font-semibold rounded"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] opacity-70">
        Key <span className="font-mono">{name}</span> · scopes:{" "}
        <span className="font-mono">{scopes.join(", ")}</span>
      </p>
    </div>
  );
}

export function RevokeApiKeyButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Revoke "${name}"? Any integrations using this key will stop working immediately.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await revokeApiKey(id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-xs text-destructive underline underline-offset-2 disabled:opacity-40"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
