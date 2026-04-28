"use client";

import { useState, useTransition } from "react";
import {
  saveCursiveSettings,
  syncCursiveSegment,
  testCursiveWebhook,
} from "@/lib/actions/admin-cursive";

type Initial = {
  cursivePixelId: string | null;
  cursiveSegmentId: string | null;
  installedOnDomain: string | null;
  lastEventAt: string | null;
  lastSegmentSyncAt: string | null;
  totalEventsCount: number;
};

export function CursivePanel({
  orgId,
  webhookUrl,
  tenantWebhookUrl,
  initial,
}: {
  orgId: string;
  webhookUrl: string;
  tenantWebhookUrl: string | null;
  initial: Initial;
}) {
  const [pixelId, setPixelId] = useState(initial.cursivePixelId ?? "");
  const [segmentId, setSegmentId] = useState(initial.cursiveSegmentId ?? "");
  const [domain, setDomain] = useState(initial.installedOnDomain ?? "");
  const [pending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [syncMsg, setSyncMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [testMsg, setTestMsg] = useState<
    | { kind: "ok"; visitorEmail: string; visitorId: string | null; status: number }
    | { kind: "error"; text: string; status?: number }
    | null
  >(null);
  const [copied, setCopied] = useState<"shared" | "tenant" | null>(null);

  function onCopy(kind: "shared" | "tenant", value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function onSave() {
    setSaveMsg(null);
    startTransition(async () => {
      const res = await saveCursiveSettings({
        orgId,
        cursivePixelId: pixelId.trim() || null,
        cursiveSegmentId: segmentId.trim() || null,
        installedOnDomain: domain.trim() || null,
      });
      if (res.ok) setSaveMsg({ kind: "ok", text: "Saved." });
      else setSaveMsg({ kind: "error", text: res.error });
    });
  }

  function onSync() {
    setSyncMsg(null);
    startTransition(async () => {
      const res = await syncCursiveSegment(orgId);
      if (res.ok) {
        setSyncMsg({
          kind: "ok",
          text: `Pulled ${res.pulled} resolutions: ${res.created} new, ${res.updated} updated.`,
        });
      } else {
        setSyncMsg({ kind: "error", text: res.error });
      }
    });
  }

  function onTest() {
    setTestMsg(null);
    startTransition(async () => {
      const res = await testCursiveWebhook(orgId);
      if (res.ok) {
        setTestMsg({
          kind: "ok",
          visitorEmail: res.visitorEmail,
          visitorId: res.visitorId,
          status: res.status,
        });
      } else {
        setTestMsg({ kind: "error", text: res.error, status: res.status });
      }
    });
  }

  return (
    <div id="cursive-panel" className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
          Per-tenant webhook URL (recommended for AL pixel UI)
        </div>
        {tenantWebhookUrl ? (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted/40 border border-border rounded px-2 py-1.5 break-all">
                {tenantWebhookUrl}
              </code>
              <button
                type="button"
                onClick={() => onCopy("tenant", tenantWebhookUrl)}
                className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted/40"
              >
                {copied === "tenant" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Paste this URL into the AudienceLab pixel under Webhooks (Step 2).
              The path token is the auth, no headers required, so AL&apos;s
              built-in Test button passes immediately.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground rounded-md border border-dashed border-border bg-muted/20 px-2.5 py-2">
            Save a Cursive pixel ID below to mint a per-tenant webhook token.
          </p>
        )}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
          Shared webhook URL (Studio Segment Trigger)
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono bg-muted/40 border border-border rounded px-2 py-1.5 break-all">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => onCopy("shared", webhookUrl)}
            className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted/40"
          >
            {copied === "shared" ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Use this for the Studio Segment Trigger workflow only. It requires
          the
          <code className="font-mono mx-1">x-audiencelab-secret</code>
          header verified against our
          <code className="font-mono mx-1">CURSIVE_WEBHOOK_SECRET</code>
          env var.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Cursive (V4) pixel ID"
          hint="From AudienceLab → Pixel. Saving this for the first time auto-fulfills the customer's pending request and emails them their install snippet."
          value={pixelId}
          onChange={setPixelId}
          placeholder="e.g. 7a91c…"
        />
        <Field
          label="Audience segment ID"
          hint="From AudienceLab → Segments. Required to use Sync from segment."
          value={segmentId}
          onChange={setSegmentId}
          placeholder="d3ee9fb0-0dd2-4b4d-aa60-8ac9bd81e8e4"
        />
        <Field
          label="Installed on domain"
          hint="Hostname the pixel script lives on. Used as a referrer hint."
          value={domain}
          onChange={setDomain}
          placeholder="example.com"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          <div>
            Total events received:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {initial.totalEventsCount}
            </span>
          </div>
          <div>
            Last event: {formatTime(initial.lastEventAt)}. Last segment sync:{" "}
            {formatTime(initial.lastSegmentSyncAt)}.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onTest}
            disabled={pending || !initial.cursivePixelId}
            className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted/40 disabled:opacity-40"
            title={
              initial.cursivePixelId
                ? "Send a synthetic event through /api/webhooks/cursive to verify auth + pixel routing"
                : "Save a pixel ID first"
            }
          >
            {pending ? "Working…" : "Send test event"}
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={pending || !segmentId.trim()}
            className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted/40 disabled:opacity-40"
            title={
              segmentId.trim()
                ? "Pull resolved visitors from the Cursive segment"
                : "Set a segment ID first"
            }
          >
            {pending ? "Working…" : "Sync from segment"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="text-xs px-3 py-1.5 bg-foreground text-background rounded-md hover:bg-foreground/90 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveMsg && (
        <p
          className={`text-[11px] ${
            saveMsg.kind === "ok" ? "text-emerald-700" : "text-destructive"
          }`}
        >
          {saveMsg.text}
        </p>
      )}
      {syncMsg && (
        <p
          className={`text-[11px] ${
            syncMsg.kind === "ok" ? "text-emerald-700" : "text-destructive"
          }`}
        >
          {syncMsg.text}
        </p>
      )}
      {testMsg && testMsg.kind === "ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900 space-y-1">
          <p className="font-medium">
            Webhook round-trip succeeded ({testMsg.status}). The pixel binding
            is wired correctly on our side.
          </p>
          <p>
            Test visitor created with email{" "}
            <code className="font-mono bg-emerald-100 px-1 rounded">
              {testMsg.visitorEmail}
            </code>
            . Delete it from the visitor feed when you&apos;re done.
          </p>
          {testMsg.visitorId && (
            <a
              href={`/portal/visitors/${testMsg.visitorId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block underline underline-offset-2"
            >
              Open test visitor →
            </a>
          )}
        </div>
      )}
      {testMsg && testMsg.kind === "error" && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-900 space-y-1">
          <p className="font-medium">
            Webhook test failed{testMsg.status ? ` (${testMsg.status})` : ""}.
          </p>
          <p>{testMsg.text}</p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  readOnly,
  mono,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`mt-1 w-full text-sm rounded-md border border-border bg-card px-2.5 py-1.5 ${
          mono ? "font-mono text-xs" : ""
        } ${readOnly ? "bg-muted/30 text-muted-foreground" : ""}`}
      />
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
      )}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleString();
}
