"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveReport, updateReport } from "@/lib/actions/reports";

// ---------------------------------------------------------------------------
// ReportEditorControls
//
// Client-side operator panel that sits above the report preview. Captures the
// headline + personal note, triggers "mark as shared", copies the share link,
// and archives. All mutations go through server actions.
// ---------------------------------------------------------------------------

type Props = {
  reportId: string;
  initialHeadline: string;
  initialNotes: string;
  status: "draft" | "shared" | "archived";
  shareUrl: string | null;
};

export function ReportEditorControls({
  reportId,
  initialHeadline,
  initialNotes,
  status,
  shareUrl,
}: Props) {
  const router = useRouter();
  const [headline, setHeadline] = useState(initialHeadline);
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  // Track the last successfully-saved values so the autosave effect can
  // detect "no changes since last save" and skip the network round-trip.
  const lastSavedRef = useRef({
    headline: initialHeadline,
    notes: initialNotes,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave with 1.2s debounce — fires whenever headline or notes drift
  // from what was last persisted. Replaces the previous "Autosave is off"
  // copy which the audit flagged as a confidence issue: client-facing
  // reports should not lose draft edits on a stray navigation.
  useEffect(() => {
    if (
      headline === lastSavedRef.current.headline &&
      notes === lastSavedRef.current.notes
    ) {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSave();
    }, 1200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headline, notes]);

  function doSave() {
    const snapshot = { headline, notes };
    setSaveState("saving");
    startTransition(async () => {
      try {
        await updateReport(reportId, snapshot);
        lastSavedRef.current = snapshot;
        setLastSavedAt(new Date());
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("error");
      }
    });
  }

  function handleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSave();
  }

  function handleMarkShared() {
    startTransition(async () => {
      await updateReport(reportId, { headline, notes, status: "shared" });
      router.refresh();
    });
  }

  function handleArchive() {
    if (!confirm("Archive this report? You can still view it from the archived filter.")) {
      return;
    }
    startTransition(async () => {
      await archiveReport(reportId);
      router.push("/portal/reports");
    });
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked. Fall back to a prompt so the user can copy manually.
      window.prompt("Copy the share link", shareUrl);
    }
  }

  return (
    <section
      data-no-print
      className="rounded-xl border border-border bg-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Operator review
          </div>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Personalize before you share
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The numbers below are frozen. Your headline and note are the human
            layer your client reads first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === "shared" && shareUrl ? (
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center rounded-md border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              {copied ? "Copied" : "Copy share link"}
            </button>
          ) : null}
          {status !== "shared" ? (
            <button
              type="button"
              onClick={handleMarkShared}
              disabled={pending}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              Mark as shared
            </button>
          ) : null}
          {status !== "archived" ? (
            <button
              type="button"
              onClick={handleArchive}
              disabled={pending}
              className="inline-flex items-center rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Archive
            </button>
          ) : null}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Headline
        </span>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Top of mind this week: tour pipeline is strong and Google Ads CPL dropped 18%."
          className="rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={200}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Personal note
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="A quick context-setting note from you — what's working, what to double down on next, anything the client should know before skimming the numbers."
          className="rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={2000}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs ${
            saveState === "error"
              ? "text-rose-700"
              : "text-muted-foreground"
          }`}
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Save failed — click Save draft to retry."
                : lastSavedAt
                  ? `Autosaved ${formatRelativeTime(lastSavedAt)}`
                  : "Autosaves as you type."}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || saveState === "saving"}
          className="inline-flex items-center rounded-md border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          Save draft
        </button>
      </div>
    </section>
  );
}

// Compact "X ago" string for the autosave indicator. Avoids importing
// date-fns just for one helper inside a client component bundle.
function formatRelativeTime(date: Date): string {
  const ageSec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (ageSec < 5) return "just now";
  if (ageSec < 60) return `${ageSec}s ago`;
  const min = Math.floor(ageSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
