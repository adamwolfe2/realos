"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Format =
  | "BLOG_POST"
  | "NEIGHBORHOOD_PAGE"
  | "PROPERTY_DESCRIPTION"
  | "META_REWRITE"
  | "FAQ_BLOCK"
  | "AD_COPY";

type Props = {
  draftId: string;
  propertyId: string;
  format: Format;
  originalBrief: string;
  reviewNotes: string;
  targetQuery: string | null;
};

// ---------------------------------------------------------------------------
// ResubmitWithChangesButton — appears on the operator draft preview when
// status is CHANGES_REQUESTED. Click opens an inline editor pre-filled
// with the original brief + the admin's review notes as a header, so
// the operator just adjusts and submits without retyping.
//
// On submit:
//   1. POST a new draft (operator's brief is the merged version)
//   2. PATCH the original to EXPIRED so it leaves the active queue
//   3. Redirect to the new draft preview
// ---------------------------------------------------------------------------
export function ResubmitWithChangesButton({
  draftId,
  propertyId,
  format,
  originalBrief,
  reviewNotes,
  targetQuery,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState(buildPrefilled(originalBrief, reviewNotes));
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (brief.trim().length < 8) {
      toast.error("Brief is too short.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Spawn new draft
      const res = await fetch("/api/portal/seo/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          format,
          brief: brief.trim(),
          targetQuery: targetQuery ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? "Resubmit failed.");
        return;
      }

      // 2. Mark original as cancelled. Best-effort — even if this fails
      //    the operator's view shows the new one as the live draft.
      await fetch(`/api/portal/seo/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      }).catch(() => undefined);

      // 3. Hop to the new draft
      toast.success("Resubmitted. Admin will review.");
      const newId = body?.draft?.id;
      if (newId) {
        router.push(`/portal/seo/agent/drafts/${newId}`);
      } else {
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Re-submit with changes →
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div>
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-primary">
          Re-submit
        </p>
        <h3 className="mt-0.5 text-sm font-semibold text-foreground">
          Apply the admin&apos;s notes and re-submit
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          The original brief is pre-filled below with the review notes
          appended as a comment. Edit and submit.
        </p>
      </div>

      <textarea
        rows={8}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-vertical font-mono"
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "Generating new draft…" : "Re-submit"}
        </button>
      </div>
    </div>
  );
}

function buildPrefilled(originalBrief: string, notes: string): string {
  return [
    originalBrief.trim(),
    "",
    "",
    "// Admin review notes:",
    ...notes
      .trim()
      .split("\n")
      .map((line) => `// ${line}`),
    "",
    "// Adjust the brief above to address the notes, then submit.",
  ].join("\n");
}
