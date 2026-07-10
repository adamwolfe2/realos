"use client";

// ---------------------------------------------------------------------------
// PropertyHeroBanner — premium "profile picture" treatment for a single
// property. Used as the lead surface on the property detail page and (in
// a compact variant) on the main dashboard so a featured property like
// Telegraph Commons reads as a brand, not a row in a table.
//
// Norman feedback (2026-05-21):
//   • "Telegraph Commons metrics are NOT looking good in the dashboard."
//   • "How can I upload an image of telegraph to make it feel more
//      premium? Ideally we could upload an image of the building and
//      have some nice BG remover workflow to make it 3D and POP."
//
// Visual model:
//
//   ┌───────────────────────────────────────────────────────────────┐
//   │ ░░░░░░░░░ brand-blue radial wash + soft grid ░░░░░░░░░░░░    │
//   │                                                                │
//   │   ╔══════════╗   TELEGRAPH COMMONS                            │
//   │   ║ building ║   Berkeley · Student housing                    │
//   │   ║ image    ║   ────────────────                              │
//   │   ║ floats   ║   99   1,136   $214                            │
//   │   ║ above    ║   Walk  Sessions  CPL                          │
//   │   ╚══════════╝   ────────────────                              │
//   │                                                                │
//   └───────────────────────────────────────────────────────────────┘
//
// The image sits inside a rounded card with:
//   • drop-shadow(0 30px 40px) for the lift
//   • subtle bottom radial-gradient shadow on the *parent* for grounding
//   • mix-blend so even a square photo reads as "floating"
//
// "BG-remover workflow" — Phase 1 ships the upload + premium framing
// (this component). Phase 2 will pipe uploads through remove.bg / a
// Replicate model when the operator opts in, replacing the source URL
// with the cutout. The UI surface (the upload affordance + this banner)
// stays identical — only the stored image changes.
// ---------------------------------------------------------------------------

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Upload,
  X as XIcon,
  Loader2,
  Move,
  Check,
  RotateCcw,
} from "lucide-react";

type Stat = {
  label: string;
  value: string;
  delta?: string;
  tone?: "positive" | "negative" | "neutral";
  // Optional click target — when set, the whole tile becomes a Link to
  // the surface that actually backs this metric. Norman feedback (May
  // 22): clicking "173 Captured" on the dashboard took the operator to
  // /portal/leads which only shows 4 Lead rows. Each tile now navigates
  // to the page that holds the underlying data.
  href?: string;
  // Optional second-line copy under the value. Used to spell out the
  // breakdown for aggregate metrics ("3 form + 147 identified + 23
  // chatbot") so the headline isn't an opaque sum.
  hint?: string;
};

type Props = {
  propertyId: string;
  propertyName: string;
  /** "Berkeley · Student housing", "Brooklyn · Multifamily", etc. */
  subtitle?: string | null;
  heroImageUrl: string | null;
  /** Up to 4 stats. The dashboard renders 3; the detail page renders 4. */
  stats: Stat[];
  /** Optional accent (uses brand primary when omitted). */
  accent?: string | null;
  /** When true, render the upload affordance (operator surface). False on
   *  read-only views (admin impersonation in read-mode, etc). */
  editable?: boolean;
  /** Compact mode for the main dashboard featured strip. */
  compact?: boolean;
  /** Operator-curated drag/zoom transform. Defaults to natural fit when
   *  the operator hasn't repositioned yet. */
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
};

