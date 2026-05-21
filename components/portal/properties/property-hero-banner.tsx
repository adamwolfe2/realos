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
import { Building2, Upload, X as XIcon, Loader2 } from "lucide-react";

type Stat = {
  label: string;
  value: string;
  delta?: string;
  tone?: "positive" | "negative" | "neutral";
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
}: Props) {
  const [currentImage, setCurrentImage] = React.useState(heroImageUrl);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

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

  const padding = compact ? "p-4 sm:p-5" : "p-5 sm:p-7";
  const gridCols = compact
    ? "grid-cols-[160px_minmax(0,1fr)]"
    : "grid-cols-1 sm:grid-cols-[260px_minmax(0,1fr)] md:grid-cols-[300px_minmax(0,1fr)]";
  // Norman 2026-05-21 third pass: image was "stuck" because the fixed
  // height + items-center kept it pinned inside the card. Bumped sizes
  // and the image now uses a negative top margin to LIFT above the card
  // edge for the 3D pop effect. A BG-removed PNG will visibly float
  // over the brand-gradient top edge; a regular rectangular photo will
  // still anchor to the card but read as larger and more prominent.
  const imageSize = compact ? "h-[160px]" : "h-[260px] sm:h-[320px]";
  const imageLift = compact ? "-mt-6" : "-mt-10 sm:-mt-14";

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

      {/* Grid uses items-end so the image bottom anchors to the
          identity column's baseline, while the negative top margin
          on the image pulls its top edge ABOVE the card. Net: the
          building reads as floating in front of the card rather
          than sitting inside it. */}
      <div className={`relative grid items-end gap-5 ${gridCols}`}>
        {/* Image column — building floats above a soft ground shadow.
            Norman 2026-05-21 fourth pass: "it's not 3D". A flat
            rectangular photo on a flat card never will be without
            BG-removal OR a real perspective transform. We don't
            control the source image so we use a CSS perspective
            wrapper + tilt transform + parallax shadow stack. The
            photo now sits on an angled plane that rotates back
            ~8deg on X and ~5deg on Y; on group-hover it eases back
            to ~3deg on X and 0 on Y so the building "rises toward
            you" as the cursor approaches. This gives real
            three-dimensional volume with zero dependencies. */}
        <div
          className="relative group"
          style={{
            overflow: "visible",
            perspective: "1200px",
            perspectiveOrigin: "50% 30%",
          }}
        >
          {currentImage ? (
            <div
              className={`relative ${imageLift}`}
              style={{
                overflow: "visible",
                transformStyle: "preserve-3d",
                transform:
                  "rotateX(8deg) rotateY(-5deg) rotateZ(-0.5deg) translateZ(0)",
                transformOrigin: "50% 100%",
                transition:
                  "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform =
                  "rotateX(3deg) rotateY(0deg) rotateZ(0deg) translateZ(20px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform =
                  "rotateX(8deg) rotateY(-5deg) rotateZ(-0.5deg) translateZ(0)";
              }}
            >
              {/* Cast shadow — angled to match the tilt direction so it
                  reads as a real cast shadow on the card surface below
                  rather than a generic blur. Sits below the image,
                  skewed to imply the light comes from the upper left. */}
              <div
                aria-hidden="true"
                className="absolute left-1/2 bottom-[-22px] w-[88%] h-9"
                style={{
                  transform: "translateX(-46%) skewX(-12deg)",
                  background:
                    "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(15, 23, 42, 0.45), transparent 72%)",
                  filter: "blur(14px)",
                  transformStyle: "preserve-3d",
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage}
                alt={`${propertyName} exterior`}
                /* object-contain (was object-cover) so a BG-removed PNG
                   doesn't get cropped at the column bounds. The image
                   now lives on the tilted plane defined by its parent
                   so the photo itself has visible depth. */
                className={`relative w-full ${imageSize} object-contain rounded-xl`}
                style={{
                  /* Stacked drop-shadows give the floating-3D feel:
                     wide soft ambient + closer contact + crisp base. */
                  filter:
                    "drop-shadow(0 30px 40px rgba(15, 23, 42, 0.28)) drop-shadow(0 10px 18px rgba(15, 23, 42, 0.18)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.10))",
                  backfaceVisibility: "hidden",
                }}
                loading="lazy"
              />
              {/* Subtle edge highlight — a faint linear sheen on the
                  top-left edge so the photo reads as a tilted card
                  catching light from above. Sits over the image but
                  doesn't capture pointer events. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, transparent 35%, transparent 65%, rgba(15, 23, 42, 0.08) 100%)",
                  mixBlendMode: "overlay",
                }}
              />
              {editable ? (
                /* Replace / Remove controls — hidden by default, fade
                   in on group hover or while uploading so they never
                   sit on top of the building image when the operator
                   isn't trying to edit. */
                <div
                  className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150"
                  style={uploading ? { opacity: 1 } : undefined}
                >
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
              className={`mt-4 pt-4 grid gap-3 border-t border-border/70 ${
                compact
                  ? "grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              {stats.slice(0, compact ? 3 : 4).map((s, i) => (
                <div
                  key={s.label}
                  className={
                    i > 0 && !compact ? "sm:pl-3 sm:border-l border-border/70" : ""
                  }
                >
                  <p
                    className={`font-display font-medium tabular-nums text-foreground leading-tight ${
                      compact ? "text-base" : "text-lg sm:text-xl"
                    }`}
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {s.value}
                  </p>
                  <p className="text-[9.5px] font-mono font-medium uppercase tracking-[0.08em] text-muted-foreground mt-0.5 leading-tight">
                    {s.label}
                  </p>
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
                </div>
              ))}
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
