"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

type Format =
  | "BLOG_POST"
  | "NEIGHBORHOOD_PAGE"
  | "PROPERTY_DESCRIPTION"
  | "META_REWRITE"
  | "FAQ_BLOCK"
  | "AD_COPY";

const FORMATS: { id: Format; label: string; hint: string }[] = [
  {
    id: "BLOG_POST",
    label: "Blog post",
    hint: "Long-form 1,200-1,800 word article for a target query.",
  },
  {
    id: "NEIGHBORHOOD_PAGE",
    label: "Neighborhood page",
    hint: "Local landing page with FAQs + AEO citations for nearby search.",
  },
  {
    id: "META_REWRITE",
    label: "Title + meta rewrite",
    hint: "Fix an existing page that ranks but gets very few clicks.",
  },
  {
    id: "FAQ_BLOCK",
    label: "FAQ block",
    hint: "5-8 schema.org Q&A pairs to lift AEO citation rate.",
  },
  {
    id: "PROPERTY_DESCRIPTION",
    label: "Property description",
    hint: "150-300 word listing copy tuned for chatbot grounding.",
  },
  {
    id: "AD_COPY",
    label: "Ad copy",
    hint: "Google + Meta variants for a converting query.",
  },
];

type Props = {
  propertyId: string;
  propertyName: string;
  /** Pre-fill the modal when launched from a recommendation. */
  prefill?: {
    format?: Format;
    brief?: string;
    targetQuery?: string;
    recommendationId?: string;
  };
};

// ---------------------------------------------------------------------------
// DraftLauncher — operator-facing button that opens a modal to spawn a
// new ContentDraft for the current property. Submits to
// POST /api/portal/seo/drafts and shows the resulting draft id in a toast
// so the operator can find it in their inbox.
// ---------------------------------------------------------------------------
export function DraftLauncher({ propertyId, propertyName, prefill }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>(prefill?.format ?? "BLOG_POST");
  const [brief, setBrief] = useState(prefill?.brief ?? "");
  const [targetQuery, setTargetQuery] = useState(prefill?.targetQuery ?? "");
  const [audience, setAudience] = useState("");
  const [voice, setVoice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  async function submit() {
    if (brief.trim().length < 8) {
      toast.error("Add a brief — at least one sentence.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/seo/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          format,
          brief: brief.trim(),
          targetQuery: targetQuery.trim() || undefined,
          audience: audience.trim() || undefined,
          voice: voice.trim() || undefined,
          recommendationId: prefill?.recommendationId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? "Generation failed.");
        return;
      }
      toast.success("Draft ready — admin will review.");
      setOpen(false);
      setBrief("");
      setTargetQuery("");
      setAudience("");
      setVoice("");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-primary/15 transition-colors"
      >
        Generate draft
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-primary">
                  Content drafter
                </p>
                <h2 className="text-base font-semibold text-foreground mt-0.5">
                  New draft for {propertyName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[18px] leading-none text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Format
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      className={`rounded-lg border p-2.5 text-left text-[12px] transition-colors ${
                        format === f.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <div className="font-medium">{f.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {f.hint}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="brief"
                  className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Brief
                </label>
                <textarea
                  id="brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={4}
                  placeholder="What should this draft do? E.g. Counter Acme Apartments' AI citation for 'best amenities in downtown.'"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div>
                <label
                  htmlFor="targetQuery"
                  className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Target query (optional)
                </label>
                <input
                  id="targetQuery"
                  type="text"
                  value={targetQuery}
                  onChange={(e) => setTargetQuery(e.target.value)}
                  placeholder="e.g. apartments near Marquette University"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="audience"
                    className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    Audience (optional)
                  </label>
                  <input
                    id="audience"
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="students, young professionals…"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="voice"
                    className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    Voice (optional)
                  </label>
                  <input
                    id="voice"
                    type="text"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    placeholder="warm + casual, professional…"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5 bg-muted/30">
              <p className="text-[11px] text-muted-foreground">
                Drafts take ~15s. Admin reviews before anything ships.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Generating…" : "Generate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
