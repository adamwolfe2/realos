"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, RefreshCw } from "lucide-react";
import {
  backfillChatbotLeadEmails,
  updateLeadRouting,
} from "@/lib/actions/chatbot-config";

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
  const [email, setEmail] = useState(notifyLeadEmail ?? "");
  const [enabled, setEnabled] = useState(notifyOnChatbotLead);
  const [error, setError] = useState<string | null>(null);
  const [backfillDayRange, setBackfillDayRange] = useState<7 | 30 | 90>(30);
  const [candidateCount, setCandidateCount] = useState<number | null>(null);

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

  const recipients = email
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const recipientCount = recipients.length;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
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
            className="w-full h-10 px-3 rounded-md border border-border bg-background text-[13.5px] focus:outline-none focus:ring-1 focus:ring-foreground/30"
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

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md text-[13px] font-semibold text-white bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Saving…" : "Save lead routing"}
          </button>
          {recipientCount > 0 && enabled ? (
            <span className="text-[11.5px] text-emerald-600 font-medium">
              ✓ Active for {recipientCount} recipient
              {recipientCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
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
              className="h-8 px-2 rounded-md border border-border bg-background text-[12.5px]"
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
              if (
                !window.confirm(
                  `Send rich profile emails for ${candidateCount} captured conversation${candidateCount === 1 ? "" : "s"} to ${recipients.join(", ")}?\n\nEach email includes the prospect's full chat profile and a direct link to engage. Takes a few seconds per conversation.`,
                )
              ) {
                return;
              }
              startBackfill(async () => {
                const result = await backfillChatbotLeadEmails({
                  dayRange: backfillDayRange,
                  dryRun: false,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(
                  `Sent ${result.sent} email${result.sent === 1 ? "" : "s"}${
                    result.skipped > 0 ? ` · ${result.skipped} skipped` : ""
                  }${result.failed > 0 ? ` · ${result.failed} failed` : ""}`,
                );
                // Refresh the candidate count for a UX confirmation
                // ("0 captured conversations ready to email" after).
                const fresh = await backfillChatbotLeadEmails({
                  dayRange: backfillDayRange,
                  dryRun: true,
                });
                if (fresh.ok) setCandidateCount(fresh.candidateCount);
                router.refresh();
              });
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
    </section>
  );
}
