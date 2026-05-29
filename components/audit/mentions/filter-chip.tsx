"use client";

// FilterChip — single source-filter pill used in the mentions chip row.
// Visual contract: muted dot + label + tabular count, fills with source
// color on active. Pure presentational; all selection state lives in the
// parent <MentionsSection>.

interface FilterChipProps {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}

export function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
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
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? "#FFFFFF" : color }}
        aria-hidden
      />
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
