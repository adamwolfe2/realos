"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, X, Loader2, ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// BugReportButton — floating button that opens a modal for filing a bug
// straight from any portal/admin page.
//
// Submits multipart/form-data to /api/bug-report with optional image
// attachments. Three ways to attach screenshots:
//   1. Click the "Add screenshot" button → native file picker
//   2. Drag-and-drop image files onto the modal
//   3. Paste from clipboard (Cmd+V) — captures the system screenshot
//      shortcut workflow (Cmd+Shift+5 → paste) which is how most
//      operators actually grab screenshots
//
// Max 5 images per report, 8 MB each. JPEG / PNG / WebP / GIF.
// ---------------------------------------------------------------------------

type Severity = "low" | "medium" | "high" | "blocker";

const SEVERITIES: Array<{ value: Severity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocker", label: "Blocker" },
];

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type AttachedImage = {
  /** Stable per-session id so React keys are unique even when filenames repeat. */
  id: string;
  file: File;
  previewUrl: string;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; githubUrl: string | null }
  | { kind: "error"; message: string };

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      setState({ kind: "idle" });
      setImageError(null);
      titleRef.current?.focus();
    } else {
      // Clean up object URLs when modal closes — preview blobs leak
      // otherwise on long sessions where the user opens and closes the
      // modal repeatedly without submitting.
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      setImages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Clipboard paste support — the most ergonomic image-upload path.
  // Modern operators screenshot via Cmd+Shift+4 (macOS) or Win+Shift+S
  // (Windows), both of which put the image on the clipboard. We listen
  // ONLY when the modal is open + the focus is inside it so we don't
  // hijack paste elsewhere on the page.
  useEffect(() => {
    if (!open) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file && file.type.startsWith("image/")) pasted.push(file);
      }
      if (pasted.length > 0) {
        e.preventDefault();
        addImages(pasted);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, images]);

  function addImages(files: File[]) {
    setImageError(null);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageError(`Maximum ${MAX_IMAGES} screenshots per report.`);
      return;
    }
    const incoming = files.slice(0, remaining);
    const accepted: AttachedImage[] = [];
    for (const file of incoming) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        setImageError(`${file.name}: unsupported file type (${file.type}).`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError(`${file.name} is larger than 8 MB.`);
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (accepted.length > 0) {
      setImages((prev) => [...prev, ...accepted]);
    }
    if (files.length > remaining) {
      setImageError(
        `Only the first ${remaining} attachment${remaining === 1 ? "" : "s"} accepted (max ${MAX_IMAGES} per report).`,
      );
    }
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addImages(files);
    if (e.target) e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0) addImages(files);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      const viewport =
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : undefined;

      // Multipart so we can ship images alongside fields. The API
      // accepts JSON too for backward compat, but multipart is the
      // path with attachments.
      const form = new FormData();
      form.set("title", title);
      form.set("description", description);
      form.set("severity", severity);
      if (typeof window !== "undefined") {
        form.set("pageUrl", window.location.href);
      }
      if (pathname) form.set("pagePath", pathname);
      if (typeof navigator !== "undefined") {
        form.set("userAgent", navigator.userAgent);
      }
      if (viewport) form.set("viewport", viewport);
      for (const img of images) {
        form.append("images", img.file, img.file.name);
      }

      const res = await fetch("/api/bug-report", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      setState({ kind: "ok", githubUrl: body.githubUrl ?? null });
      setTitle("");
      setDescription("");
      setSeverity("medium");
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      setImages([]);
      setTimeout(() => {
        setOpen(false);
        setState({ kind: "idle" });
      }, 2000);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to send report",
      });
    }
  }

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        title="Report a bug"
        className={cn(
          // Norman 2026-05-21: bug button moves to bottom-LEFT so the
          // top-right is free for the user icon next to the bell, and
          // the bottom-right stays clear for the floating onboarding
          // checklist widget.
          "fixed z-40 bottom-4 left-4 md:bottom-6 md:left-6",
          "inline-flex items-center gap-2 rounded-full",
          "bg-foreground text-background",
          "px-4 py-2.5 text-xs font-semibold tracking-wide",
          "shadow-lg shadow-black/20 hover:shadow-xl",
          "hover:bg-foreground/90 transition-all",
          "border border-foreground/10",
        )}
      >
        <Bug className="w-4 h-4" aria-hidden="true" />
        <span>Report bug</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report a bug"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:justify-end p-4 md:p-6"
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragActive(false);
          }}
          onDrop={onDrop}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              "relative w-full md:w-[460px] max-h-[90vh] overflow-y-auto",
              "rounded-lg bg-card border border-border shadow-2xl",
              dragActive && "ring-4 ring-primary/40",
            )}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bug className="w-4 h-4" aria-hidden="true" />
                  Report a bug
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Goes straight to the engineering inbox. Attach screenshots
                  so we can see exactly what you saw.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {state.kind === "ok" ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm font-semibold text-emerald-700">
                  Report received.
                </p>
                <p className="text-xs text-muted-foreground">
                  Adam has been notified by email
                  {state.githubUrl ? " and a GitHub issue was filed" : ""}. You
                  can track it under Admin → Bug Reports.
                </p>
                {state.githubUrl ? (
                  <a
                    href={state.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    View on GitHub
                  </a>
                ) : null}
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 space-y-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                    Title
                  </span>
                  <input
                    ref={titleRef}
                    type="text"
                    required
                    minLength={3}
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short summary of the issue"
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                    Severity
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SEVERITIES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSeverity(s.value)}
                        className={cn(
                          "px-2 py-1.5 text-xs font-medium rounded border transition-colors",
                          severity === s.value
                            ? "bg-primary text-primary-foreground border-foreground"
                            : "bg-card text-muted-foreground border-border hover:text-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                    What happened
                  </span>
                  <textarea
                    required
                    minLength={5}
                    maxLength={8000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Steps to reproduce, expected vs actual behavior, anything else that helps."
                    rows={5}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                  />
                </label>

                {/* Image attachments */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                      Screenshots
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {images.length}/{MAX_IMAGES} · paste, drop, or pick
                    </span>
                  </div>
                  {images.length > 0 ? (
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {images.map((img) => (
                        <li
                          key={img.id}
                          className="relative aspect-video rounded-md border border-border overflow-hidden bg-muted group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.previewUrl}
                            alt={img.file.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            aria-label={`Remove ${img.file.name}`}
                            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <span className="absolute bottom-0 inset-x-0 text-[9px] text-white bg-black/50 px-1 py-0.5 truncate">
                            {img.file.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {canAddMore ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "w-full rounded-md border-2 border-dashed transition-colors py-3 text-xs font-medium",
                        dragActive
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-secondary",
                      )}
                    >
                      <ImagePlus className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                      {dragActive
                        ? "Drop image to attach"
                        : "Add screenshot · paste / drop / browse"}
                    </button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    hidden
                    onChange={onPickFiles}
                  />
                  {imageError ? (
                    <p className="text-[11px] text-destructive">{imageError}</p>
                  ) : null}
                </div>

                <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
                  We'll automatically include your current page URL, viewport
                  size, and user agent.
                </div>

                {state.kind === "error" ? (
                  <p className="text-xs text-destructive">{state.message}</p>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={state.kind === "sending"}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40"
                  >
                    {state.kind === "sending" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send report"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
