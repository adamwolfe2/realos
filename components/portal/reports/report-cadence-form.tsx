"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveReportCadence } from "@/lib/actions/report-cadence";

// ---------------------------------------------------------------------------
// ReportCadenceForm — client form for /portal/reports/settings.
//
// Three controls: cadence radio group, recipient textarea (one email
// per line), and auto-send toggle. Auto-send is force-disabled in the
// UI when there are no valid recipients OR cadence is "none" — keeps
// the operator from silently configuring a non-functional state.
// ---------------------------------------------------------------------------

type Cadence = "none" | "daily" | "weekly" | "monthly";

const CADENCE_OPTIONS: Array<{ value: Cadence; label: string; hint: string }> = [
  { value: "none", label: "Off", hint: "Draft only — operator ships manually" },
  { value: "daily", label: "Daily", hint: "Ships at 07:30 UTC every day" },
  { value: "weekly", label: "Weekly", hint: "Mondays at 07:00 UTC" },
  { value: "monthly", label: "Monthly", hint: "1st of the month at 07:00 UTC" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ReportCadenceForm({
  initial,
}: {
  initial: { cadence: string; recipients: string[]; autoSend: boolean };
}) {
  const [cadence, setCadence] = useState<Cadence>(
    (CADENCE_OPTIONS.find((o) => o.value === initial.cadence)?.value ??
      "none") as Cadence,
  );
  const [recipientText, setRecipientText] = useState(
    initial.recipients.join("\n"),
  );
  const [autoSend, setAutoSend] = useState(initial.autoSend);
  const [pending, startTransition] = useTransition();

  // Parse recipients as the operator types so the auto-send toggle gates
  // on actual validity, not just non-empty text.
  const parsedRecipients = React.useMemo(() => {
    const lines = recipientText.split(/[\n,;]/);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of lines) {
      const v = raw.toLowerCase().trim();
      if (!v) continue;
      if (!EMAIL_RE.test(v)) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }, [recipientText]);

  const canAutoSend = cadence !== "none" && parsedRecipients.length > 0;
  // Force the toggle off whenever the upstream conditions don't allow
  // auto-send, but preserve the operator's intent by keeping the local
  // state — so flipping recipients back on restores autoSend without
  // them having to re-click.
  const effectiveAutoSend = canAutoSend && autoSend;

  const submit = () => {
    startTransition(async () => {
      const result = await saveReportCadence({
        cadence,
        autoSend: effectiveAutoSend,
        recipients: parsedRecipients,
      });
      if (result.ok) {
        toast.success(
          `Saved — cadence ${result.cadence}, ${result.recipientCount} ${result.recipientCount === 1 ? "recipient" : "recipients"}.`,
        );
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <fieldset className="space-y-3">
        <legend className="text-[11px] tracking-widest uppercase font-semibold text-muted-foreground">
          Cadence
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CADENCE_OPTIONS.map((opt) => {
            const checked = cadence === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex flex-col gap-0.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="cadence"
                    value={opt.value}
                    checked={checked}
                    onChange={() => setCadence(opt.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {opt.label}
                  </span>
                </span>
                <span className="text-[11.5px] text-muted-foreground pl-[22px]">
                  {opt.hint}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor="recipients"
          className="block text-[11px] tracking-widest uppercase font-semibold text-muted-foreground"
        >
          Recipients
        </label>
        <textarea
          id="recipients"
          value={recipientText}
          onChange={(e) => setRecipientText(e.target.value)}
          rows={5}
          placeholder="ops@example.com&#10;owner@example.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-[11px] text-muted-foreground">
          One email per line (or comma-separated). Up to 25 valid
          addresses. We dedupe + lowercase before saving.
        </p>
        {parsedRecipients.length > 0 ? (
          <p className="text-[11px] text-foreground">
            <span className="font-semibold tabular-nums">
              {parsedRecipients.length}
            </span>{" "}
            valid {parsedRecipients.length === 1 ? "recipient" : "recipients"}.
          </p>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Auto-send the moment a snapshot is generated
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
            When off, the cron drafts the report and notifies you — you
            ship it manually. When on, the report goes straight to the
            recipient list.
          </p>
          {!canAutoSend ? (
            <p className="text-[11.5px] text-amber-700 mt-1.5">
              {cadence === "none"
                ? "Pick a cadence other than Off to enable auto-send."
                : "Add at least one valid recipient email to enable auto-send."}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={effectiveAutoSend}
          disabled={!canAutoSend}
          onClick={() => setAutoSend((v) => !v)}
          className={`shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            effectiveAutoSend ? "bg-primary" : "bg-muted"
          } ${!canAutoSend ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
              effectiveAutoSend ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save cadence"}
        </button>
      </div>
    </form>
  );
}
