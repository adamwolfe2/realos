"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  StatusChip,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";

// ---------------------------------------------------------------------------
// InstallSnippet — the chatbot's install prerequisite, now the FIRST module
// on /portal/chatbot (Carbon Wave 4: "install shipped with zero
// verification"). Anatomy:
//   - Copy → Paste → Verify mini-stepper (same anatomy as ConnectStepper)
//   - Heartbeat StatusChip: Not connected / Live / Stale, derived server-side
//     from the latest ChatbotConversation activity (there is no dedicated
//     install-heartbeat endpoint or lastSeenAt column — conversation activity
//     is the strongest available proof the widget is running on the site)
//   - Verify button: read-only re-check via router.refresh(); the server
//     component re-reads the latest activity. No new mutations.
// ---------------------------------------------------------------------------

const INSTALL_STEPS = ["Copy", "Paste", "Verify"] as const;

function InstallStepper({ current, live }: { current: 1 | 2 | 3; live: boolean }) {
  return (
    <ol aria-label="Install progress" className="flex items-center gap-2">
      {INSTALL_STEPS.map((step, i) => {
        const stepNumber = i + 1;
        // Verify only reads "done" once the heartbeat confirms activity.
        const isDone = stepNumber < current || (stepNumber === 3 && live);
        const isCurrent = !isDone && stepNumber === current;
        return (
          <li key={step} className="flex items-center gap-2 min-w-0">
            {i > 0 ? (
              <span
                aria-hidden="true"
                className="h-px w-6 sm:w-10 shrink-0 bg-border"
              />
            ) : null}
            <span
              aria-current={isCurrent ? "step" : undefined}
              className="inline-flex items-center gap-1.5 min-w-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-[10px] font-semibold tabular-nums",
                  isDone && "bg-primary text-primary-foreground",
                  isCurrent && "border-2 border-primary text-primary",
                  !isDone && !isCurrent && "border border-border text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-3 w-3" strokeWidth={2.5} /> : stepNumber}
              </span>
              <span
                className={cn(
                  "truncate text-[11px]",
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isDone
                      ? "font-medium text-foreground/80"
                      : "text-muted-foreground",
                )}
              >
                {step}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function InstallSnippet({
  snippet,
  status,
  lastActivityLabel,
}: {
  snippet: string;
  /**
   * Heartbeat state, derived server-side from chatbot conversation activity.
   * Optional because the popups page reuses this component for its embed
   * snippet without a heartbeat signal — omitting it renders the plain
   * copy-only card (no stepper, no chip, no Verify).
   */
  status?: ConnectionStatus;
  /** Pre-formatted "last activity …" string (format upstream — hydration-safe). */
  lastActivityLabel?: string | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [everCopied, setEverCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const [verifying, startVerify] = React.useTransition();

  const hasHeartbeat = status !== undefined;
  const isLive = status === "live";
  // Paste can't be observed from the portal, so after the first copy the
  // stepper advances to Paste and stays there until the widget reports
  // real activity (which completes Verify via the heartbeat chip).
  const current: 1 | 2 | 3 = isLive ? 3 : everCopied ? 2 : 1;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setEverCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  }

  function verify() {
    // Read-only re-check: re-runs the server component, which re-reads the
    // latest ChatbotConversation activity. No install-check endpoint exists,
    // so the chip always reflects last-known server state.
    startVerify(() => {
      router.refresh();
    });
  }

  return (
    <section className="rounded-[2px] border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {hasHeartbeat ? "Install the chatbot on your site" : "Install snippet"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Paste this before the closing <code>&lt;/head&gt;</code> tag. Works
            on Wix, WordPress, Webflow, custom sites — anywhere you can add a
            script.
          </p>
        </div>
        {hasHeartbeat ? (
          <div className="flex items-center gap-2 shrink-0">
            <StatusChip status={status ?? "not_connected"} />
            {lastActivityLabel ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {lastActivityLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasHeartbeat ? <InstallStepper current={current} live={isLive} /> : null}

      <div className="relative">
        <pre className="border border-border rounded-[2px] bg-secondary px-3 py-3 pr-24 text-xs font-mono overflow-x-auto">
          <code>{snippet}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute top-2 right-2 bg-primary text-primary-foreground hover:bg-primary-dark transition-colors text-[11px] font-semibold px-2.5 py-1 rounded-[2px]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {copyFailed && (
        <p className="text-[11px] text-destructive">
          Copy failed — select the snippet manually and copy with Ctrl+C / Cmd+C.
        </p>
      )}

      {hasHeartbeat ? (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={verify}
          disabled={verifying}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-3 w-3", verifying && "animate-spin")}
            strokeWidth={2}
          />
          {verifying ? "Checking…" : "Verify installation"}
        </button>
        <p className="text-[11px] text-muted-foreground leading-snug flex-1 min-w-[200px]">
          {isLive
            ? "The widget is reporting conversation activity from your site."
            : status === "stale"
              ? "The widget has reported before, but not in the last 7 days. Open your site to confirm it still loads, then verify again."
              : "Verification looks for conversation activity from your installed widget. After pasting, open your site, start a chat, then verify."}
        </p>
      </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        The widget reads live config from the server, so changes below
        propagate without re-installing.
      </p>
    </section>
  );
}
