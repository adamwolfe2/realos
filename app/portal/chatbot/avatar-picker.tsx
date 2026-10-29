"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, Loader2, AlertTriangle } from "lucide-react";

// Upload only (Norman, 2026-05-21: the paste-a-URL path confused operators).
// The endpoint persists the URL immediately; the hidden form input keeps a
// later Save from clearing it.
export function AvatarPicker({ value, personaName, onChange }: { value: string; personaName: string; onChange: (v: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    // Mirrors the server route so we fail before paying for the upload.
    if (file.size > 2 * 1024 * 1024) return setError("Max 2 MB.");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return setError("Use JPEG, PNG, WebP or GIF.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/portal/chatbot/avatar", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) throw new Error(json.error ?? `Upload failed (${res.status})`);
      onChange(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (uploading) return;
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/portal/chatbot/avatar", { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Remove failed");
      }
      onChange("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-[var(--t-text)]">Photo</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title={value ? "Replace photo" : "Upload photo (square, max 2 MB)"} className="group relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--t-border)] bg-[var(--t-wash)] text-[13px] font-semibold text-[var(--t-text)]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Chatbot photo" className="h-full w-full object-cover" onError={() => setError("Image failed to load. Re-upload it.")} />
          ) : (
            (personaName.trim()[0] ?? "L").toUpperCase()
          )}
          <span className="absolute inset-0 grid place-items-center bg-[rgba(11,21,48,0.45)] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </span>
        </button>
        {value ? (
          <button type="button" onClick={handleRemove} disabled={uploading} aria-label="Remove photo" className="text-[var(--t-muted)] hover:text-[#b91c1c] disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            // Reset so re-selecting the same file fires again.
            e.target.value = "";
          }}
        />
      </div>
      {error ? (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-[#b91c1c]"><AlertTriangle className="h-3 w-3" />{error}</span>
      ) : null}
    </div>
  );
}
