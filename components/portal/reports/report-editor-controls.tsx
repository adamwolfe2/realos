"use client";

import { useState, useTransition } from "react";
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setSaveState("saving");
    startTransition(async () => {
      try {
        await updateReport(reportId, { headline, notes });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1800);
      } catch {
        setSaveState("idle");
      }
    });
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
      className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
            Operator review
          </div>
          <h2 className="mt-1 text-base font-semibold text-[var(--near-black)]">
            Personalize before you share
          </h2>
          <p className="text-xs text-[var(--olive-gray)] mt-0.5">
            The numbers below are frozen. Your headline and note are the human
            layer your client reads first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === "shared" && shareUrl ? (
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center rounded-md border border-[var(--border-cream)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--warm-sand)]"
            >
              {copied ? "Copied" : "Copy share link"}
            </button>
          ) : null}
          {status !== "shared" ? (
            <button
              type="button"
              onClick={handleMarkShared}
              disabled={pending}
              className="inline-flex items-center rounded-md bg-[var(--near-black)] text-white px-3 py-2 text-sm font-medium hover:bg-black transition-colors disabled:opacity-60"
            >
              Mark as shared
            </button>
          ) : null}
          {status !== "archived" ? (
            <button
              type="button"
              onClick={handleArchive}
              disabled={pending}
              className="inline-flex items-center rounded-md border border-[var(--border-cream)] bg-white px-3 py-2 text-sm font-medium text-[var(--olive-gray)] hover:text-[var(--near-black)]"
            >
              Archive
            </button>
          ) : null}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
          Headline
        </span>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Top of mind this week: tour pipeline is strong and Google Ads CPL dropped 18%."
          className="rounded-md border border-[var(--border-cream)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terracotta)]/30"
          maxLength={200}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
          Personal note from Adam
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Hey Norman. Solid week. Organic traffic is up because the Parents FAQ page started ranking. I'd recommend doubling down on long-tail queries around campus neighborhoods next."
          className="rounded-md border border-[var(--border-cream)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terracotta)]/30"
          maxLength={2000}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--stone-gray)]">
          {saveState === "saving"
            ? "Saving..."
            : saveState === "saved"
              ? "Saved"
              : "Autosave is off. Hit save to persist your changes."}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || saveState === "saving"}
          className="inline-flex items-center rounded-md border border-[var(--border-cream)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--warm-sand)] disabled:opacity-60"
        >
          Save draft
        </button>
      </div>
    </section>
  );
}
