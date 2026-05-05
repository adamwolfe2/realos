"use client";

import * as React from "react";
import { useTransition } from "react";
import { MessageSquare, Loader2, Check, X } from "lucide-react";
import { sendLeadSms } from "@/lib/actions/lead-sms";

// Lead-detail SMS composer. Hidden when Twilio isn't configured (parent
// passes smsEnabled=false). Mirrors the email composer flow.

type Props = {
  leadId: string;
  to: string | null;
  smsEnabled: boolean;
};

export function LeadSmsComposer({ leadId, to, smsEnabled }: Props) {
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [pending, startTransition] = useTransition();

  if (!smsEnabled) return null;

  function close() {
    if (pending) return;
    setOpen(false);
    setTimeout(() => {
      setBody("");
      setError(null);
      setSuccess(false);
    }, 200);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const r = await sendLeadSms({ leadId, body: body.trim() });
      if (r.ok) {
        setSuccess(true);
        setTimeout(close, 1200);
      } else {
        setError(r.error);
      }
    });
  }

  if (!to) {
    return (
      <button
        type="button"
        disabled
        title="No phone on file"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-card ring-1 ring-border text-muted-foreground opacity-50 cursor-not-allowed"
      >
        <MessageSquare className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send SMS"
        aria-label="Send SMS"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-card ring-1 ring-border text-foreground transition-colors duration-200 hover:bg-muted"
      >
        <MessageSquare className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
              <div className="min-w-0">
                <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Send SMS
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
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={1600}
                disabled={pending || success}
                placeholder="Hi! Just confirming your tour tomorrow at 3pm…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{body.length} / 1600 characters</span>
                <span>1 SMS = 160 chars</span>
              </div>
              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-xs px-3 py-2">
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || success || !body.trim()}
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
                      <MessageSquare className="h-3.5 w-3.5" />
                      Send SMS
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
