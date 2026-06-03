"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { updateLeadRouting } from "@/lib/actions/chatbot-config";

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
  const [email, setEmail] = useState(notifyLeadEmail ?? "");
  const [enabled, setEnabled] = useState(notifyOnChatbotLead);
  const [error, setError] = useState<string | null>(null);

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
    </section>
  );
}
