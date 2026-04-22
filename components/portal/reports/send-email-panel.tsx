"use client";

import { useState, useTransition } from "react";
import { Mail, Send } from "lucide-react";
import { sendReportToRecipients } from "@/lib/actions/reports";

type Props = {
  reportId: string;
  defaultRecipient: string | null;
  defaultRecipientName: string | null;
  canSend: boolean;
};

type Feedback =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; subject?: string }
  | { kind: "preview_only"; subject?: string }
  | { kind: "error"; message: string };

export function SendEmailPanel({
  reportId,
  defaultRecipient,
  defaultRecipientName,
  canSend,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [recipients, setRecipients] = useState(defaultRecipient ?? "");
  const [recipientName, setRecipientName] = useState(defaultRecipientName ?? "");
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });

  function handleSend() {
    const list = recipients
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));

    if (list.length === 0) {
      setFeedback({ kind: "error", message: "Add at least one email address." });
      return;
    }

    setFeedback({ kind: "sending" });
    startTransition(async () => {
      try {
        const res = await sendReportToRecipients(reportId, {
          to: list,
          recipientName: recipientName.trim() || null,
        });
        if (res.ok) {
          setFeedback({ kind: "ok", subject: res.previewSubject });
        } else if (res.skipped === "no_resend_key") {
          setFeedback({ kind: "preview_only", subject: res.previewSubject });
        } else {
          setFeedback({ kind: "error", message: res.error ?? "Send failed" });
        }
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : "Send failed",
        });
      }
    });
  }

  return (
    <section
      data-no-print
      className="rounded-xl border border-border bg-card p-5 space-y-4"
    >
      <div>
        <div className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          <Mail className="h-3 w-3" />
          Deliver
        </div>
        <h2 className="mt-1 text-base font-semibold text-foreground">
          Send to client
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Sends the report straight to your client's inbox with your headline
          and personal note already baked in. The email links back to the
          shareable read-only view.
        </p>
      </div>

      {!canSend ? (
        <div className="rounded-md bg-muted border border-border px-3 py-2 text-xs text-muted-foreground">
          Save your headline + note first, then come back to send.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Recipients
          </span>
          <input
            type="text"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="norman@spectrumpartners.com, leasing@..."
            className="rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-[10px] text-muted-foreground">
            Comma, semicolon or space separated.
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Greeting name
          </span>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Norman"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Feedback feedback={feedback} />
        <button
          type="button"
          onClick={handleSend}
          disabled={pending || !canSend}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 py-2 text-sm font-semibold text-white hover:bg-foreground/90 disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" />
          {pending ? "Sending..." : "Send report"}
        </button>
      </div>
    </section>
  );
}

function Feedback({ feedback }: { feedback: Feedback }) {
  if (feedback.kind === "idle") return null;
  if (feedback.kind === "sending") {
    return <span className="text-xs text-muted-foreground">Sending...</span>;
  }
  if (feedback.kind === "ok") {
    return (
      <span className="text-xs text-emerald-700">
        Sent. Subject: {feedback.subject ?? "—"}
      </span>
    );
  }
  if (feedback.kind === "preview_only") {
    return (
      <span className="text-xs text-amber-700">
        Email isn't wired yet (missing Resend key). Report is still shareable
        via the link above.
      </span>
    );
  }
  return <span className="text-xs text-rose-700">{feedback.message}</span>;
}
