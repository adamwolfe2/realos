"use client";

import * as React from "react";
import { useTransition } from "react";
import { Send, X, Loader2, Check } from "lucide-react";
import { sendLeadEmail } from "@/lib/actions/lead-email";

// In-app email composer for /portal/leads/[id]. Pops a slide-up sheet on
// click, lets the operator type subject + body, and fires sendLeadEmail
// (which audits + updates the lead's lastEmailSentAt counter).
//
// Replaces the previous mailto: link, which left the platform every time.

type Props = {
  leadId: string;
  to: string | null;
  defaultSubject?: string;
  unsubscribed?: boolean;
};

export function LeadEmailComposer({
  leadId,
  to,
  defaultSubject,
  unsubscribed,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState(defaultSubject ?? "");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setSubject(defaultSubject ?? "");
    setBody("");
    setError(null);
    setSuccess(false);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setTimeout(reset, 200);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const r = await sendLeadEmail({
        leadId,
        subject: subject.trim(),
        body: body.trim(),
      });
      if (r.ok) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 1200);
      } else {
        setError(r.error);
      }
    });
  }

  if (!to || unsubscribed) {
    return (
      <button
        type="button"
        disabled
        title={unsubscribed ? "Lead has unsubscribed" : "No email on file"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-card ring-1 ring-border text-muted-foreground opacity-50 cursor-not-allowed"
      >
        <Send className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send email"
        title="Send email"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-card ring-1 ring-border text-foreground transition-colors duration-200 hover:bg-muted"
      >
        <Send className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
              <div className="min-w-0">
                <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Send email
                </p>
                <p className="text-sm font-medium text-foreground truncate">
                  To: {to}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                aria-label="Close composer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="p-5 space-y-3">
              <div>
                <label
                  htmlFor="lead-email-subject"
                  className="text-xs font-medium text-foreground block mb-1"
                >
                  Subject
                </label>
                <input
                  id="lead-email-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                  disabled={pending || success}
                  placeholder="Quick follow-up on your tour…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label
                  htmlFor="lead-email-body"
                  className="text-xs font-medium text-foreground block mb-1"
                >
                  Message
                </label>
                <textarea
                  id="lead-email-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={8}
                  maxLength={8000}
                  disabled={pending || success}
                  placeholder="Type your message. We'll add the greeting and signature automatically."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Lead replies arrive at your default reply-to address. The
                  send is logged in the audit trail.
                </p>
              </div>

              {error ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    pending ||
                    success ||
                    !subject.trim() ||
                    !body.trim()
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending…
                    </>
                  ) : success ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Sent
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Send email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
