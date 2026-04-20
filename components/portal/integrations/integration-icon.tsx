import * as React from "react";
import { cn } from "@/lib/utils";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";

// Consistent brand tile: solid background in the integration's brand color,
// white/near-white initials, rounded square. Looks uniformly professional
// across the whole catalog whether the brand is well-known or niche.
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
    size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold text-white shrink-0 shadow-sm",
        dim,
        className,
      )}
      style={{
        backgroundColor: def.brandColor,
        letterSpacing: "0.02em",
      }}
    >
      {def.initials}
    </div>
  );
}
