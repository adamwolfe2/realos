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

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; listingsFound?: number }
  | { status: "error"; error: string };

export function ConnectAppfolioForm() {
  const [mode, setMode] = useState<Mode>("rest");
  const [subdomain, setSubdomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [addressFilter, setAddressFilter] = useState("");
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [isTesting, startTestTransition] = useTransition();

  const [state, formAction, pending] = useActionState<
    ConnectAppfolioResult,
    FormData
  >(async (_prev, formData) => connectAppfolio(formData), CONNECT_INITIAL);

  // Reset test state whenever credentials change so users can't submit
  // stale-tested credentials.
  function resetTest() {
    setTestState({ status: "idle" });
  }

  function handleTest() {
    setTestState({ status: "testing" });
    startTestTransition(async () => {
      try {
        const body =
          mode === "embed"
            ? { mode: "embed" as const, subdomain: normalizeSubdomain(subdomain) }
            : {
                mode: "rest" as const,
                subdomain: normalizeSubdomain(subdomain),
                clientId,
                clientSecret,
              };

        const res = await fetch("/api/tenant/appfolio/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as
          | { ok: true; listingsFound?: number }
          | { ok: false; error: string };

        if (data.ok) {
          setTestState({
            status: "ok",
            listingsFound: (data as { ok: true; listingsFound?: number })
              .listingsFound,
          });
        } else {
          setTestState({ status: "error", error: (data as { ok: false; error: string }).error });
        }
      } catch {
        setTestState({ status: "error", error: "Network error — could not reach test endpoint." });
      }
    });
  }

  const canTest =
    subdomain.trim().length > 0 &&
    (mode === "embed" || (clientId.trim().length > 0 && clientSecret.trim().length > 0));

  const testPassed = testState.status === "ok";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="authMode" value={mode} />

      <div className="space-y-2">
        <span className="text-xs font-medium text-foreground">
          Step 1 — Choose your connection type
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ModeCard
            active={mode === "embed"}
            onClick={() => { setMode("embed"); resetTest(); }}
            title="Public listings (any plan)"
            body="No credentials required. We scrape the public listings page for available units. Works for every AppFolio plan."
          />
          <ModeCard
            active={mode === "rest"}
            onClick={() => { setMode("rest"); resetTest(); }}
            title="Developer Portal API (Plus/Max)"
            body="Full lead and unit sync via the Reports API. Requires a Client ID and Client Secret from AppFolio Developer Portal."
          />
        </div>
      </div>

      <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-foreground">
          Step 2 — Enter your AppFolio details
        </p>
        <Field
          label="AppFolio subdomain"
          name="subdomain"
          placeholder="your-company"
          required
          value={subdomain}
          onChange={(v) => { setSubdomain(v); resetTest(); }}
          hint={
            <>
              The part before <code className="font-mono">.appfolio.com</code>{" "}
              in your portal URL. If you log in at{" "}
              <code className="font-mono">acme.appfolio.com</code>, enter{" "}
              <code className="font-mono">acme</code>.
            </>
          }
        />

        {mode === "rest" ? (
          <>
            <Field
              label="Reports API Client ID"
              // Non-standard name so password managers don't try to
              // suggest a saved entry from the user's personal AppFolio.
              // Audit BUG #2 — agency operators impersonate tenants on
              // shared screens and we never want their personal creds
              // pre-filling someone else's form.
              name="clientId"
              required
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              mono
              value={clientId}
              onChange={(v) => { setClientId(v); resetTest(); }}
              hint="Found in AppFolio under Settings → API Settings → Reports API. Click Generate API Key if you don't have one yet."
            />
            <Field
              label="Reports API Client Secret"
              name="clientSecret"
              type="password"
              required
              // 'new-password' is the only autocomplete value Chrome
              // respects for password fields — 'off' is silently
              // ignored. Combined with the data-*-ignore attributes
              // covers 1Password, LastPass, Bitwarden, and Chrome's
              // built-in suggester.
              autoComplete="new-password"
              data-1p-ignore="true"
              data-lpignore="true"
              mono
              value={clientSecret}
              onChange={(v) => { setClientSecret(v); resetTest(); }}
              hint="Shown once at generation. Stored encrypted at rest. You can rotate it anytime."
            />
          </>
        ) : (
          <Field
            label="Property filter (optional)"
            name="addressFilter"
            placeholder="e.g. 100 Main Street"
            value={addressFilter}
            onChange={(v) => { setAddressFilter(v); resetTest(); }}
            hint="If your AppFolio account manages multiple properties, paste a snippet of the address to filter to just this property's units. Leave blank to sync all."
          />
        )}
      </div>

      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-foreground">
          Step 3 — Test and save
        </p>
        <p className="text-[11px] text-muted-foreground">
          We check your credentials against AppFolio before storing anything.
          Test has to pass before Save activates.
        </p>
      </div>

      {/* What happens after Save — billing-safety expectation-setting per
          the Norman feedback. Operators should know BEFORE connecting that
          AppFolio imports their entire directory and they choose what to
          activate, rather than discovering surprise billing line items
          after the first sync. */}
      <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/[0.04] p-4">
        <p className="text-xs font-semibold text-foreground">
          What happens after you save
        </p>
        <ol className="list-decimal pl-4 space-y-1 text-[11px] text-muted-foreground leading-snug">
          <li>
            We sync your AppFolio property directory in the background.
          </li>
          <li>
            New properties land in a <strong>review queue</strong> — including
            parking lots, storage units, and other sub-records AppFolio
            inevitably returns alongside real buildings.
          </li>
          <li>
            <strong>You choose</strong> which buildings LeaseStack should
            market. Only properties you mark <em>Active</em> appear on
            dashboards and count toward billing — everything else stays
            hidden until you say otherwise.
          </li>
        </ol>
      </div>

      {/* Test connection row */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button
          type="button"
          disabled={!canTest || isTesting}
          onClick={handleTest}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50 transition-colors"
        >
          {isTesting ? "Testing…" : "Test connection"}
        </button>

        {testState.status === "ok" ? (
          <span className="text-xs text-primary flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
            {testState.listingsFound != null
              ? `Connection verified — found ${testState.listingsFound} listing${testState.listingsFound === 1 ? "" : "s"}`
              : "Connection verified"}
          </span>
        ) : testState.status === "error" ? (
          <span className="text-xs text-destructive">{testState.error}</span>
        ) : null}
      </div>

      {/* Save row */}
      <div className="flex items-center gap-3 pt-1 flex-wrap border-t border-border">
        <button
          type="submit"
          disabled={pending || !testPassed}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors mt-3"
        >
          {pending ? "Saving…" : "Save & connect"}
        </button>
        {!testPassed && !pending ? (
          <span className="text-[11px] text-muted-foreground mt-3">
            Test the connection first to enable save.
          </span>
        ) : null}
        {state && !state.ok && state.error ? (
          <span className="text-xs text-destructive mt-3">{state.error}</span>
        ) : null}
        {state && state.ok && state.mode && (state as { ok: true; mode: string; listingsFound?: number }).listingsFound != null ? (
          <span className="text-xs text-primary mt-3">
            Connected — found {(state as { ok: true; mode: string; listingsFound?: number }).listingsFound} listing
            {(state as { ok: true; mode: string; listingsFound?: number }).listingsFound === 1 ? "" : "s"}.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function normalizeSubdomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.appfolio\.com.*$/i, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9-]/g, "");
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
  value,
  onChange,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  mono?: boolean;
  hint?: React.ReactNode;
  value?: string;
  onChange?: (v: string) => void;
  // Allow data-1p-ignore, data-lpignore, etc. to pass through to the
  // underlying input so password managers honour them.
  [key: `data-${string}`]: string | undefined;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        {...rest}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
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
        className="text-xs font-medium text-destructive hover:opacity-80 hover:underline underline-offset-2 disabled:opacity-60"
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
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {result && result.ok ? (
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs text-primary">
            {formatSyncSummary(result.stats)}
          </span>
          {result.stats.warnings.length > 0 ? (
            <details className="text-[11px] text-amber-700">
              <summary className="cursor-pointer font-medium">
                {result.stats.warnings.length} warning
                {result.stats.warnings.length === 1 ? "" : "s"} (click to inspect)
              </summary>
              <ul className="mt-1 ml-3 list-disc space-y-0.5 max-h-32 overflow-y-auto">
                {result.stats.warnings.slice(0, 15).map((w, i) => (
                  <li key={i} className="break-all">{w}</li>
                ))}
                {result.stats.warnings.length > 15 ? (
                  <li className="opacity-60">
                    +{result.stats.warnings.length - 15} more…
                  </li>
                ) : null}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      {result && !result.ok ? (
        <span className="text-xs text-destructive">{result.error}</span>
      ) : null}
    </div>
  );
}

// Honest one-line summary of every phase. Skips zeros so the line stays
// readable; if every phase pulled 0 we say so explicitly instead of
// silently rendering an empty success message.
type StatsLike = {
  propertiesUpserted: number;
  leadsUpserted: number;
  tenantsMatched: number;
  listingsUpserted: number;
  residentsUpserted: number;
  leasesUpserted: number;
  delinquenciesUpdated: number;
  workOrdersUpserted: number;
};

function formatSyncSummary(stats: StatsLike): string {
  const parts: string[] = [];
  const push = (n: number, label: string) => {
    if (n > 0) parts.push(`${n.toLocaleString()} ${label}`);
  };
  push(stats.propertiesUpserted, "properties");
  push(stats.leadsUpserted, "leads");
  push(stats.tenantsMatched, "tenant matches");
  push(stats.listingsUpserted, "listings");
  push(stats.residentsUpserted, "residents");
  push(stats.leasesUpserted, "leases");
  push(stats.delinquenciesUpdated, "delinquencies");
  push(stats.workOrdersUpserted, "work orders");
  if (parts.length === 0) {
    return "Sync ran but pulled 0 rows. Check the warnings (or your AppFolio plan tier — Core can't access REST reports).";
  }
  return `Synced ${parts.join(" · ")}.`;
}
