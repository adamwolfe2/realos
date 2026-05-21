"use client";

import * as React from "react";
import { toast } from "sonner";
import { Tag, X, Plus } from "lucide-react";
import { savePropertyAttributes } from "@/lib/actions/property-attributes";
import { SUGGESTED_PROFILE_TAGS } from "@/lib/properties/attrs";

// ---------------------------------------------------------------------------
// AttributesEditor — operator-facing edit UI for the assetCategory +
// profileTags fields added in #68. Lives in the sidebar of the property
// overview tab.
//
// Without this, the filter chips on /portal/properties (#54) had nothing
// to filter against — operators could see the chip UI but had no way to
// actually tag a property as "near campus" or assign a category like
// "dorm-style". Closing that loop for Norman's pristine-shape audit.
//
// Behaviour:
//   - assetCategory: single-line free text. Saves on blur or Enter.
//   - profileTags: chip input. Type a tag + Enter to add; click × to
//     remove. Suggested tags surface as one-tap "add me" pills below.
//   - Save is automatic per change (no submit button) — keeps the
//     sidebar surface quiet and matches the inline-save model the
//     rest of the property surface uses.
// ---------------------------------------------------------------------------

export function AttributesEditor({
  propertyId,
  initialAssetCategory,
  initialProfileTags,
}: {
  propertyId: string;
  initialAssetCategory: string | null;
  initialProfileTags: string[];
}) {
  const [assetCategory, setAssetCategory] = React.useState(
    initialAssetCategory ?? "",
  );
  const [tags, setTags] = React.useState<string[]>(initialProfileTags);
  const [pendingTag, setPendingTag] = React.useState("");
  const [, startTransition] = React.useTransition();

  const persist = React.useCallback(
    (next: { assetCategory?: string; tags?: string[] }) => {
      startTransition(async () => {
        const result = await savePropertyAttributes({
          propertyId,
          assetCategory:
            next.assetCategory !== undefined ? next.assetCategory : assetCategory,
          profileTags: next.tags !== undefined ? next.tags : tags,
        });
        if (!result.ok) {
          toast.error(result.error);
        }
      });
    },
    [propertyId, assetCategory, tags],
  );

  const addTag = (raw: string) => {
    const v = raw.toLowerCase().trim();
    if (!v) return;
    if (tags.includes(v)) {
      setPendingTag("");
      return;
    }
    if (tags.length >= 10) {
      toast.error("Max 10 tags per property.");
      return;
    }
    const next = [...tags, v];
    setTags(next);
    setPendingTag("");
    persist({ tags: next });
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    persist({ tags: next });
  };

  // Surface only suggested tags the operator hasn't already added.
  const remainingSuggestions = SUGGESTED_PROFILE_TAGS.filter(
    (t) => !tags.includes(t),
  ).slice(0, 6);

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Attributes
        </p>
        <span className="text-[10px] tracking-widest uppercase text-muted-foreground/70">
          {tags.length}/10 tags
        </span>
      </header>

      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-semibold text-foreground/80 mb-1.5 block">
            Category
          </span>
          <input
            type="text"
            value={assetCategory}
            onChange={(e) => setAssetCategory(e.target.value)}
            onBlur={() => persist({ assetCategory })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            placeholder="e.g. dorm-style, apartment-style, warehouse"
            maxLength={80}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div>
          <span className="text-[11px] font-semibold text-foreground/80 mb-1.5 block">
            Profile tags
          </span>
          {tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <li
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 pl-2 pr-1 py-0.5 text-[11px] text-primary"
                >
                  <Tag className="h-2.5 w-2.5" aria-hidden="true" />
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove ${t}`}
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-primary/15 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex gap-1.5">
            <input
              type="text"
              value={pendingTag}
              onChange={(e) => setPendingTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(pendingTag);
                } else if (e.key === "Backspace" && !pendingTag && tags.length > 0) {
                  removeTag(tags[tags.length - 1]);
                }
              }}
              placeholder="Add a tag…"
              maxLength={40}
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => addTag(pendingTag)}
              disabled={!pendingTag.trim()}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Add tag"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {remainingSuggestions.length > 0 ? (
            <div className="mt-2.5">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground/70 mb-1.5">
                Suggested
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {remainingSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => addTag(s)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                      <span>{s}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
