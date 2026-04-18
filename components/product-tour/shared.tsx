import React from "react";

// ---------------------------------------------------------------------------
// Shared primitives for the interactive product tour. All components are
// colour-locked to the Claude-inspired palette. Use these instead of
// inline-styling repeatedly across views.
// ---------------------------------------------------------------------------

export const TOKENS = {
  parchment:       "#f5f4ed",
  ivory:           "#faf9f5",
  sand:            "#e8e6dc",
  white:           "#ffffff",
  nearBlack:       "#141413",
  darkSurface:     "#30302e",
  terracotta:      "#2F6FE5",
  terracottaHover: "#2558C4",
  coral:           "#5B8CE6",
  charcoal:        "#4d4c48",
  olive:           "#5e5d59",
  stone:           "#87867f",
  warmSilver:      "#b0aea5",
  borderCream:     "#f0eee6",
  borderWarm:      "#e8e6dc",
  ring:            "#d1cfc5",
  success:         "#3a7d44",
  warning:         "#b8860b",
  error:           "#b53333",
  focusBlue:       "#3898ec",
} as const;

// ---------------------------------------------------------------------------
// Pills, badges, small chips
// ---------------------------------------------------------------------------

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "terracotta" | "success" | "warning" | "muted";
  children: React.ReactNode;
}) {
  const colors = {
    neutral:    { bg: TOKENS.sand,                       fg: TOKENS.charcoal,  border: TOKENS.ring },
    terracotta: { bg: "rgba(47,111,229,0.12)",           fg: TOKENS.terracotta,border: "rgba(47,111,229,0.3)" },
    success:    { bg: "rgba(58,125,68,0.12)",            fg: TOKENS.success,   border: "rgba(58,125,68,0.3)" },
    warning:    { bg: "rgba(184,134,11,0.12)",           fg: TOKENS.warning,   border: "rgba(184,134,11,0.3)" },
    muted:      { bg: TOKENS.borderCream,                fg: TOKENS.stone,     border: TOKENS.borderCream },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full"
      style={{
        backgroundColor: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.border}`,
        padding: "2px 10px",
        fontFamily: "var(--font-sans)",
        fontSize: "11px",
        fontWeight: 500,
        lineHeight: 1.3,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85 ? "success" :
    score >= 70 ? "warning" :
    "muted";
  const color =
    tone === "success" ? TOKENS.success :
    tone === "warning" ? TOKENS.warning :
    TOKENS.stone;
  return (
    <span
      className="inline-flex items-center justify-center rounded-md"
      style={{
        minWidth: "28px",
        height: "22px",
        padding: "0 6px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        fontWeight: 600,
        color,
        backgroundColor: `${color}14`,
        border: `1px solid ${color}33`,
      }}
    >
      {score}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Icons (minimal inline SVGs, stroke-based, terracotta/warm palette)
// ---------------------------------------------------------------------------

type IconProps = { size?: number; color?: string; className?: string };

export const Icons = {
  dashboard: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5.5" height="5.5" rx="1.2" stroke={color} strokeWidth="1.4" />
      <rect x="8.5" y="2" width="5.5" height="3" rx="1.2" stroke={color} strokeWidth="1.4" />
      <rect x="8.5" y="6" width="5.5" height="8" rx="1.2" stroke={color} strokeWidth="1.4" />
      <rect x="2" y="8.5" width="5.5" height="5.5" rx="1.2" stroke={color} strokeWidth="1.4" />
    </svg>
  ),
  leads: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" stroke={color} strokeWidth="1.4" />
      <path d="M2.5 13.5c0-2.5 2.3-4 5.5-4s5.5 1.5 5.5 4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  chat: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 4.5c0-1 .8-1.8 1.8-1.8h6.4c1 0 1.8.8 1.8 1.8v5c0 1-.8 1.8-1.8 1.8H7l-3 2.5v-2.5h-.5c-1 0-1.8-.8-1.8-1.8z"
        transform="translate(0.5,0.5)" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  creative: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 11.5L11 3.5l1.5 1.5L4.5 13l-1.5-.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9.5 5L11 6.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  campaigns: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 8l4-4v3h8v2H6v3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  properties: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 13V6l6-3.5L14 6v7" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 13h12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="6.5" y="8" width="3" height="5" stroke={color} strokeWidth="1.4" />
    </svg>
  ),
  reports: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 13V7M7 13V3M11 13V9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  settings: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke={color} strokeWidth="1.4" />
      <path
        d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6L3.4 3.4"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  search: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke={color} strokeWidth="1.4" />
      <path d="M10.5 10.5L14 14" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  plus: ({ size = 14, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  arrowRight: ({ size = 12, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 6h8m0 0L7 3m3 3L7 9" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  bell: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  check: ({ size = 12, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5L5 9.5L10.5 3.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: ({ size = 14, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  chevronDown: ({ size = 12, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M3 5L6 8L9 5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  dot: ({ size = 6, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 6 6" fill={color}>
      <circle cx="3" cy="3" r="3" />
    </svg>
  ),
  download: ({ size = 14, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M7 2v7m0 0L4 6m3 3l3-3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11.5h9" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// A tiny primitive for a warm "tile" surface
// ---------------------------------------------------------------------------

export function Tile({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: TOKENS.white,
        borderRadius: "12px",
        boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 500,
          color: TOKENS.nearBlack,
          lineHeight: 1.2,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h2>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
