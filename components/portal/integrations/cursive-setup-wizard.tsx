"use client";

import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  startCursiveSetup,
  getCursiveSetupStatus,
  type StartSetupResult,
} from "@/lib/actions/cursive-connect";
import { CursiveWebhookBadge } from "./cursive-webhook-badge";

// One-flow Cursive visitor-pixel setup wizard. Replaces the prior
// multi-step copy-paste between LeaseStack and the pixel provider:
//
//   OLD: Customer requested a pixel → ops manually configured the
//        upstream pixel + pasted Pixel ID + Segment ID into the admin
//        panel → customer copied webhook URL out of the email → pasted
//        into the upstream config → no verification that data actually
//        flowed.
//
//   NEW: Customer clicks Connect → LeaseStack mints a webhook token +
//        shows the URL to paste upstream. The first webhook event
//        arriving on that URL auto-binds pixel_id (handled in
//        lib/webhooks/cursive-process.ts). No manual ID entry. The
//        wizard polls every 4s post-setup so the UI flips from
//        "Pending" to "Connected" the moment the upstream clicks Test
//        or fires its first event.

type WizardState =
  | { phase: "form" }
  | {
      phase: "configure";
      webhookUrl: string;
      verified: boolean;
      lastEventAt: string | null;
      pixelId: string | null;
    };

type Props = {
  defaultWebsiteUrl?: string;
  properties?: Array<{ id: string; name: string }>;
  // When the page was server-rendered with an in-flight setup we hydrate
  // straight into the configure phase so a refresh doesn't lose state.
  initialWebhookUrl?: string | null;
  initialLastEventAt?: string | null;
  initialPixelId?: string | null;
};

const POLL_INTERVAL_MS = 4_000;
const POLL_MAX_MINUTES = 30;
const POLL_MAX_ATTEMPTS = (POLL_MAX_MINUTES * 60 * 1000) / POLL_INTERVAL_MS;

export function CursiveSetupWizard({
  defaultWebsiteUrl,
  properties = [],
  initialWebhookUrl,
  initialLastEventAt,
  initialPixelId,
}: Props) {
  const initialPhase: WizardState = initialWebhookUrl
    ? {
        phase: "configure",
        webhookUrl: initialWebhookUrl,
        verified: Boolean(initialLastEventAt),
        lastEventAt: initialLastEventAt ?? null,
        pixelId: initialPixelId ?? null,
      }
    : { phase: "form" };

  const [state, setState] = useState<WizardState>(initialPhase);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const showPicker = properties.length > 1;

  // Poll for webhook verification while the customer is configuring AL.
  // Stops the moment we observe lastEventAt — once verified there's no
  // reason to keep hitting the server. Caps at 30 minutes so an
  // abandoned tab doesn't poll forever.
  useEffect(() => {
    if (state.phase !== "configure" || state.verified) return;
    let attempts = 0;
    const id = setInterval(async () => {
      attempts += 1;
      if (attempts > POLL_MAX_ATTEMPTS) {
        clearInterval(id);
        return;
      }
      const result = await getCursiveSetupStatus(selectedPropertyId || null);
      if (!result.ok) return;
      if (result.verified) {
        setState({
          phase: "configure",
          webhookUrl: result.webhookUrl,
          verified: true,
          lastEventAt: result.lastEventAt,
          pixelId: result.pixelId,
        });
        clearInterval(id);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state, selectedPropertyId]);

  function applyResult(result: StartSetupResult) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setState({
      phase: "configure",
      webhookUrl: result.webhookUrl,
      verified: result.verified,
      lastEventAt: result.lastEventAt,
      pixelId: result.pixelId,
    });
  }

  if (state.phase === "form") {
    return (
      <form
        action={(formData) => {
          startTransition(async () => {
            const r = await startCursiveSetup(formData);
            applyResult(r);
          });
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            Turn anonymous visitors into named leads
          </h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Connect Cursive in one flow. Paste the URL we mint below into your
            Cursive pixel&apos;s webhook field and we&apos;ll auto-detect your
            Pixel ID from the first event. No copy-pasting IDs back and forth.
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-4 space-y-4">
          {showPicker ? (
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="leasestackPropertyId"
                className="text-[11px] font-medium text-foreground"
              >
                Which property is this pixel for?
              </Label>
              <select
                id="leasestackPropertyId"
                name="leasestackPropertyId"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="ls-select px-3 py-2 text-sm"
              >
                <option value="">All properties (org-wide)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="websiteUrl"
              className="text-[11px] font-medium text-foreground"
            >
              Website URL
            </Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              required
              defaultValue={defaultWebsiteUrl ?? ""}
              placeholder="https://example.com"
            />
            <span className="text-[11px] text-muted-foreground">
              The site where you&apos;ll install the Cursive pixel snippet.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "Setting up…" : "Connect Cursive"}
          </Button>
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            {state.verified
              ? "Cursive is sending events"
              : "Paste this URL into Cursive"}
          </h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
            {state.verified
              ? "Your Pixel ID was auto-detected from the first event. The integration is live — visitor data will flow into your portal as Cursive identifies people."
              : "Open your Cursive pixel under Webhooks, paste this URL into the destination field, and click Test. We&apos;ll detect the first event automatically — no need to copy a Pixel ID back over here."}
          </p>
        </div>
        <CursiveWebhookBadge lastEventAtIso={state.lastEventAt} />
      </div>

      <WebhookUrlBlock url={state.webhookUrl} />

      {state.verified && state.pixelId ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300">
          Detected Pixel ID:{" "}
          <span className="font-mono">{state.pixelId}</span>
        </div>
      ) : null}

      {!state.verified ? (
        <p className="text-[11px] text-muted-foreground">
          This page is watching for the first event. Once Cursive&apos;s Test
          button (or a real pixel hit) lands, the badge above flips to green
          automatically. You can leave this page open or come back later.
        </p>
      ) : null}
    </div>
  );
}

function WebhookUrlBlock({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Cursive webhook URL
        </span>
        <button
          type="button"
          onClick={copy}
          className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-1 text-[11px] font-semibold rounded"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-foreground"
        style={{ borderRadius: 6 }}
      >
        {url}
      </pre>
      {copyFailed ? (
        <p className="text-[11px] text-destructive">
          Copy failed — select and copy manually.
        </p>
      ) : null}
    </div>
  );
}
