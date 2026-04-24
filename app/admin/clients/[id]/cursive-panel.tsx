"use client";

import { useState, useTransition } from "react";
import {
  saveCursiveSettings,
  syncCursiveSegment,
} from "@/lib/actions/admin-cursive";

type Initial = {
  cursivePixelId: string | null;
  cursiveSegmentId: string | null;
  installedOnDomain: string | null;
  publicSiteKey: string | null;
  publicKeyPrefix: string | null;
  lastEventAt: string | null;
  lastSegmentSyncAt: string | null;
  totalEventsCount: number;
};

export function CursivePanel({
  orgId,
  webhookUrl,
  initial,
}: {
  orgId: string;
  webhookUrl: string;
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
  const [copied, setCopied] = useState(false);

  function onCopyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
          Webhook URL
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono bg-muted/40 border border-border rounded px-2 py-1.5 break-all">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={onCopyWebhook}
            className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted/40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Paste this into the Cursive pixel settings under Webhooks. The
          upstream shared-secret header
          <code className="font-mono mx-1">x-audiencelab-secret</code>
          is verified against our
          <code className="font-mono mx-1">CURSIVE_WEBHOOK_SECRET</code>
          env var (left as-is since the upstream vendor sets the header name).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Cursive (V4) pixel ID"
          hint="From Cursive → Pixel. Required to route incoming webhook events to this tenant."
          value={pixelId}
          onChange={setPixelId}
          placeholder="e.g. 7a91c…"
        />
        <Field
          label="Audience segment ID"
          hint="From Cursive → Segments. Required to use Sync from segment."
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
        <Field
          label="First-party public site key"
          hint="Generated automatically. Used by the script snippet operators paste on their site."
          value={initial.publicSiteKey ?? ""}
          onChange={() => undefined}
          placeholder="Not yet provisioned. Click Provision pixel."
          readOnly
          mono
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
        <div className="flex items-center gap-2">
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
