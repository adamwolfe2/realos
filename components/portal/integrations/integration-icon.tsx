import * as React from "react";
import { cn } from "@/lib/utils";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";
import { BRAND_LOGOS } from "./brand-logos";

// Renders the integration logo inside a consistent tile frame. Two visual
// modes: (1) filledTile — brand-colored background with white mark, used for
// niche vendors without a licensed logo file, and (2) neutral — white/card
// background with the mark in its brand color, used for the majority where
// we have an authentic logo.
export function IntegrationIcon({
  def,
  size = "md",
  className,
}: {
  def: IntegrationDefinition;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const logo = BRAND_LOGOS[def.slug];
  const sizeBox =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  // Raster PMS wordmark logos (Buildium / RealPage / Entrata / Yardi Breeze)
  // get a near-flush tile so the wide marks stay legible; SVG / icon marks
  // keep their comfortable inset so they don't bleed to the tile edge.
  const pad = logo?.image
    ? size === "lg"
      ? "p-1.5"
      : "p-1"
    : size === "sm"
      ? "p-1.5"
      : size === "lg"
        ? "p-2.5"
        : "p-2";
  const dim = `${sizeBox} ${pad}`;
  if (!logo) {
    // Safety fallback — shouldn't hit in production because every catalog
    // entry has a matching BRAND_LOGOS entry. If it does, show initials on
    // brand color rather than nothing.
    return (
      <div
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-semibold text-white shrink-0 shadow-sm text-[11px]",
          dim,
          className,
        )}
        style={{ backgroundColor: def.brandColor }}
      >
        {def.initials}
      </div>
    );
  }

  if (logo.filledTile) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center rounded-lg shrink-0 shadow-sm text-white",
          dim,
          className,
        )}
        style={{ backgroundColor: logo.brandColor }}
      >
        {logo.render()}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-lg shrink-0 bg-card border border-border",
        dim,
        className,
      )}
      style={{ color: logo.brandColor }}
    >
      {logo.render()}
    </div>
  );
}
