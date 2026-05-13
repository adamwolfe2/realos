import * as React from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PropertyAvatar — shared visual for the small avatar that sits to the left
// of every property identity row (dashboard leaderboard, properties list,
// property detail header, anywhere else a property is named).
//
// Hierarchy:
//   1. `src` — explicit image URL. Caller picks the best-available one
//      upstream (heroImageUrl, then first photoUrls entry, etc.).
//   2. Building2 icon in brand-tinted background — the canonical "no
//      image yet" affordance. Replaces the previous letter-monogram
//      fallback that rendered "2", "3", "1", "P" for street-address-named
//      properties (looked like missing data, not a real product surface).
//
// Image error handling: the Building icon sits underneath the <img> so a
// successful load paints over it; a 404 leaves the icon visible. No client
// state needed — keeps this component server-renderable.
//
// `accent` is an optional hex color (org primaryColor) used to tint the
// icon + bg; falls back to brand primary when omitted.
// ---------------------------------------------------------------------------

const SIZE_CLASSES = {
  sm: "h-7 w-7", // 28px — for compact tables / nav
  md: "h-10 w-10", // 40px — default leaderboard size
  lg: "h-12 w-12", // 48px — property detail header
} as const;

const ICON_SIZE_CLASSES = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

type Size = keyof typeof SIZE_CLASSES;

type Props = {
  src?: string | null;
  accent?: string | null;
  size?: Size;
  className?: string;
};

export function PropertyAvatar({
  src,
  accent,
  size = "md",
  className,
}: Props) {
  const sizeClass = SIZE_CLASSES[size];
  const iconClass = ICON_SIZE_CLASSES[size];
  const tintBg = accent
    ? `${accent}14`
    : "hsl(var(--primary) / 0.08)";
  const iconColor = accent ?? "hsl(var(--primary))";

  if (src) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg border border-border",
          sizeClass,
          className,
        )}
        style={{ backgroundColor: tintBg }}
      >
        <Building2
          className={cn("absolute inset-0 m-auto", iconClass)}
          style={{ color: iconColor }}
          aria-hidden="true"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="relative h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 grid place-items-center rounded-lg border border-border",
        sizeClass,
        className,
      )}
      style={{ backgroundColor: tintBg }}
      aria-hidden="true"
    >
      <Building2 className={iconClass} style={{ color: iconColor }} />
    </div>
  );
}
