"use client";

import * as React from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Mode-driven visual direction picker. Renders ONE of three modes at a time:
//   - 'style'      → presets + design language library (the centerpiece)
//   - 'colors'     → curated palette gallery + brand override
//   - 'references' → inspiration URLs + uploaded screenshots (both optional)
//
// Each mode now lives on its own top-level intake step so design + color
// choices feel like a dedicated decision rather than a buried sub-tab. The
// "Anything to avoid" negative-inputs textarea always renders alongside
// the chosen mode so the user can voice deal-breakers from any step.
//
// Pure presentational — owns no submit logic. Inspiration URL state lives
// on the parent (IntakeForm) so the existing `inspirationUrls` field stays
// the single source of truth.
// ---------------------------------------------------------------------------

export interface DesignLanguageOption {
  slug: string;
  name: string;
  description: string;
  category: string;
  colorPhilosophy: string | null;
  typography: string | null;
  motion: string | null;
  bestFor: string[];
  sampleColors: { primary: string | null; canvas: string | null };
  thumbnailReference: string | null;
  // Derived from slug → domain mapping (see lib/site-engine/visual-direction-catalogs.ts)
  website?: string;
  logoUrl?: string;
}

export interface PaletteOption {
  slug: string;
  name: string;
  description: string;
  category: string;
  industryFit: string[];
  previewImage: string;
  colors: { background: string; primary: string; accent: string };
  wcagAACompliant: boolean;
}

export interface PresetOption {
  slug: string;
  displayName: string;
  description: string;
  tone: string;
  bestFor: string[];
  designLanguageSlug: string | null;
}

export interface UploadedScreenshot {
  blobUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  label?: string;
}

export interface VisualDirectionValue {
  inspirationUrls: string[];
  uploadedScreenshots: UploadedScreenshot[];
  chosenPresetSlug: string | null;
  chosenDesignLanguageSlug: string | null;
  chosenPaletteSlug: string | null;
  negativeInputs: string;
}

export type VisualDirectionMode = "style" | "colors" | "references";

export interface VisualDirectionPickerProps {
  mode: VisualDirectionMode;
  value: VisualDirectionValue;
  onChange: (next: VisualDirectionValue) => void;
  presets: PresetOption[];
  designLanguages: DesignLanguageOption[];
  palettes: PaletteOption[];
}

// Mini visual thumbnails for the preset gallery. Sourced from each
// preset's tokens.css — when the kit's preset palette changes, update
// the matching row here.
const PRESET_THUMBS: Record<
  string,
  {
    bg: string;
    fg: string;
    muted: string;
    accent: string;
    hairline: string;
    displayFont: string;
  }
> = {
  "editorial-cream": {
    bg: "#F5F3EE",
    fg: "#0F1523",
    muted: "#8B92A5",
    accent: "#2A52BE",
    hairline: "#E2DDD6",
    displayFont: "Newsreader, Georgia, serif",
  },
  "editorial-luxury": {
    bg: "#F9F7F4",
    fg: "#0A0A0A",
    muted: "#8A8A8A",
    accent: "#C8C0B4",
    hairline: "#E5E1DB",
    displayFont: "Playfair Display, Georgia, serif",
  },
  "modern-premium": {
    bg: "#F5F5F5",
    fg: "#1A1A1A",
    muted: "#737373",
    accent: "#981B1B",
    hairline: "#E3E3E3",
    displayFont: "Inter, system-ui, sans-serif",
  },
  "pnw-editorial": {
    bg: "#F7F4EE",
    fg: "#1A1F2B",
    muted: "#525866",
    accent: "#4A6B4F",
    hairline: "rgba(26, 31, 43, 0.16)",
    displayFont: "Newsreader, Georgia, serif",
  },
  default: {
    bg: "#FAFAF7",
    fg: "#0F0F0F",
    muted: "#8A8A86",
    accent: "#0F0F0F",
    hairline: "#E5E2DA",
    displayFont: "Georgia, serif",
  },
};

