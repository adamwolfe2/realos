"use client";

import { useState, useTransition } from "react";
import { Bell, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLeadNotifySettings } from "@/app/actions/lead-notify-settings";

// ---------------------------------------------------------------------------
// LeadNotifySettings — operator-facing card in /portal/settings. Sets the
// forwarding email + 7 per-channel toggles, with a "Send test" button that
// triggers a real Resend send to the configured address so the operator can
// confirm delivery before the next live lead lands.
// ---------------------------------------------------------------------------

export type LeadNotifyInitial = {
  notifyLeadEmail: string | null;
  notifyLeadCcEmail: string | null;
  notifyLeadBccEmail: string | null;
  notifyOnChatbotLead: boolean;
  notifyOnPopupLead: boolean;
  notifyOnFormLead: boolean;
  notifyOnIngestLead: boolean;
  notifyOnTourRequest: boolean;
  notifyOnVisitorConvert: boolean;
  notifyOnManualLead: boolean;
};

type NotifyToggles = Omit<
  LeadNotifyInitial,
  "notifyLeadEmail" | "notifyLeadCcEmail" | "notifyLeadBccEmail"
>;
type ToggleKey = keyof NotifyToggles;

const TOGGLES: Array<{ key: ToggleKey; label: string; description: string }> = [
  {
    key: "notifyOnChatbotLead",
    label: "Chatbot leads",
    description: "Every time the website chatbot captures contact info.",
  },
  {
    key: "notifyOnPopupLead",
    label: "Popup leads",
    description: "Conversions from promo / exit-intent / referral popups.",
  },
  {
    key: "notifyOnFormLead",
    label: "Website forms",
    description: "Contact / apply / interest forms on your marketing site.",
  },
  {
    key: "notifyOnIngestLead",
    label: "Integration webhooks",
    description: "Leads pushed in via API key, Cursive pixel, or Zapier.",
  },
  {
    key: "notifyOnTourRequest",
    label: "Tour requests",
    description: "Net-new leads who book a tour through the public site.",
  },
  {
    key: "notifyOnVisitorConvert",
    label: "Visitor conversions",
    description: "Pixel-identified visitors promoted to leads from the portal.",
  },
  {
    key: "notifyOnManualLead",
    label: "Manual additions",
    description: "Leads added by teammates inside the portal.",
  },
];

type Status =
  | { kind: "idle" }
  | { kind: "ok"; msg: string }
  | { kind: "err"; msg: string };

export function LeadNotifySettings({
  initial,
}: {
  initial: LeadNotifyInitial;
}) {
  const [email, setEmail] = useState<string>(initial.notifyLeadEmail ?? "");
  const [ccEmail, setCcEmail] = useState<string>(
    initial.notifyLeadCcEmail ?? "",
  );
  const [bccEmail, setBccEmail] = useState<string>(
    initial.notifyLeadBccEmail ?? "",
  );
  const [toggles, setToggles] = useState<NotifyToggles>({
    notifyOnChatbotLead: initial.notifyOnChatbotLead,
    notifyOnPopupLead: initial.notifyOnPopupLead,
    notifyOnFormLead: initial.notifyOnFormLead,
    notifyOnIngestLead: initial.notifyOnIngestLead,
    notifyOnTourRequest: initial.notifyOnTourRequest,
    notifyOnVisitorConvert: initial.notifyOnVisitorConvert,
    notifyOnManualLead: initial.notifyOnManualLead,
  });
  const [pending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle" });
    startTransition(async () => {
      try {
        await updateLeadNotifySettings({
          notifyLeadEmail: email.trim() === "" ? null : email.trim(),
          notifyLeadCcEmail: ccEmail.trim() === "" ? null : ccEmail.trim(),
          notifyLeadBccEmail: bccEmail.trim() === "" ? null : bccEmail.trim(),
          ...toggles,
        });
        setStatus({ kind: "ok", msg: "Saved" });
      } catch (err) {
        setStatus({
          kind: "err",
          msg: err instanceof Error ? err.message : "Save failed",
        });
      }
    });
  }

  async function sendTest() {
    setStatus({ kind: "idle" });
    setTesting(true);
    try {
      const res = await fetch("/api/portal/settings/notify-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Test failed (${res.status})`);
      }
      const body = (await res.json()) as { deliveryId?: string };
      setStatus({
        kind: "ok",
        msg: body.deliveryId
          ? `Test sent — check ${email || "inbox"}`
          : "Test fired — check inbox",
      });
    } catch (err) {
      setStatus({
        kind: "err",
        msg: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="flex items-start gap-2.5 mb-5">
        <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Bell className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Lead notifications
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Get an email the moment a lead is captured — chatbot, form, popup,
            tour, integration webhook, manual add. The first 5 minutes are the
            difference between a tour and a ghost.
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="notifyLeadEmail" className="text-xs font-medium">
            Forwarding email
          </Label>
          <Input
            id="notifyLeadEmail"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="leads@yourcompany.com — comma-separate for multiple"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave empty to disable all lead notifications.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="notifyLeadCcEmail" className="text-xs font-medium">
              CC (optional)
            </Label>
            <Input
              id="notifyLeadCcEmail"
              type="text"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              placeholder="manager@yourcompany.com"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Copied openly on every notification. Comma-separate for multiple.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notifyLeadBccEmail" className="text-xs font-medium">
              BCC (optional)
            </Label>
            <Input
              id="notifyLeadBccEmail"
              type="text"
              value={bccEmail}
              onChange={(e) => setBccEmail(e.target.value)}
              placeholder="owner@yourcompany.com"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Copied privately — other recipients can&apos;t see them.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Channels</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TOGGLES.map((t) => (
              <label
                key={t.key}
                className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2.5 cursor-pointer hover:border-primary/40 transition-colors"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
                  checked={toggles[t.key]}
                  onChange={(e) =>
                    setToggles((prev) => ({
                      ...prev,
                      [t.key]: e.target.checked,
                    }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {t.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    {t.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={sendTest}
            disabled={testing || email.trim() === ""}
          >
            <Send className="size-3.5 mr-1.5" aria-hidden="true" />
            {testing ? "Sending…" : "Send test"}
          </Button>
          {status.kind === "ok" ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check className="size-3.5" aria-hidden="true" />
              {status.msg}
            </span>
          ) : null}
          {status.kind === "err" ? (
            <span className="text-xs text-destructive">{status.msg}</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