export function PropertyHeroBanner({
  propertyId,
  propertyName,
  subtitle,
  heroImageUrl,
  stats,
  accent,
  editable = true,
  compact = false,
  imageOffsetX = 0,
  imageOffsetY = 0,
  imageScale = 1,
}: Props) {
  const [currentImage, setCurrentImage] = React.useState(heroImageUrl);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  // Reposition mode — Notion-style drag + scroll-zoom. The current
  // transform is a draft until the operator clicks Save, then it
  // POSTs to /hero-image-transform and the parent re-renders with
  // the persisted values on next page load.
  const [repositioning, setRepositioning] = React.useState(false);
  const [savedX, setSavedX] = React.useState(imageOffsetX);
  const [savedY, setSavedY] = React.useState(imageOffsetY);
  const [savedScale, setSavedScale] = React.useState(imageScale);
  const [draftX, setDraftX] = React.useState(imageOffsetX);
  const [draftY, setDraftY] = React.useState(imageOffsetY);
  const [draftScale, setDraftScale] = React.useState(imageScale);
  const [saving, setSaving] = React.useState(false);

  const offsetX = repositioning ? draftX : savedX;
  const offsetY = repositioning ? draftY : savedY;
  const scaleVal = repositioning ? draftScale : savedScale;

  const dragRef = React.useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    containerW: number;
    containerH: number;
  } | null>(null);

  const accentRgb = hexToRgb(accent ?? "#2563EB");

  async function handleFile(file: File) {
    setError(null);
    if (file.size > 6 * 1024 * 1024) {
      setError("Image too large — max 6MB.");
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Use JPEG, PNG, or WebP.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/portal/properties/${propertyId}/hero-image`,
        { method: "POST", body: fd },
      );
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      setCurrentImage(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!currentImage) return;
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(
        `/api/portal/properties/${propertyId}/hero-image`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `Remove failed (${res.status})`);
      }
      setCurrentImage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!editable || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Notion-style drag-to-reposition + scroll-zoom.
  // Click "Reposition" to enter draft mode; mouse drag pans (translateX/Y
  // in % of container); wheel/pinch zooms (scale 0.5..3.0). Save POSTs to
  // /hero-image-transform, Cancel reverts to the persisted values, Reset
  // jumps back to 0/0/1.
  // ───────────────────────────────────────────────────────────────────────

  function startReposition() {
    setDraftX(savedX);
    setDraftY(savedY);
    setDraftScale(savedScale);
    setRepositioning(true);
  }

  function cancelReposition() {
    setRepositioning(false);
  }

  function resetReposition() {
    setDraftX(0);
    setDraftY(0);
    setDraftScale(1);
  }

  async function saveReposition() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/portal/properties/${propertyId}/hero-image-transform`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offsetX: draftX,
            offsetY: draftY,
            scale: draftScale,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        offsetX?: number;
        offsetY?: number;
        scale?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setSavedX(data.offsetX ?? draftX);
      setSavedY(data.offsetY ?? draftY);
      setSavedScale(data.scale ?? draftScale);
      setRepositioning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onImagePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!repositioning) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: draftX,
      startOffsetY: draftY,
      containerW: rect.width || 1,
      containerH: rect.height || 1,
    };
    target.setPointerCapture(e.pointerId);
  }

  function onImagePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!repositioning || !dragRef.current) return;
    const { startX, startY, startOffsetX, startOffsetY, containerW, containerH } =
      dragRef.current;
    const dx = ((e.clientX - startX) / containerW) * 100;
    const dy = ((e.clientY - startY) / containerH) * 100;
    setDraftX(Math.max(-100, Math.min(100, startOffsetX + dx)));
    setDraftY(Math.max(-100, Math.min(100, startOffsetY + dy)));
  }

  function onImagePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  function onImageWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!repositioning) return;
    // Prevent the page from scrolling while the operator zooms.
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.06 : 0.94;
    setDraftScale((s) => Math.max(0.5, Math.min(3, s * factor)));
  }

  const padding = compact ? "p-4 sm:p-5" : "p-5 sm:p-7";
  // Norman bug (May 22): on mobile (~390px viewport) compact mode was
  // locked to "180px image + remainder" which left only ~150px for
  // the 3-stat column — the stats overlapped each other ("15042/4104"
  // mashed together). Fix: stack to a single column under sm so the
  // image takes the full width and the stats lay out cleanly below.
  // Multi-column kicks in at sm: (640px) where there's enough room.
  const gridCols = compact
    ? "grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)]"
    : "grid-cols-1 sm:grid-cols-[300px_minmax(0,1fr)] md:grid-cols-[340px_minmax(0,1fr)]";
  // Norman 2026-05-21 fifth pass: the rounded-xl + perspective tilt
  // were treating the BG-removed PNG as if it were a card. Dropped
  // both. The building silhouette IS the shape now. Bigger size +
  // generous negative margins so it visibly breaks out of all four
  // sides of its column.
  const imageSize = compact ? "h-[200px]" : "h-[320px] sm:h-[380px]";
  const imageLift = compact ? "-mt-10 -mx-2" : "-mt-16 sm:-mt-20 -mx-3 sm:-mx-5";

  return (
    <section
      aria-label={`${propertyName} hero`}
      onDragOver={editable ? (e) => e.preventDefault() : undefined}
      onDrop={editable ? onDrop : undefined}
      className={`relative rounded-2xl border border-border ${padding}`}
      style={{
        // Layered brand-blue radial wash + soft grid texture, blended over
        // pure white so the building image reads as the focal point.
        background: `
          radial-gradient(ellipse 80% 90% at 18% 10%, rgba(${accentRgb}, 0.18), transparent 65%),
          radial-gradient(ellipse 70% 80% at 95% 100%, rgba(${accentRgb}, 0.10), transparent 65%),
          linear-gradient(180deg, #F7F9FF 0%, #FFFFFF 80%)
        `,
      }}
    >
      {/* Norman 2026-05-21: section no longer uses overflow-hidden so a
          BG-removed building image can spill out the top of the card
          and read as 3D pop instead of getting cropped at the section
          bounds. The grid texture below keeps its own clip via the
          rounded-2xl + overflow-hidden wrapper so it doesn't bleed out
          of the card edges. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(0deg, rgba(${accentRgb}, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(${accentRgb}, 0.05) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          WebkitMaskImage:
            "radial-gradient(ellipse 110% 95% at 30% 50%, #000 70%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 110% 95% at 30% 50%, #000 70%, transparent 100%)",
        }}
      />

      {/* Norman 2026-05-21 fifth pass: dropped the perspective tilt and
          the rounded-xl on the image. The whole point of a BG-removed
          PNG is that the building silhouette IS the shape — wrapping
          it in a tilted card with rounded corners undoes that. The
          image now sits flat on the card surface (no tilt), no
          rounded corners (silhouette is the outline), spilling beyond
          all four edges of its grid column via large negative
          margins, with a single strong drop-shadow stack for the
          floating feel and a soft ground shadow to anchor it. */}
      <div className={`relative grid items-end gap-5 ${gridCols}`}>
        <div className="relative group" style={{ overflow: "visible" }}>
          {currentImage ? (
            <div
              className={`relative ${imageLift}`}
              style={{
                overflow: "visible",
                // Faint dashed outline appears only in reposition mode so
                // the operator can see the editable canvas bounds.
                outline: repositioning
                  ? "1px dashed rgba(37,99,235,0.45)"
                  : "none",
                outlineOffset: 4,
                borderRadius: 12,
              }}
            >
              {/* Ground shadow — soft radial smudge beneath the building. */}
              <div
                aria-hidden="true"
                className="absolute left-1/2 bottom-[-18px] w-[90%] h-8"
                style={{
                  transform: "translateX(-50%)",
                  background:
                    "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(15, 23, 42, 0.40), transparent 72%)",
                  filter: "blur(14px)",
                }}
              />
              {/* Image wrapper — handles pointer drag + wheel zoom in
                  reposition mode. The transform is applied here so the
                  drop-shadow filter on the <img> animates with it
                  (drop-shadow respects the transform via the GPU). */}
              <div
                className={`relative w-full ${imageSize}`}
                onPointerDown={onImagePointerDown}
                onPointerMove={onImagePointerMove}
                onPointerUp={onImagePointerUp}
                onPointerCancel={onImagePointerUp}
                onWheel={onImageWheel}
                style={{
                  cursor: repositioning
                    ? dragRef.current
                      ? "grabbing"
                      : "grab"
                    : "default",
                  touchAction: repositioning ? "none" : "auto",
                  transform: `translate(${offsetX}%, ${offsetY}%) scale(${scaleVal})`,
                  transformOrigin: "center center",
                  transition: repositioning
                    ? "none"
                    : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                  willChange: "transform",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImage}
                  alt={`${propertyName} exterior`}
                  className="relative w-full h-full object-contain"
                  draggable={false}
                  style={{
                    filter:
                      "drop-shadow(0 30px 40px rgba(15, 23, 42, 0.28)) drop-shadow(0 10px 18px rgba(15, 23, 42, 0.18)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.10))",
                    pointerEvents: "none",
                  }}
                  loading="lazy"
                />
              </div>

              {editable && !repositioning ? (
                /* Idle controls — fade in on hover. */
                <div
                  className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150"
                  style={uploading ? { opacity: 1 } : undefined}
                >
                  <button
                    type="button"
                    onClick={startReposition}
                    disabled={uploading}
                    aria-label="Reposition image"
                    className="inline-flex items-center gap-1 rounded-md bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-semibold text-foreground border border-border shadow-sm hover:bg-white transition-colors disabled:opacity-50"
                  >
                    <Move className="h-3 w-3" />
                    Reposition
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1 rounded-md bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-semibold text-foreground border border-border shadow-sm hover:bg-white transition-colors disabled:opacity-50"
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
                    onClick={handleRemove}
                    disabled={uploading}
                    aria-label="Remove image"
                    className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-white/90 backdrop-blur text-muted-foreground hover:text-destructive border border-border shadow-sm hover:bg-white transition-colors disabled:opacity-50"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ) : null}

              {editable && repositioning ? (
                /* Reposition controls — pinned bottom-center so they
                   stay out of the way of the building image. */
                <div className="absolute left-1/2 -translate-x-1/2 bottom-[-44px] flex items-center gap-1.5 z-10">
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-mono font-semibold text-primary border border-primary/20">
                    Drag to move · scroll to zoom · {Math.round(scaleVal * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={resetReposition}
                    aria-label="Reset position"
                    className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-muted-foreground border border-border shadow-sm hover:bg-muted transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={cancelReposition}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-foreground border border-border shadow-sm hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveReposition}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Save
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={editable ? () => fileRef.current?.click() : undefined}
              disabled={!editable || uploading}
              className={`group relative w-full ${imageSize} rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${
                editable
                  ? "border-border bg-white/60 hover:border-primary/50 hover:bg-white/90 cursor-pointer"
                  : "border-border bg-white/60 cursor-default"
              }`}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <>
                  <span
                    className="inline-flex items-center justify-center h-10 w-10 rounded-full text-primary"
                    style={{ backgroundColor: `rgba(${accentRgb}, 0.12)` }}
                  >
                    <Building2 className="h-5 w-5" />
                  </span>
                  {editable ? (
                    <>
                      <span className="text-[11px] font-semibold text-foreground">
                        Upload building photo
                      </span>
                      <span className="text-[10px] text-muted-foreground px-3 text-center leading-tight">
                        Drag &amp; drop or click. JPEG/PNG/WebP, max 6MB.
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      No image yet
                    </span>
                  )}
                </>
              )}
            </button>
          )}

          {editable ? (
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                // Reset so re-selecting the same file still fires onChange.
                e.target.value = "";
              }}
            />
          ) : null}
        </div>

        {/* Copy + stats column */}
        <div className="min-w-0">
          <p
            className="text-[10px] font-mono font-semibold tracking-[0.16em] uppercase mb-1.5"
            style={{ color: accent ?? "#2563EB" }}
          >
            Featured property
          </p>
          <h1
            className={`font-display tracking-tight text-foreground leading-tight ${
              compact ? "text-xl" : "text-2xl sm:text-3xl"
            }`}
            style={{ letterSpacing: "-0.02em" }}
          >
            {propertyName}
          </h1>
          {subtitle ? (
            <p className="text-[12px] text-muted-foreground mt-1">{subtitle}</p>
          ) : null}

          {stats.length > 0 ? (
            <div
              className={`mt-4 pt-4 grid gap-2 sm:gap-3 border-t border-border/70 ${
                compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
              }`}
            >
              {stats.slice(0, compact ? 3 : 4).map((s, i) => {
                const tileInner = (
                  <>
                    <p
                      className={`font-display font-semibold tabular-nums text-foreground leading-none break-words ${
                        compact
                          ? // Norman May 22 mobile bug — at 390px viewport a
                            // 3-stat compact grid only has ~95px per column;
                            // a "42/114" at 30px overflowed. Scale starts at
                            // text-xl on mobile so the values always fit
                            // inside their column without overlap.
                            "text-xl sm:text-3xl md:text-4xl"
                          : "text-3xl sm:text-4xl md:text-5xl"
                      }`}
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {s.value}
                    </p>
                    <p className="text-[10.5px] font-mono font-medium uppercase tracking-[0.1em] text-muted-foreground mt-1.5 leading-tight">
                      {s.label}
                    </p>
                    {s.hint ? (
                      <p className="text-[10.5px] text-muted-foreground/90 mt-0.5 leading-tight">
                        {s.hint}
                      </p>
                    ) : null}
                    {s.delta ? (
                      <p
                        className={`text-[10px] font-medium mt-0.5 ${
                          s.tone === "positive"
                            ? "text-emerald-700"
                            : s.tone === "negative"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {s.delta}
                      </p>
                    ) : null}
                  </>
                );
                const layoutCls =
                  i > 0 && !compact
                    ? "sm:pl-3 sm:border-l border-border/70"
                    : "";
                // When the stat carries an href, render the whole tile
                // as a Link so clicking the number navigates straight
                // to the data behind it (Norman feedback May 22 —
                // operators were clicking around trying to find where
                // the headline numbers came from).
                if (s.href) {
                  return (
                    <Link
                      key={s.label}
                      href={s.href}
                      className={`${layoutCls} block -m-1 p-1 rounded hover:bg-foreground/[0.03] transition-colors`}
                    >
                      {tileInner}
                    </Link>
                  );
                }
                return (
                  <div key={s.label} className={layoutCls}>
                    {tileInner}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="relative mt-3 text-[11px] text-destructive">{error}</p>
      ) : null}
    </section>
  );
}

function hexToRgb(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 3 && cleaned.length !== 6) return "37, 99, 235";
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "37, 99, 235";
  return `${r}, ${g}, ${b}`;
}
