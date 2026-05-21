"use client";

// ---------------------------------------------------------------------------
// Shared constants + helpers for the per-chart files split out of
// seo-phase2-charts.tsx. Keeps the color system consistent across the
// dashboard while letting each heavy chart land in its own bundle chunk.
// ---------------------------------------------------------------------------

export const BRAND = "#2563EB";
export const BRAND_LIGHT = "#93C5FD";
export const BRAND_LIGHTER = "#DBEAFE";
export const INK = "#1E2A3A";
export const MUTED = "#94A3B8";
export const SUCCESS = "#059669";
export const DANGER = "#DC2626";
export const BORDER = "#E2E8F0";

export function SectionHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <header className="mb-3">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
        {eyebrow}
      </p>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint ? (
        <p className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</p>
      ) : null}
    </header>
  );
}
