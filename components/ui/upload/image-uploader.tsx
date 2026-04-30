"use client";

import * as React from "react";
import Image from "next/image";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Reusable image uploader. Uses /api/tenant/uploads (Vercel Blob, scoped
// to the current tenant). Supports drag-drop, click-to-select, paste, and
// returns the resulting public URL via onUploaded.
//
// Used in the property edit dialog (hero image) and elsewhere when a single
// image URL is the target.
// ---------------------------------------------------------------------------

export type ImageUploaderProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  accept?: string;
  className?: string;
  alt?: string;
  preview?: "square" | "wide";
  disabled?: boolean;
};

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/avif,image/svg+xml";

export function ImageUploader({
  value,
  onChange,
  label = "Upload image",
  accept = DEFAULT_ACCEPT,
  className,
  alt = "Uploaded image",
  preview = "wide",
  disabled,
}: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/tenant/uploads", {
        method: "POST",
        body: fd,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }
      onChange(json.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset so re-selecting the same file works
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function onPaste(e: React.ClipboardEvent) {
    if (disabled || uploading) return;
    const file = Array.from(e.clipboardData.items || []).find((i) =>
      i.type.startsWith("image/"),
    );
    if (file) {
      const f = file.getAsFile();
      if (f) uploadFile(f);
    }
  }

  const aspect = preview === "square" ? "aspect-square" : "aspect-[16/9]";

  return (
    <div className={cn("space-y-2", className)} onPaste={onPaste}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onFileSelected}
        disabled={disabled || uploading}
        className="hidden"
      />
      {value ? (
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-md border border-border bg-muted/40",
            aspect,
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-x-2 bottom-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1 rounded-md bg-black/60 text-white px-2.5 py-1 text-xs font-medium backdrop-blur-sm hover:bg-black/80 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1 rounded-md bg-black/60 text-white px-2.5 py-1 text-xs font-medium backdrop-blur-sm hover:bg-black/80 disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          disabled={disabled || uploading}
          className={cn(
            "relative w-full rounded-md border-2 border-dashed bg-muted/20 transition-colors flex flex-col items-center justify-center gap-2",
            aspect,
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/40",
            (disabled || uploading) && "opacity-60 cursor-not-allowed",
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
          <p className="text-xs font-medium text-foreground">
            {uploading ? "Uploading…" : label}
          </p>
          {!uploading ? (
            <p className="text-[10px] text-muted-foreground">
              Drop, paste, or click to upload (PNG, JPG, WEBP, up to 10MB)
            </p>
          ) : null}
        </button>
      )}
      {error ? (
        <p className="text-xs text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
