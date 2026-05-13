"use client";

import { useRef, useState, useTransition } from "react";
import {
  Check,
  X,
  RotateCcw,
  Loader2,
  ImagePlus,
  Globe,
  Link2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  setPropertyLifecycle,
  setPropertyLifecycleBulk,
} from "@/lib/actions/properties";
import {
  scrapePropertyImagesAction,
  setPropertyImagesAction,
} from "@/lib/actions/property-images";
import { PropertyAvatar } from "@/components/portal/properties/property-avatar";

// ---------------------------------------------------------------------------
// CurationQueueClient
//
// Per-row affordances:
//   - Activate / Exclude / Restore (lifecycle, existing)
//   - "Add image" — opens an inline mini panel with three options:
//       1. Scrape from {hostname} (only if websiteUrl present)
//       2. Paste hero image URL
//       3. Upload file → Vercel Blob via /api/tenant/uploads
//
// The PropertyAvatar (size="sm") replaces the previous Building2 icon, so
// the operator gets instant visual feedback once an image is attached.
// ---------------------------------------------------------------------------

type Item = {
  id: string;
  name: string;
  slug: string;
  address: string;
  totalUnits: number | null;
  backendPlatform: string | null;
  backendPropertyId: string | null;
  excludeReason: string | null;
  lifecycleSetBy: string;
  createdAt: string;
  heroImageUrl: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
};

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function CurationQueueClient({
  items,
  view,
}: {
  items: Item[];
  view: "imported" | "excluded";
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openImageRow, setOpenImageRow] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  function actSingle(id: string, action: "activate" | "exclude" | "restore") {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await setPropertyLifecycle({ propertyId: id, action });
      if (!result.ok) setErrorMessage(result.error);
    });
  }

  function actBulk(action: "activate" | "exclude") {
    if (selected.size === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await setPropertyLifecycleBulk({
        propertyIds: Array.from(selected),
        action,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 sticky top-0 z-10">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="ml-auto flex gap-2">
            {view === "imported" && (
              <>
                <button
                  type="button"
                  onClick={() => actBulk("activate")}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
                  title="Activate selected — these will count toward your marketable property total and billing"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  Activate ({selected.size}) · counts toward billing
                </button>
                <button
                  type="button"
                  onClick={() => actBulk("exclude")}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted/40 disabled:opacity-50"
                  title="Exclude — keep in AppFolio mirror but do not bill or surface in dashboards"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  Exclude all
                </button>
              </>
            )}
            {view === "excluded" && (
              <button
                type="button"
                onClick={() => actBulk("activate")}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Restore as active
              </button>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected.size === items.length && items.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-border"
            aria-label="Select all"
          />
          <span className="text-xs text-muted-foreground">
            Select all
          </span>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "px-4 py-3 hover:bg-muted/20 transition-colors",
                selected.has(item.id) && "bg-primary/5",
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="mt-1 h-4 w-4 rounded border-border"
                  aria-label={`Select ${item.name}`}
                />
                <PropertyAvatar
                  src={item.heroImageUrl}
                  logoSrc={item.logoUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {item.name}
                    </span>
                    {item.totalUnits ? (
                      <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">
                        {item.totalUnits} units
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">
                        no units
                      </span>
                    )}
                    {item.backendPlatform === "APPFOLIO" && (
                      <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/30">
                        AppFolio · {item.backendPropertyId}
                      </span>
                    )}
                    {item.lifecycleSetBy === "AUTO_CLASSIFIER" && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10">
                        auto-classified
                      </span>
                    )}
                  </div>
                  {item.address && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {item.address}
                    </p>
                  )}
                  {item.excludeReason && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      Reason: {item.excludeReason}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {view === "imported" ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenImageRow((id) =>
                            id === item.id ? null : item.id,
                          )
                        }
                        disabled={pending}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors disabled:opacity-50",
                          openImageRow === item.id
                            ? "border-foreground bg-muted/60 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted/40",
                        )}
                        title="Add hero image — paste URL, upload, or scrape from website"
                        aria-expanded={openImageRow === item.id}
                      >
                        <ImagePlus className="w-3 h-3" aria-hidden="true" />
                        {item.heroImageUrl ? "Image" : "Add image"}
                      </button>
                      <button
                        type="button"
                        onClick={() => actSingle(item.id, "activate")}
                        disabled={pending}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
                        title="Activate this property — will count toward your marketable total and billing"
                      >
                        {pending ? (
                          <Loader2
                            className="w-3 h-3 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Check className="w-3 h-3" aria-hidden="true" />
                        )}
                        Activate
                      </button>
                      <button
                        type="button"
                        onClick={() => actSingle(item.id, "exclude")}
                        disabled={pending}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground rounded border border-border hover:bg-muted/40 disabled:opacity-50"
                        title="Exclude — keep in AppFolio mirror but do not bill or display"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                        Exclude
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => actSingle(item.id, "activate")}
                      disabled={pending}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
                      title="Restore — bring back into active properties"
                    >
                      {pending ? (
                        <Loader2
                          className="w-3 h-3 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      )}
                      Restore
                    </button>
                  )}
                </div>
              </div>

              {view === "imported" && openImageRow === item.id && (
                <ImageActionsPanel
                  property={item}
                  onDone={() => setOpenImageRow(null)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageActionsPanel — inline mini-flow for attaching a hero image.
// Three actions, none mutually exclusive:
//   1. Scrape from {hostname}      → scrapePropertyImagesAction
//   2. Paste URL ___________ Save  → setPropertyImagesAction
//   3. Upload file                 → POST /api/tenant/uploads → set
// ---------------------------------------------------------------------------

function ImageActionsPanel({
  property,
  onDone,
}: {
  property: Item;
  onDone: () => void;
}) {
  const [scraping, setScraping] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pastedUrl, setPastedUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const host = hostnameOf(property.websiteUrl);

  async function onScrape() {
    if (!property.websiteUrl) return;
    setScraping(true);
    const toastId = toast.loading(`Scraping ${host ?? "website"}…`);
    try {
      const res = await scrapePropertyImagesAction({
        propertyId: property.id,
        websiteUrl: property.websiteUrl,
      });
      if (!res.ok) {
        toast.error(`Scrape failed: ${res.error}`, { id: toastId });
        return;
      }
      const { result } = res;
      if (result.heroSet || result.logoSet) {
        toast.success(
          result.heroSet
            ? "Hero image found and saved"
            : "Logo found and saved",
          { id: toastId },
        );
        onDone();
      } else {
        toast.error(
          `Scrape returned no image${
            result.error ? `: ${result.error}` : ""
          }`,
          { id: toastId },
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Scrape failed",
        { id: toastId },
      );
    } finally {
      setScraping(false);
    }
  }

  async function onSaveUrl() {
    const trimmed = pastedUrl.trim();
    if (!trimmed) return;
    try {
      // Light client-side validation so we don't fire a server roundtrip
      // for obviously bad input.
      new URL(trimmed);
    } catch {
      toast.error("Enter a valid image URL (https://…)");
      return;
    }
    setSavingUrl(true);
    const toastId = toast.loading("Saving image URL…");
    try {
      const res = await setPropertyImagesAction({
        propertyId: property.id,
        heroImageUrl: trimmed,
      });
      if (!res.ok) {
        toast.error(`Save failed: ${res.error}`, { id: toastId });
        return;
      }
      toast.success("Hero image saved", { id: toastId });
      setPastedUrl("");
      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Save failed",
        { id: toastId },
      );
    } finally {
      setSavingUrl(false);
    }
  }

  async function onUpload(file: File) {
    setUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/tenant/uploads", {
        method: "POST",
        body: fd,
      });
      const json = (await r.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!r.ok || !json.url) {
        toast.error(json.error ?? "Upload failed", { id: toastId });
        return;
      }
      const res = await setPropertyImagesAction({
        propertyId: property.id,
        heroImageUrl: json.url,
      });
      if (!res.ok) {
        toast.error(`Save failed: ${res.error}`, { id: toastId });
        return;
      }
      toast.success("Hero image uploaded", { id: toastId });
      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Upload failed",
        { id: toastId },
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const anyBusy = scraping || savingUrl || uploading;

  return (
    <div className="mt-3 ml-10 rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {property.websiteUrl ? (
          <button
            type="button"
            onClick={onScrape}
            disabled={anyBusy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-border bg-card hover:bg-muted/40 disabled:opacity-50"
            title={`Pull og:image / logo from ${property.websiteUrl}`}
          >
            {scraping ? (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            ) : (
              <Globe className="w-3 h-3" aria-hidden="true" />
            )}
            Scrape from {host ?? "website"}
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">
            No website URL set — paste one below or upload a file.
          </span>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={anyBusy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-border bg-card hover:bg-muted/40 disabled:opacity-50"
          title="Upload an image file (PNG/JPG/WebP, up to 10MB)"
        >
          {uploading ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="w-3 h-3" aria-hidden="true" />
          )}
          Upload file
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Link2
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="url"
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSaveUrl();
              }
            }}
            placeholder="Paste image URL (https://…)"
            disabled={anyBusy}
            className="w-full pl-7 pr-2 py-1 text-xs rounded border border-border bg-card focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
            aria-label="Hero image URL"
          />
        </div>
        <button
          type="button"
          onClick={onSaveUrl}
          disabled={anyBusy || !pastedUrl.trim()}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {savingUrl ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="w-3 h-3" aria-hidden="true" />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={anyBusy}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground rounded border border-border hover:bg-muted/40 disabled:opacity-50"
          aria-label="Close image actions"
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
