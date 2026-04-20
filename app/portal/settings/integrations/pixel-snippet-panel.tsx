"use client";

import { useState, useTransition } from "react";
import {
  provisionPixelSnippet,
  rotatePixelSnippet,
  type ProvisionPixelResult,
} from "@/lib/actions/pixel-snippet";
import { CopySnippetButton } from "./copy-snippet";

// ---------------------------------------------------------------------------
// First-party pixel snippet panel.
//
// Shows the copy-pasteable <script> tag, a curl smoke test command, and a
// browser-based "send a test event" button so the operator can verify the
// pipeline lights up the visitor feed without leaving the portal.
// ---------------------------------------------------------------------------

type Props = {
  initialPublicKey: string | null;
  initialPrefix: string | null;
  initialIssuedAt: string | null;
  appBaseUrl: string;
};

export function PixelSnippetPanel(props: Props) {
  const [publicKey, setPublicKey] = useState<string | null>(props.initialPublicKey);
  const [prefix, setPrefix] = useState<string | null>(props.initialPrefix);
  const [issuedAt, setIssuedAt] = useState<string | null>(props.initialIssuedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [testStatus, setTestStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "ok"; sessionToken: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function applyResult(res: ProvisionPixelResult) {
    if (res.ok && res.publicSiteKey) {
      setPublicKey(res.publicSiteKey);
      setPrefix(res.publicKeyPrefix ?? res.publicSiteKey.slice(0, 12));
      setIssuedAt(new Date().toISOString());
      setError(null);
    } else {
      setError(res.error ?? "Could not provision the pixel.");
    }
  }

  function onProvision() {
    setError(null);
    startTransition(async () => {
      const res = await provisionPixelSnippet();
      applyResult(res);
    });
  }
  function onRotate() {
    if (
      !confirm(
        "Rotate the public site key? The current snippet will stop working immediately. You will need to paste the new snippet on every site that uses it."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await rotatePixelSnippet();
      applyResult(res);
    });
  }

  if (!publicKey) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Generate a pixel snippet to start collecting visitor sessions on
          your marketing site. The key is public and safe to embed in HTML.
        </p>
        <button
          type="button"
          onClick={onProvision}
          disabled={pending}
          className="rounded-md border border-border bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-2 text-xs font-semibold disabled:opacity-40"
          style={{ borderRadius: 6 }}
        >
          {pending ? "Generating…" : "Generate pixel snippet"}
        </button>
        {error ? (
          <p className="text-xs text-rose-700">{error}</p>
        ) : null}
      </div>
    );
  }

  const scriptUrl = `${props.appBaseUrl}/api/public/pixel/${publicKey}.js`;
  const ingestUrl = `${props.appBaseUrl}/api/public/visitors/track`;
  const installSnippet = `<script async src="${scriptUrl}"></script>`;
  const curlCmd = [
    `curl -X POST ${ingestUrl} \\`,
    "  -H 'Content-Type: application/json' \\",
    `  -d '{"publicKey":"${publicKey}","anonymousId":"anon_curltest","context":{"url":"https://example.com/","referrer":""},"events":[{"type":"pageview","url":"https://example.com/","path":"/","title":"Curl smoke test"}]}'`,
  ].join("\n");

  async function onSendTestEvent() {
    setTestStatus({ kind: "sending" });
    try {
      const res = await fetch(ingestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          anonymousId: `anon_portaltest_${Math.random().toString(36).slice(2, 10)}`,
          context: {
            url: window.location.href,
            referrer: document.referrer || null,
            userAgent: navigator.userAgent,
            language: navigator.language,
            utm: { source: "portal", medium: "test", campaign: "snippet_check" },
          },
          events: [
            {
              type: "pageview",
              url: window.location.href,
              path: window.location.pathname,
              title: "Portal pixel smoke test",
            },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setTestStatus({ kind: "error", message: text || `HTTP ${res.status}` });
        return;
      }
      const json = (await res.json()) as { sessionToken?: string };
      setTestStatus({
        kind: "ok",
        sessionToken: json.sessionToken ?? "(no session token)",
      });
    } catch (err) {
      setTestStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Detail label="Public site key" value={prefix ? `${prefix}…` : publicKey} mono />
        <Detail
          label="Issued"
          value={
            issuedAt
              ? new Date(issuedAt).toLocaleString()
              : "—"
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-foreground">
            Install snippet
          </span>
          <CopySnippetButton snippet={installSnippet} />
        </div>
        <pre
          className="rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-foreground"
          style={{ borderRadius: 6 }}
        >
          {installSnippet}
        </pre>
        <p className="text-[11px] text-muted-foreground">
          Paste this tag inside the {"<head>"} of every page on your
          marketing site. The script auto-tracks pageviews, scroll depth,
          time on page, UTM tags, and referrer. Identify a visitor with{" "}
          <code className="font-mono">window.rePixel.identify(&#123;email:&apos;...&apos;&#125;)</code>.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-foreground">
            Smoke test (curl)
          </span>
          <CopySnippetButton snippet={curlCmd} />
        </div>
        <pre
          className="rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-foreground"
          style={{ borderRadius: 6 }}
        >
          {curlCmd}
        </pre>
      </div>

      <div className="rounded-md border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-medium text-foreground">
            Test it from this browser
          </div>
          <button
            type="button"
            onClick={onSendTestEvent}
            disabled={testStatus.kind === "sending"}
            className="rounded-md border border-border bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ borderRadius: 6 }}
          >
            {testStatus.kind === "sending" ? "Sending…" : "Send test pageview"}
          </button>
        </div>
        {testStatus.kind === "ok" ? (
          <p className="text-[11px] text-emerald-700">
            Sent. Refresh{" "}
            <a href="/portal/visitors" className="underline">
              /portal/visitors
            </a>{" "}
            to see the new session. Token:{" "}
            <code className="font-mono">{testStatus.sessionToken}</code>
          </p>
        ) : testStatus.kind === "error" ? (
          <p className="text-[11px] text-rose-700">{testStatus.message}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Fires a single pageview against your own pixel from this device.
            Useful for verifying the ingest pipeline end-to-end.
          </p>
        )}
      </div>

      <div className="pt-3 border-t flex items-center gap-3">
        <button
          type="button"
          onClick={onRotate}
          disabled={pending}
          className="text-[11px] text-rose-700 underline underline-offset-2 disabled:opacity-40"
        >
          {pending ? "Rotating…" : "Rotate public site key"}
        </button>
        {error ? (
          <span className="text-[11px] text-rose-700">{error}</span>
        ) : null}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`text-sm mt-0.5 break-all text-foreground ${
          mono ? "font-mono text-[12px]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