export function VisualDirectionPicker({
  mode,
  value,
  onChange,
  presets,
  designLanguages,
  palettes,
}: VisualDirectionPickerProps) {
  const patch = React.useCallback(
    <K extends keyof VisualDirectionValue>(key: K, next: VisualDirectionValue[K]) => {
      onChange({ ...value, [key]: next });
    },
    [value, onChange],
  );

  return (
    <div className="space-y-5">
      {mode === "style" && (
        <StylePanel
          presets={presets}
          designLanguages={designLanguages}
          chosenPresetSlug={value.chosenPresetSlug}
          chosenDesignLanguageSlug={value.chosenDesignLanguageSlug}
          onChoosePreset={(slug) => patch("chosenPresetSlug", slug)}
          onChooseDesignLanguage={(slug) =>
            patch("chosenDesignLanguageSlug", slug)
          }
        />
      )}
      {mode === "colors" && (
        <PalettesPanel
          palettes={palettes}
          chosenPaletteSlug={value.chosenPaletteSlug}
          onChoose={(slug) => patch("chosenPaletteSlug", slug)}
        />
      )}
      {mode === "references" && (
        <ReferencesPanel
          urls={value.inspirationUrls}
          uploads={value.uploadedScreenshots}
          onChangeUrls={(u) => patch("inspirationUrls", u)}
          onChangeUploads={(s) => patch("uploadedScreenshots", s)}
        />
      )}

      {/* Always-visible negative inputs — voicable from any step. */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-2">
        <Label className="text-sm font-medium">Anything you definitely don't want?</Label>
        <p className="text-xs text-muted-foreground">
          Optional. "No bright colors", "no big sliders", "don't want anything that looks like X."
        </p>
        <textarea
          value={value.negativeInputs}
          onChange={(e) => patch("negativeInputs", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Tell us what to avoid..."
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode panels
// ---------------------------------------------------------------------------

function ReferencesPanel({
  urls,
  uploads,
  onChangeUrls,
  onChangeUploads,
}: {
  urls: string[];
  uploads: UploadedScreenshot[];
  onChangeUrls: (u: string[]) => void;
  onChangeUploads: (s: UploadedScreenshot[]) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-5">
        <UrlsPanel urls={urls} onChange={onChangeUrls} />
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <ScreenshotsPanel uploads={uploads} onChange={onChangeUploads} />
      </div>
    </div>
  );
}

function UrlsPanel({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (u: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (urls.length >= 5) return; // soft cap
    onChange([...urls, v]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <header>
        <h3 className="text-sm font-semibold">Inspiration sites</h3>
        <p className="text-sm text-muted-foreground">
          Drop in 1–5 URLs of sites you love. We'll screenshot them and use
          them as visual targets during the build.
        </p>
      </header>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://parishandcompany.com"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={urls.length >= 5}>
          Add
        </Button>
      </div>
      {urls.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {urls.map((u, i) => (
            <li
              key={`${u}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              <span className="truncate">{u}</span>
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No URLs added yet.</p>
      )}
    </div>
  );
}

function ScreenshotsPanel({
  uploads,
  onChange,
}: {
  uploads: UploadedScreenshot[];
  onChange: (s: UploadedScreenshot[]) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handle = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (uploads.length + files.length > 10) {
      setError("Max 10 screenshots. Remove some to add more.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const next = [...uploads];
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/site-requests/upload", {
          method: "POST",
          body,
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Upload failed: ${file.name}`);
        }
        next.push({
          blobUrl: json.url,
          filename: json.filename,
          mimeType: json.mimeType,
          size: json.size,
        });
      }
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <header>
        <h3 className="text-sm font-semibold">Upload screenshots</h3>
        <p className="text-sm text-muted-foreground">
          Drop in up to 10 reference screenshots. They feed into the build packet
          alongside any URL screenshots.
        </p>
      </header>
      <div className="flex items-center gap-3">
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handle(e.target.files)}
          disabled={uploading}
          className="max-w-sm"
        />
        {uploading ? (
          <span className="text-xs text-muted-foreground">Uploading…</span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {uploads.length === 0 ? (
        <p className="text-xs text-muted-foreground">No screenshots uploaded yet.</p>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {uploads.map((u, i) => (
            <li
              key={`${u.blobUrl}-${i}`}
              className="rounded-md border border-border p-2 bg-background space-y-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.blobUrl}
                alt={u.filename}
                className="w-full h-28 object-cover rounded"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="truncate" title={u.filename}>
                  {u.filename}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(uploads.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StylePanel({
  presets,
  designLanguages,
  chosenPresetSlug,
  chosenDesignLanguageSlug,
  onChoosePreset,
  onChooseDesignLanguage,
}: {
  presets: PresetOption[];
  designLanguages: DesignLanguageOption[];
  chosenPresetSlug: string | null;
  chosenDesignLanguageSlug: string | null;
  onChoosePreset: (slug: string | null) => void;
  onChooseDesignLanguage: (slug: string | null) => void;
}) {
  const [view, setView] = React.useState<"presets" | "languages">("presets");
  const [filterCategory, setFilterCategory] = React.useState<string>("all");
  const [filterColorPhilosophy, setFilterColorPhilosophy] =
    React.useState<string>("all");
  const [filterBestFor, setFilterBestFor] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const languageCategories = React.useMemo(
    () =>
      Array.from(new Set(designLanguages.map((d) => d.category))).sort(),
    [designLanguages],
  );
  const colorPhilosophies = React.useMemo(
    () =>
      Array.from(
        new Set(designLanguages.map((d) => d.colorPhilosophy).filter(Boolean)),
      ).sort() as string[],
    [designLanguages],
  );
  const bestForOptions = React.useMemo(
    () =>
      Array.from(new Set(designLanguages.flatMap((d) => d.bestFor))).sort(),
    [designLanguages],
  );

  const filteredLanguages = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return designLanguages.filter((d) => {
      if (filterCategory !== "all" && d.category !== filterCategory) return false;
      if (
        filterColorPhilosophy !== "all" &&
        d.colorPhilosophy !== filterColorPhilosophy
      )
        return false;
      if (filterBestFor !== "all" && !d.bestFor.includes(filterBestFor))
        return false;
      if (q) {
        const hay = [
          d.name,
          d.slug,
          d.description,
          d.category,
          ...(d.bestFor ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    designLanguages,
    filterCategory,
    filterColorPhilosophy,
    filterBestFor,
    searchQuery,
  ]);

  const anyFilterActive =
    filterCategory !== "all" ||
    filterColorPhilosophy !== "all" ||
    filterBestFor !== "all" ||
    searchQuery.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setView("presets")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
            view === "presets"
              ? "bg-foreground text-background border-foreground"
              : "bg-card border-border hover:bg-muted/40",
          )}
        >
          Our presets ({presets.length})
        </button>
        <button
          type="button"
          onClick={() => setView("languages")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
            view === "languages"
              ? "bg-foreground text-background border-foreground"
              : "bg-card border-border hover:bg-muted/40",
          )}
        >
          Design language library ({designLanguages.length})
        </button>
      </div>

      {view === "presets" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map((p) => {
            const active = p.slug === chosenPresetSlug;
            const thumb = PRESET_THUMBS[p.slug] ?? PRESET_THUMBS.default;
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => onChoosePreset(active ? null : p.slug)}
                className={cn(
                  "rounded-md border text-left transition-colors overflow-hidden flex flex-col",
                  active
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border bg-background hover:bg-muted/30",
                )}
              >
                {/* Real PNG screenshot captured from the starter-template
                    (site-engine-kit/scripts/capture-preset-screenshots.mjs).
                    Synthetic block renders FIRST in DOM order as a
                    background fallback; the image paints on top of it,
                    so when the PNG loads it fully covers the fallback. */}
                <div
                  className="relative border-b border-border overflow-hidden"
                  style={{
                    aspectRatio: "1200/600",
                    background: thumb.bg,
                  }}
                >
                  <div className="absolute inset-0 px-4 py-5 pointer-events-none">
                    <div
                      className="text-[15px] tracking-tight leading-snug"
                      style={{
                        color: thumb.fg,
                        fontFamily: thumb.displayFont,
                        fontWeight: 600,
                      }}
                    >
                      Sample Headline
                    </div>
                    <div
                      className="mt-1 text-[10px]"
                      style={{ color: thumb.muted }}
                    >
                      Supporting text in the body face
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/site-engine/presets/${p.slug}.png`}
                    alt={`${p.displayName} preview`}
                    className="absolute inset-0 w-full h-full object-cover object-top bg-white"
                    loading="lazy"
                  />
                </div>

                <div className="p-4 space-y-2 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-semibold">{p.displayName}</h4>
                    {active ? (
                      <span className="text-[10px] uppercase tracking-widest text-primary font-bold">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {p.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {p.bestFor.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, vibe, or use case..."
                className="h-8 text-xs max-w-xs"
              />
              <span className="text-xs text-muted-foreground">
                {filteredLanguages.length} of {designLanguages.length} shown
              </span>
              {anyFilterActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory("all");
                    setFilterColorPhilosophy("all");
                    setFilterBestFor("all");
                    setSearchQuery("");
                  }}
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                title="Filter by category"
              >
                <option value="all">All categories</option>
                {languageCategories.map((c) => (
                  <option key={c} value={c}>
                    {humanCategory(c)}
                  </option>
                ))}
              </select>
              <select
                value={filterColorPhilosophy}
                onChange={(e) => setFilterColorPhilosophy(e.target.value)}
                className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                title="Filter by color philosophy"
              >
                <option value="all">All palettes</option>
                {colorPhilosophies.map((c) => (
                  <option key={c} value={c}>
                    {humanCategory(c)}
                  </option>
                ))}
              </select>
              <select
                value={filterBestFor}
                onChange={(e) => setFilterBestFor(e.target.value)}
                className="h-7 rounded-md border border-input bg-transparent px-2 text-xs max-w-[180px]"
                title="Filter by best-for use case"
              >
                <option value="all">Any use case</option>
                {bestForOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredLanguages.map((d) => {
              const active = d.slug === chosenDesignLanguageSlug;
              const displayDomain = d.website
                ? d.website.replace(/^https?:\/\//, "")
                : null;
              return (
                <div
                  key={d.slug}
                  className={cn(
                    "rounded-md border transition-colors flex flex-col",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted/30",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onChooseDesignLanguage(active ? null : d.slug)}
                    className="p-3 text-left space-y-1.5 flex-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {d.logoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={d.logoUrl}
                            alt={`${d.name} logo`}
                            className="size-6 rounded-sm bg-white object-contain border border-border/50 shrink-0"
                            loading="lazy"
                            onError={(e) => {
                              // Clearbit returns 404 for unknown domains —
                              // hide the broken image cleanly.
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : null}
                        <h4 className="text-sm font-semibold capitalize truncate">
                          {d.name}
                        </h4>
                      </div>
                      {active ? (
                        <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} aria-label="Selected" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{humanCategory(d.category)}</span>
                      {d.colorPhilosophy ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{d.colorPhilosophy.replaceAll("-", " ")}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
                      {d.description}
                    </p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {d.sampleColors.canvas ? (
                        <span
                          className="size-3.5 rounded-sm border border-border"
                          style={{ background: d.sampleColors.canvas }}
                        />
                      ) : null}
                      {d.sampleColors.primary ? (
                        <span
                          className="size-3.5 rounded-sm border border-border"
                          style={{ background: d.sampleColors.primary }}
                        />
                      ) : null}
                    </div>
                  </button>
                  {d.website ? (
                    <a
                      href={d.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 border-t border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{displayDomain}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PalettesPanel({
  palettes,
  chosenPaletteSlug,
  onChoose,
}: {
  palettes: PaletteOption[];
  chosenPaletteSlug: string | null;
  onChoose: (slug: string | null) => void;
}) {
  const [filterCategory, setFilterCategory] = React.useState<string>("all");
  const categories = React.useMemo(
    () => Array.from(new Set(palettes.map((p) => p.category))).sort(),
    [palettes],
  );
  const filtered =
    filterCategory === "all"
      ? palettes
      : palettes.filter((p) => p.category === filterCategory);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs">Filter:</Label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {humanCategory(c)}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {palettes.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
        {filtered.map((p) => {
          const active = p.slug === chosenPaletteSlug;
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => onChoose(active ? null : p.slug)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors space-y-2",
                active
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:bg-muted/30",
              )}
              style={{ background: p.colors.background }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h4
                  className="text-sm font-semibold"
                  style={{ color: p.colors.primary }}
                >
                  {p.name}
                </h4>
                {active ? (
                  <Check
                    className="w-4 h-4"
                    strokeWidth={1.5}
                    style={{ color: p.colors.primary }}
                    aria-label="Selected"
                  />
                ) : null}
              </div>
              <div className="flex gap-1">
                <span
                  className="flex-1 h-6 rounded-sm"
                  style={{ background: p.colors.background, border: "1px solid rgba(0,0,0,0.1)" }}
                />
                <span
                  className="flex-1 h-6 rounded-sm"
                  style={{ background: p.colors.primary }}
                />
                <span
                  className="flex-1 h-6 rounded-sm"
                  style={{ background: p.colors.accent }}
                />
              </div>
              <p
                className="text-[10px] uppercase tracking-wider"
                style={{ color: p.colors.primary, opacity: 0.6 }}
              >
                {humanCategory(p.category)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanCategory(c: string): string {
  return c.replaceAll("-", " ");
}

// Silence unused-import warning on Image — kept for future preview-image usage
// in design language cards.
void Image;
