"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  connectSeo,
  disconnectSeo,
  triggerSeoSync,
  type ConnectSeoResult,
  type SyncSeoResult,
} from "@/lib/actions/seo-connect";
import { cn } from "@/lib/utils";

const CONNECT_INITIAL: ConnectSeoResult = { ok: true, provider: "GSC" };

const SA_EMAIL = "leasestack-integrations@leasestack.iam.gserviceaccount.com";

type Provider = "GSC" | "GA4";

type ConnectableProperty = { id: string; name: string };

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* ignore - clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10.5px] font-medium text-foreground hover:bg-muted/40 transition-colors"
    >
      {copied ? "Copied" : "Copy email"}
    </button>
  );
}

export function ConnectSeoForm({
  provider,
  properties = [],
  defaultPropertyId = null,
}: {
  provider: Provider;
  /**
   * Org's properties available for scoping. When empty, the form
   * defaults to a legacy org-wide connection (propertyId = NULL).
   * Multi-property tenants pass the visible/allowed list and the
   * selector renders so each connection lands on a specific
   * property.
   */
  properties?: ConnectableProperty[];
  /**
   * Pre-select a property — useful when the form is rendered from a
   * per-property tab so the operator doesn't have to re-pick.
   */
  defaultPropertyId?: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ConnectSeoResult,
    FormData
  >(async (_prev, formData) => connectSeo(formData), CONNECT_INITIAL);
  const showPicker = properties.length > 0;

  // After a successful connect, refresh the parent server component so
  // the marketplace tile badge flips from "Available" → "Connected"
  // immediately. Audit BUG #3 caught the prior dead-end where the form
  // showed "Connected. Backfill running…" but the badge stayed
  // "Available" because nothing told the page to re-render.
  useEffect(() => {
    if (state && state.ok && state.provider === provider) {
      // Slight delay so the user actually sees the success copy first.
      const id = setTimeout(() => router.refresh(), 1500);
      return () => clearTimeout(id);
    }
  }, [state, provider, router]);

  const isGsc = provider === "GSC";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="provider" value={provider} />

      {/* Step 0: pick which LeaseStack property this connection is
          for. Only renders for orgs with more than one property —
          single-property tenants don't see this and the connection
          lands on the legacy org-wide row. */}
      {showPicker ? (
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-2">
          <label className="block text-xs font-medium text-foreground">
            Which property is this {isGsc ? "Search Console" : "GA4"}{" "}
            connection for?
          </label>
          <select
            name="leasestackPropertyId"
            defaultValue={defaultPropertyId ?? ""}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All properties (org-wide)</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Multi-property tenants connect a distinct{" "}
            {isGsc ? "Search Console site" : "GA4 property"} per LeaseStack
            property. Pick &ldquo;All properties&rdquo; only if you have a
            single account that covers your whole portfolio.
          </p>
        </div>
      ) : null}

      {/* Step 1: grant access */}
      <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-foreground">
            Step 1 — Grant read access to LeaseStack
          </p>
          <CopyEmailButton email={SA_EMAIL} />
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Follow the exact clicks below. Google puts the user you&apos;re
          adding at the <strong>property</strong> level, which is not the same
          as the account level, which is the most common reason this fails.
        </p>
        <ol className="text-[11px] text-muted-foreground space-y-2 list-decimal list-outside pl-5 leading-relaxed">
          {isGsc ? (
            <>
              <li>
                Go to{" "}
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-foreground underline underline-offset-2"
                >
                  search.google.com/search-console
                </a>{" "}
                signed in as someone who owns the property. If there are
                multiple properties, pick the one whose URL matches the site
                you&apos;re connecting here.
              </li>
              <li>
                In the left sidebar, scroll to the bottom and click{" "}
                <strong>Settings</strong> (gear icon).
              </li>
              <li>
                Click <strong>Users and permissions</strong>, then{" "}
                <strong>Add user</strong> in the top-right.
              </li>
              <li>
                Paste this email into the Email address field:{" "}
                <span className="font-mono text-foreground">{SA_EMAIL}</span>
              </li>
              <li>
                Set permission to <strong>Full</strong> (or{" "}
                <strong>Restricted</strong> if you only want read-only). Click{" "}
                <strong>Add</strong>.
              </li>
              <li>
                You should see the email appear in the Users list. If you
                don&apos;t see it, you added it to the wrong property.
              </li>
            </>
          ) : (
            <>
              <li>
                Go to{" "}
                <a
                  href="https://analytics.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-foreground underline underline-offset-2"
                >
                  analytics.google.com
                </a>
                . In the <strong>top-left property picker</strong>, switch to
                the GA4 property whose numeric Property ID you&apos;re about
                to paste in Step 2. This is the most common mistake:{" "}
                <strong>the selected property must match the ID</strong>.
              </li>
              <li>
                Click the <strong>gear icon labeled Admin</strong> in the
                bottom-left corner of the screen.
              </li>
              <li>
                You&apos;ll see two columns of settings. Look at the{" "}
                <strong>right column (Property)</strong>, not the left
                (Account). Click <strong>Property access management</strong>.
                <br />
                <em className="opacity-80">
                  Adding the user under the Account column will NOT work and
                  is the #1 cause of &quot;insufficient permissions&quot;.
                </em>
              </li>
              <li>
                Click the blue <strong>+</strong> button in the top-right,
                then <strong>Add users</strong>.
              </li>
              <li>
                Paste this email into the Email addresses field:{" "}
                <span className="font-mono text-foreground">{SA_EMAIL}</span>
              </li>
              <li>
                Under <strong>Direct roles and data restrictions</strong>,
                check <strong>Viewer</strong>. Leave everything else as
                default.
              </li>
              <li>
                Uncheck <strong>Notify new users by email</strong> (service
                accounts don&apos;t read email). Click <strong>Add</strong> in
                the top-right.
              </li>
              <li>
                Confirm the email appears in the access list. It can take up
                to a minute for Google to propagate; if Step 2 still says
                &quot;insufficient permissions,&quot; wait 60 seconds and try
                again.
              </li>
            </>
          )}
        </ol>
      </div>

      {/* Step 2: enter property identifier */}
      <Field
        label={
          isGsc
            ? "Step 2 — Paste the GSC site URL"
            : "Step 2 — Enter the GA4 property ID"
        }
        name="propertyIdentifier"
        placeholder={isGsc ? "https://www.example.com/" : "338445667"}
        required
        mono
        hint={
          isGsc ? (
            <>
              Paste the full property URL exactly as it appears in Search
              Console &mdash; with <code className="font-mono">https://</code>{" "}
              and the trailing slash &mdash; e.g.{" "}
              <code className="font-mono">https://www.example.com/</code>. For
              a domain-level property, use the form{" "}
              <code className="font-mono">sc-domain:example.com</code>.
            </>
          ) : (
            <>
              In GA4, click <strong>Admin</strong> (gear bottom-left){" "}
              &rarr; <strong>Property settings</strong> (top of the Property
              column) &rarr; <strong>Property details</strong>. The numeric{" "}
              <strong>Property ID</strong> appears in the top-right &mdash;
              e.g. <code className="font-mono">338445667</code>. Do{" "}
              <strong>not</strong> paste the{" "}
              <code className="font-mono">G-XXXX</code> measurement ID &mdash;
              that&apos;s a different identifier.
            </>
          )
        }
      />

      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {pending
            ? "Testing & connecting…"
            : `Connect ${isGsc ? "Search Console" : "Analytics"}`}
        </button>
        {state && !state.ok && state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
        {state && state.ok && state.provider === provider ? (
          <span className="text-xs text-primary">
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

export function DisconnectSeoForm({
  provider,
  propertyId = null,
}: {
  provider: Provider;
  /** Property scope of the row to remove. NULL = legacy org-wide. */
  propertyId?: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    ConnectSeoResult,
    FormData
  >(async (_prev, formData) => disconnectSeo(formData), CONNECT_INITIAL);

  return (
    <form action={formAction} className="inline-flex items-center gap-3">
      <input type="hidden" name="provider" value={provider} />
      {propertyId ? (
        <input
          type="hidden"
          name="leasestackPropertyId"
          value={propertyId}
        />
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-destructive hover:opacity-80 hover:underline underline-offset-2 disabled:opacity-60"
      >
        {pending ? "Disconnecting…" : `Disconnect ${provider}`}
      </button>
      {state && !state.ok && state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
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
        <span className="text-xs text-primary">
          Pulled {result.stats.gscDays} GSC days, {result.stats.gscQueries}{" "}
          queries, {result.stats.ga4Days} GA4 days,{" "}
          {result.stats.ga4LandingPages} landing pages.
        </span>
      ) : null}
      {result && !result.ok ? (
        <span className="text-xs text-destructive">{result.error}</span>
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
