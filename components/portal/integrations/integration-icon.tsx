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
  const dim =
    size === "sm"
      ? "h-8 w-8 p-1.5"
      : size === "lg"
        ? "h-12 w-12 p-2.5"
        : "h-10 w-10 p-2";

  const logo = BRAND_LOGOS[def.slug];
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
