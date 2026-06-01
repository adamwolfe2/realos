"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveCursiveSettings,
  syncCursiveSegment,
  testCursiveWebhook,
} from "@/lib/actions/admin-cursive";

// Auto-sync threshold. When an operator opens this panel and the last
// segment pull is older than this, fire the sync transparently on mount
// — the same self-healing pattern /portal/visitors already uses (see
// components/portal/sync/pixel-sync-button.tsx). Keeps the operator from
// ever needing to click "Sync from segment" manually under normal use:
// the 5-min vercel cron handles background freshness, and this on-load
// trigger handles the gap when the operator is actively looking at the
// panel.
const STALE_THRESHOLD_MS = 2 * 60 * 1000;

type Initial = {
  cursivePixelId: string | null;
  cursiveSegmentId: string | null;
  installedOnDomain: string | null;
  lastEventAt: string | null;
  lastSegmentSyncAt: string | null;
  totalEventsCount: number;
  // Raw pixel-hit pulse — every webhook event regardless of resolution.
  // See lib/webhooks/cursive-process.ts for the split rationale.
  lastPixelHitAt: string | null;
  totalPixelHitsCount: number;
  // Pre-resolved gap so the success message can show "X anonymous".
  // Computed server-side from Visitor rows (IDENTIFIED + ENRICHED +
  // MATCHED_TO_LEAD) — see Fix 2 in fix(telemetry+funnel).
  identifiedVisitorCount: number;
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
  const router = useRouter();
  const [pixelId, setPixelId] = useState(initial.cursivePixelId ?? "");
  const [segmentId, setSegmentId] = useState(initial.cursiveSegmentId ?? "");
  const [domain, setDomain] = useState(initial.installedOnDomain ?? "");
  const [pending, startTransition] = useTransition();
  // Distinct from `pending` so the on-mount auto-sync can render its own
  // muted "Refreshing…" indicator without flipping every button to a
  // disabled state. Manual button clicks still use `pending` via
  // useTransition; auto runs use this flag.
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const autoTriggered = useRef(false);
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
        // Norman question (May 22): "why does admin say 205 resolutions
        // but the portal Visitor feed says 146?" The 205 is the full
        // AudienceLab segment membership; the 146 is the subset our
        // upsert resolved to IDENTIFIED status (firstName + lastName +
        // email all present). The remaining ~30 land as ANONYMOUS in
        // our DB (AL has them in the segment but with insufficient
        // resolution data) and another ~29 get dropped entirely (no
        // usable identity at all). Spell that out in the success
        // message so the next time an operator clicks Sync they don't
        // see "205" and assume that's the number of new outreach-
        // ready contacts.
        const dropped = res.pulled - (res.created + res.updated);
        const droppedSuffix =
          dropped > 0
            ? ` (${dropped} skipped — no resolvable identity)`
            : "";
        // Anonymous gap: pulled total minus the IDENTIFIED-tier visitor
        // count is the slice of segment members that AL has in the
        // segment but doesn't have a name+email for. These get a Visitor
        // row but aren't outreach-ready. Surface the number inline so
        // operators don't have to mentally subtract /portal/visitors's
        // IDENTIFIED filter from the sync result.
        const anonymous = Math.max(
          0,
          res.pulled - initial.identifiedVisitorCount,
        );
        const anonymousSuffix =
          anonymous > 0
            ? ` · ${anonymous} anonymous (no name+email — not outreach-ready)`
            : "";
        setSyncMsg({
          kind: "ok",
          text:
            `Pulled ${res.pulled} segment members from Cursive: ` +
            `${res.created} new, ${res.updated} updated${droppedSuffix}${anonymousSuffix}. ` +
            `Operator-facing IDENTIFIED count on /portal/visitors only ` +
            `includes rows with firstName + lastName + email — anonymous ` +
            `rows count toward the total but aren't surfaced as contacts.`,
        });
      } else {
        setSyncMsg({ kind: "error", text: res.error });
      }
    });
  }

  // Auto-sync on mount when the segment data is stale. Fires once per
  // page load (sessionStorage-deduped across tabs within a 60s window
  // so multiple admin tabs don't each trigger). Silent: doesn't flip
  // `pending` (used by manual buttons) — uses `autoRefreshing` instead
  // so the operator sees a muted indicator next to the timestamp,
  // not a disabled UI. router.refresh() at the end so the new
  // lastSegmentSyncAt + visitor counts render without a full reload.
  useEffect(() => {
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    if (!initial.cursiveSegmentId) return;
    const lastSync = initial.lastSegmentSyncAt
      ? new Date(initial.lastSegmentSyncAt).getTime()
      : 0;
    const ageMs = Date.now() - lastSync;
    const isStale = !initial.lastSegmentSyncAt || ageMs > STALE_THRESHOLD_MS;
    if (!isStale) return;

    // Cross-tab dedupe — same pattern as StaleOnLoadTrigger.
    try {
      const key = `sync:admin-cursive:${orgId}`;
      const lastFired = sessionStorage.getItem(key);
      if (lastFired) {
        const fireAgeMs = Date.now() - Number(lastFired);
        if (Number.isFinite(fireAgeMs) && fireAgeMs < 60_000) return;
      }
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // sessionStorage can throw in private mode; fall through.
    }

    setAutoRefreshing(true);
    void (async () => {
      try {
        await syncCursiveSegment(orgId).catch(() => undefined);
      } finally {
        setAutoRefreshing(false);
        // Settle for ~1s so the upsert lands before re-reading the row.
        setTimeout(() => router.refresh(), 1000);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              Paste this URL into the Cursive pixel under Webhooks (Step 2).
              The path token is the auth, no headers required, so the
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
          hint="From Cursive → Pixel. Saving this for the first time auto-fulfills the customer's pending request and emails them their install snippet."
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {/* Split telemetry. Before this split the panel showed only
              "Real-time webhook events received: 31" — which ticks only
              when AL resolves a new identity. Operators saw 31 and
              concluded the pixel was dead, even when it was firing
              thousands of anonymous hits per hour. Show both numbers so
              operators can tell "pixel is firing" apart from "pixel is
              firing AND AL is resolving identities". */}
          <div>
            Pixel hits:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {initial.totalPixelHitsCount.toLocaleString()}
            </span>
            {" · last "}
            {formatTime(initial.lastPixelHitAt)}
            <span
              className="ml-1 text-muted-foreground/80 cursor-help"
              title="Every webhook hit from Cursive — including anonymous page_views that don't carry resolved identity. This is the real-time pulse of the pixel."
            >
              (?)
            </span>
          </div>
          <div>
            Resolved identities:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {initial.totalEventsCount.toLocaleString()}
            </span>
            {" · last "}
            {formatTime(initial.lastEventAt)}
            <span
              className="ml-1 text-muted-foreground/80 cursor-help"
              title="Subset of pixel hits where AL had enough data to attach a name, email, or HEM. These become Visitor rows in /portal/visitors. Pull-based segment-sync visitors are NOT counted here."
            >
              (?)
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Last segment sync: {formatTime(initial.lastSegmentSyncAt)}.
            </span>
            {autoRefreshing ? (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 inline-flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                />
                Auto-refreshing…
              </span>
            ) : (
              <span
                className="text-[10px] uppercase tracking-wider text-muted-foreground/70"
                title="A background cron pulls the segment every 5 minutes. This panel also auto-pulls when you open it if the data is older than 2 minutes — no manual sync needed under normal use."
              >
                Auto-syncs every 5 min
              </span>
            )}
          </div>
          {/* Norman question (May 22): admin says "205 resolutions", portal
              says "146 IDENTIFIED" — why the gap? The 205 is every member
              of the AL segment regardless of resolution quality; the 146
              is the subset with full name + email that becomes an
              outreach-ready contact. Spell that out below the timestamps
              so the next operator doesn't have to ask. */}
          <div className="pt-1">
            Segment members pulled count what AL has in the segment. The
            operator-facing visitor count on{" "}
            <span className="font-medium text-foreground">/portal/visitors</span>{" "}
            only includes IDENTIFIED rows (name + email present). Anonymous
            and unresolved rows count toward the pull total but not the
            outreach-ready count.
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
            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary-dark transition-colors rounded-md hover:bg-foreground/90 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveMsg && (
        <p
          className={`text-[11px] ${
            saveMsg.kind === "ok" ? "text-primary" : "text-destructive"
          }`}
        >
          {saveMsg.text}
        </p>
      )}
      {syncMsg && (
        <p
          className={`text-[11px] ${
            syncMsg.kind === "ok" ? "text-primary" : "text-destructive"
          }`}
        >
          {syncMsg.text}
        </p>
      )}
      {testMsg && testMsg.kind === "ok" && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-[11px] text-primary space-y-1">
          <p className="font-medium">
            Webhook round-trip succeeded ({testMsg.status}). The pixel binding
            is wired correctly on our side.
          </p>
          <p>
            Test visitor created with email{" "}
            <code className="font-mono bg-primary/10 px-1 rounded">
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
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive space-y-1">
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
