"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, RefreshCw } from "lucide-react";
import {
  backfillChatbotLeadEmails,
  sendTestLeadEmail,
  updateLeadRouting,
} from "@/lib/actions/chatbot-config";
import { AlertDialog } from "@/components/portal/ui/alert-dialog";

// ---------------------------------------------------------------------------
// LeadRoutingPanel — surfaces Organization.notifyLeadEmail +
// Organization.notifyOnChatbotLead on the /portal/chatbot page so the
// operator can set "send every chatbot lead to this inbox" without
// touching the database.
//
// The same notifyLeadEmail is used by popup / form / ingest / tour
// channels too — we put it on the chatbot page because that's where
// operators look first when they want to know where leads go.
// ---------------------------------------------------------------------------

export function LeadRoutingPanel({
  notifyLeadEmail,
  notifyOnChatbotLead,
}: {
  notifyLeadEmail: string | null;
  notifyOnChatbotLead: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [backfillPending, startBackfill] = useTransition();
  const [testPending, startTest] = useTransition();
  const [email, setEmail] = useState(notifyLeadEmail ?? "");
  const [enabled, setEnabled] = useState(notifyOnChatbotLead);
  const [error, setError] = useState<string | null>(null);
  const [backfillDayRange, setBackfillDayRange] = useState<7 | 30 | 90>(30);
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  // Backfill is expensive (real emails go out) — confirm via the shared
  // AlertDialog instead of window.confirm.
  const [confirmBackfill, setConfirmBackfill] = useState(false);

  // Dry-run the backfill query whenever the look-back window changes
  // (or on mount) so the operator sees the candidate count BEFORE
  // they click "Send catch-up emails".
  useEffect(() => {
    let cancelled = false;
    backfillChatbotLeadEmails({ dayRange: backfillDayRange, dryRun: true })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setCandidateCount(r.candidateCount);
        else setCandidateCount(null);
      })
      .catch(() => {
        if (!cancelled) setCandidateCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [backfillDayRange]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("notifyLeadEmail", email.trim());
    fd.set("notifyOnChatbotLead", enabled ? "true" : "false");
    startTransition(async () => {
      const result = await updateLeadRouting(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Lead routing saved");
      router.refresh();
    });
  }

  // Fires the real (non-dry-run) backfill. Only reachable via the
  // AlertDialog confirm on the "Send catch-up emails" button.
  function runBackfill() {
    startBackfill(async () => {
      // Server actions can throw (timeouts, deploy mid-flight,
      // upstream 500s) and the rejection collapses to a generic
      // "An unexpected response was received from the server"
      // toast. Catch explicitly so we get an actionable error
      // instead of a stuck Sending… spinner.
      let result: Awaited<ReturnType<typeof backfillChatbotLeadEmails>>;
      try {
        result = await backfillChatbotLeadEmails({
          dayRange: backfillDayRange,
          dryRun: false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Backfill request failed: ${msg}`);
        setDiagnostic(
          `✗ Backfill request failed before returning: ${msg}\n\nThis usually means the serverless function timed out. Try a shorter time window (Last 7 days) or wait a minute and retry.`,
        );
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        setDiagnostic(`✗ Backfill failed: ${result.error}`);
        return;
      }
      toast.success(
        result.sent > 0
          ? `Sent 1 digest covering ${result.sent} profile${result.sent === 1 ? "" : "s"}${
              result.failed > 0
                ? ` · ${result.failed} extraction${result.failed === 1 ? "" : "s"} failed`
                : ""
            }`
          : `0 profiles sent · ${result.failed} failed · ${result.skipped} skipped`,
      );
      // Per-conversation diagnostic so the operator can see
      // WHY emails skipped or failed (suppression, extraction
      // null, Resend error, etc). Pull the unique non-"sent"
      // reasons up top so the actionable failure modes are
      // visible without scrolling.
      {
        // Use the action's AUTHORITATIVE counts (failed/skipped) to
        // decide success — don't infer failures by string-matching
        // reasons. The digest path pushes a SUCCESS reason
        // ("digest sent · N profiles"), which isn't the literal
        // "sent" and was being miscounted as "1 not sent" even when
        // every recipient received the email.
        const problems = (result.reasons ?? []).filter(
          (r) => !r.startsWith("digest sent") && r !== "sent",
        );
        const clean = result.failed === 0 && result.skipped === 0;
        const summary = clean
          ? `✓ Sent 1 digest covering ${result.sent} profile${result.sent === 1 ? "" : "s"} to all ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`
          : `Sent ${result.sent}/${result.candidateCount}. ${result.failed} failed${result.skipped ? `, ${result.skipped} skipped` : ""}:\n  · ${[...new Set(problems)].slice(0, 5).join("\n  · ")}`;
        setDiagnostic(summary);
      }
      // Refresh the candidate count for a UX confirmation
      // ("0 captured conversations ready to email" after).
      const fresh = await backfillChatbotLeadEmails({
        dayRange: backfillDayRange,
        dryRun: true,
      });
      if (fresh.ok) setCandidateCount(fresh.candidateCount);
      router.refresh();
    });
  }

  const recipients = email
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const recipientCount = recipients.length;

  return (
    <section className="ls-card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-primary" aria-hidden />
            Lead routing
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Every time the chatbot captures a lead (pre-chat capture,
            auto-detected email/phone mid-chat, operator handoff, or
            idle-conversation digest), we send an email here with the
            prospect&apos;s profile and a one-click link to engage with
            the live chat. Same address is used by popup, form, and
            tour-request captures.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-[12px] font-medium text-foreground mb-1.5">
            Send chatbot leads to
          </span>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jessica@telegraph-commons.com, leasing@..."
            className="w-full h-10 px-3 rounded-[2px] border border-border bg-background text-[13.5px] focus:outline-none focus:ring-1 focus:ring-foreground/30"
          />
          <span className="block mt-1 text-[11.5px] text-muted-foreground">
            Comma-separate to add the leasing manager, asset team, or
            anyone else who should be in the loop.
            {recipientCount > 0
              ? ` ${recipientCount} recipient${recipientCount === 1 ? "" : "s"} will receive each notification.`
              : " No recipients set — chatbot leads are not being emailed right now."}
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-[13px] text-foreground">
            Notify on chatbot leads
          </span>
          <span className="text-[11.5px] text-muted-foreground">
            (channel switch — turn off to silence chatbot pings without
            removing the email above)
          </span>
        </label>

        {error ? (
          <p className="text-[12px] text-destructive">{error}</p>
        ) : null}

        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-[2px] text-[13px] font-semibold text-white bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Saving…" : "Save lead routing"}
          </button>
          <button
            type="button"
            disabled={
              testPending || recipientCount === 0 || !enabled
            }
            onClick={() => {
              setDiagnostic(null);
              startTest(async () => {
                const result = await sendTestLeadEmail();
                if (!result.ok) {
                  const detail = result.details ? ` · ${result.details}` : "";
                  toast.error(`Test failed: ${result.error}${detail}`);
                  setDiagnostic(`✗ ${result.error}${detail}`);
                  return;
                }
                toast.success(
                  `Test sent to ${result.sentTo.join(", ")} · Resend id ${result.resendId ?? "(none)"}`,
                );
                setDiagnostic(
                  `✓ Test sent to ${result.sentTo.join(", ")} · Resend id ${result.resendId ?? "(none)"}. If you don't see it in 60 seconds, check spam.`,
                );
              });
            }}
            className="inline-flex items-center justify-center h-9 px-4 rounded-[2px] text-[13px] font-medium border border-border bg-background hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testPending ? "Sending…" : "Send test email"}
          </button>
          {recipientCount > 0 && enabled ? (
            <span className="text-[11.5px] text-[#24a148] font-medium">
              ✓ Active for {recipientCount} recipient
              {recipientCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {diagnostic ? (
          <pre
            className={`text-[11.5px] font-mono whitespace-pre-wrap leading-relaxed ${
              diagnostic.startsWith("✓")
                ? "text-[#24a148]"
                : "text-destructive"
            }`}
          >
            {diagnostic}
          </pre>
        ) : null}
      </form>

      {/* Backfill / catch-up tool. Sits below the save form so the
          operator sees it AFTER they've set the email. Only fires when
          there are recipients configured + the channel toggle is on. */}
      <div
        className="mt-5 pt-5 border-t border-border"
        aria-label="Catch up on missed leads"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 text-primary" aria-hidden />
              Catch up on missed leads
            </h3>
            <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed max-w-xl">
              Re-send the rich profile email for every chatbot
              conversation that captured a lead in the look-back window.
              Useful right after setting the email above — the team
              gets a full backfill in one click.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-[12px] text-foreground flex items-center gap-2">
            Window
            <select
              value={backfillDayRange}
              onChange={(e) =>
                setBackfillDayRange(
                  Number(e.target.value) as 7 | 30 | 90,
                )
              }
              className="h-8 px-2 rounded-[2px] border border-border bg-background text-[12.5px]"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>

          <span className="text-[12px] text-muted-foreground">
            {candidateCount === null
              ? "Counting eligible conversations…"
              : candidateCount === 0
                ? "No captured conversations in this window."
                : `${candidateCount} captured conversation${candidateCount === 1 ? "" : "s"} ready to email.`}
          </span>

          <button
            type="button"
            disabled={
              backfillPending ||
              candidateCount === null ||
              candidateCount === 0 ||
              recipientCount === 0 ||
              !enabled
            }
            onClick={() => {
              if (recipientCount === 0) {
                toast.error(
                  "Set + save a recipient email before backfilling.",
                );
                return;
              }
              if (!enabled) {
                toast.error(
                  "Enable chatbot lead notifications before backfilling.",
                );
                return;
              }
              if (candidateCount === null || candidateCount === 0) return;
              setConfirmBackfill(true);
            }}
            className="inline-flex items-center justify-center h-8 px-3 rounded-md text-[12.5px] font-semibold text-white bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {backfillPending
              ? "Sending…"
              : candidateCount === null || candidateCount === 0
                ? "Send catch-up emails"
                : `Send ${candidateCount} catch-up email${candidateCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      <AlertDialog
        open={confirmBackfill}
        title={`Send ${candidateCount ?? 0} catch-up email${candidateCount === 1 ? "" : "s"}?`}
        body={`One digest email covering ${candidateCount ?? 0} captured conversation${candidateCount === 1 ? "" : "s"} goes to ${recipients.join(", ")}. Claude extracts each profile in parallel (~${Math.ceil((candidateCount ?? 0) / 4) * 2 + 5} sec total) and ${recipients.length === 1 ? "the recipient receives" : "each recipient receives"} a single email with all prospects sorted hot → warm → cold.`}
        confirmLabel="Send digest"
        pending={backfillPending}
        onCancel={() => setConfirmBackfill(false)}
        onConfirm={() => {
          setConfirmBackfill(false);
          runBackfill();
        }}
      />
    </section>
  );
}
