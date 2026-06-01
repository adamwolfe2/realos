"use client";

import type { ReactNode } from "react";

// FilterChip — single source-filter pill used in the mentions chip row.
// Visual contract: brand glyph (SVG when source is known, color dot
// otherwise) + label + tabular count, fills with source color on active.
// Pure presentational; all selection state lives in the parent
// <MentionsSection>.

interface FilterChipProps {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
  /** Optional brand glyph (real SVG logo). When omitted we fall back to
   *  a tiny color dot — keeps the "All" pill clean while every per-source
   *  pill renders a recognizable brand mark. */
  glyph?: ReactNode;
}

export function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
  glyph,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? color : "#FFFFFF",
        color: active ? "#FFFFFF" : "#1E2A3A",
        border: `1px solid ${active ? color : "#E5E7EB"}`,
      }}
      aria-pressed={active}
    >
      {glyph ? (
        <span
          className="inline-flex items-center justify-center"
          aria-hidden
          // On the active state we tint the glyph white via filter, so a
          // multi-color brand mark (Google's 4-color G, Reddit's orange
          // disc) still reads against the saturated background.
          style={{
            width: 14,
            height: 14,
            filter: active ? "brightness(0) invert(1)" : "none",
          }}
        >
          {glyph}
        </span>
      ) : (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: active ? "#FFFFFF" : color }}
          aria-hidden
        />
      )}
      <span>{label}</span>
      <span
        className="tabular-nums"
        style={{ color: active ? "#FFFFFF" : "#6B7280" }}
      >
        {count}
      </span>
    </button>
  );
}
