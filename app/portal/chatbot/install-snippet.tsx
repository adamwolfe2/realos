"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/components/portal/ui/status-chip";
import { Panel, Pill, Step } from "@/components/portal/overview/kit";

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
  defaultCollapsed = false,
  step,
  picker,
  bare = false,
}: {
  snippet: string;
  /** Numbered setup step on /portal/chatbot. */
  step?: number;
  /** Property picker rendered above the code (multi-property orgs). */
  picker?: React.ReactNode;
  /** Render without the card (inside the chatbot studio slide-over). */
  bare?: boolean;
  /**
   * Heartbeat state, derived server-side from chatbot conversation activity.
   * Optional because the popups page reuses this component for its embed
   * snippet without a heartbeat signal — omitting it renders the plain
   * copy-only card (no stepper, no chip, no Verify).
   */
  status?: ConnectionStatus;
  /** Pre-formatted "last activity …" string (format upstream — hydration-safe). */
  lastActivityLabel?: string | null;
  /** Collapse to a one-line summary (used once the widget is live —
   *  installation is a done step, not daily reading). */
  defaultCollapsed?: boolean;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
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

  const title = step ? <Step n={step}>Install on your site</Step> : "Install snippet";
  const statusPill = !hasHeartbeat ? null : isLive ? <Pill tone="good">Installed{lastActivityLabel ? ` · ${lastActivityLabel}` : ""}</Pill> : status === "stale" ? <Pill tone="warn">Quiet for 7+ days</Pill> : <Pill tone="warn">Not installed yet</Pill>;

  if (collapsed && !bare) {
    return (
      <Panel
        title={title}
        aside={<>{statusPill}<button type="button" onClick={() => setCollapsed(false)} className="text-[var(--t-accent)] hover:underline">Show code</button></>}
      >
        <p className="text-[13px] text-[var(--t-muted)]">Changes above go live without re-installing.</p>
      </Panel>
    );
  }

  return (
    <Wrap bare={bare} title={title} aside={statusPill}>
      <div className="space-y-4">
      <p className="text-[13px] text-[var(--t-muted)]">
        Paste this before <code>&lt;/head&gt;</code> on every page. Works on WordPress, Wix, Webflow or any site that takes a script. Changes above go live without re-installing.
      </p>
      {picker}

      {hasHeartbeat ? <InstallStepper current={current} live={isLive} /> : null}

      <div className="relative">
        <pre className="overflow-x-auto rounded-[10px] border border-[var(--t-border)] bg-[#f7f9fd] px-3 py-3 pr-24 font-mono text-[12px] text-[var(--t-ink)]">
          <code>{snippet}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 rounded-full bg-[var(--t-primary-bg)] px-3 py-1 text-[12px] font-medium text-white hover:opacity-90"
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
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--t-border)] bg-white px-3.5 text-[12.5px] font-medium text-[var(--t-ink)] hover:bg-[var(--t-wash)] disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-3 w-3", verifying && "animate-spin")}
            strokeWidth={2}
          />
          {verifying ? "Checking..." : "Check install"}
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

      </div>
    </Wrap>
  );
}

function Wrap({ bare, children, ...panel }: { bare: boolean; title: React.ReactNode; aside: React.ReactNode; children: React.ReactNode }) {
  return bare ? <div>{children}</div> : <Panel {...panel}>{children}</Panel>;
}
