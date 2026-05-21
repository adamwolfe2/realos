import React from "react";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Sparkles,
  Megaphone,
  Building2,
  BarChart3,
  Settings as SettingsIcon,
  Star,
  Eye,
  TrendingUp,
  Search as SearchIcon,
  Plus,
  ArrowRight,
  Bell,
  Check,
  X as XIcon,
  ChevronDown,
  Circle as CircleIcon,
  Download,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Shared primitives for the interactive product tour. All components are
// colour-locked to the Claude-inspired palette. Use these instead of
// inline-styling repeatedly across views.
// ---------------------------------------------------------------------------

// All chart / category / accent surfaces are locked to a monochromatic blue
// scale so the demo reads as a single coherent product surface (no random
// orange / green / amber category swatches anywhere). Status polarity for
// delta indicators (KPI up / down) stays on the real product's emerald /
// rose pair so positive / negative still scans at a glance — same colors
// as `.ls-delta-up` / `.ls-delta-down` in globals.css.
export const TOKENS = {
  parchment:       "#FFFFFF",
  ivory:           "#F1F5F9",
  sand:            "#E2E8F0",
  white:           "#ffffff",
  nearBlack:       "#1E2A3A",
  darkSurface:     "#1E2A3A",
  // Brand accent + step-down scale for category / chart slices.
  accent:          "#2563EB", // primary  — Tailwind blue-600
  accentHover:     "#1D4ED8", //          — blue-700
  accentLight:     "#60A5FA", //          — blue-400
  // Legacy aliases — kept so existing inline references keep working but
  // now all resolve to monochromatic blue ramp stops.
  terracotta:      "#2563EB",
  terracottaHover: "#1D4ED8",
  coral:           "#93C5FD", //          — blue-300
  charcoal:        "#1E2A3A",
  olive:           "#64748B",
  stone:           "#94A3B8",
  warmSilver:      "#94A3B8",
  borderCream:     "#E2E8F0",
  borderWarm:      "#E2E8F0",
  ring:            "#CBD5E1",
  // Delta polarity (KPI tiles only). Matches the real product's
  // .ls-delta-up / .ls-delta-down classes in app/globals.css.
  success:         "#15803D",
  warning:         "#1D4ED8", // ← was amber #F59E0B; remapped to deep blue
  error:           "#B91C1C",
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
    terracotta: { bg: "rgba(37,99,235,0.12)",           fg: TOKENS.terracotta,border: "rgba(37,99,235,0.3)" },
    success:    { bg: "rgba(22, 163, 74,0.12)",            fg: TOKENS.success,   border: "rgba(22, 163, 74,0.3)" },
    warning:    { bg: "rgba(245, 158, 11,0.12)",           fg: TOKENS.warning,   border: "rgba(245, 158, 11,0.3)" },
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
// Icons — re-exports of lucide-react icons under stable demo keys.
//
// Previously this was a hand-authored set of inline SVGs. The real
// LeaseStack product uses lucide-react throughout (sidebar nav, KPI tiles,
// activity feed, every page) so the demo now sources from the exact same
// library. Each entry below is a thin wrapper that preserves the old
// `{ size, color, className }` call signature so every call site in
// product-tour/index.tsx keeps working without changes.
// ---------------------------------------------------------------------------

type IconProps = { size?: number; color?: string; className?: string };

const wrap = (LucideIcon: React.ComponentType<{
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}>) =>
  function WrappedIcon({ size = 16, color = "currentColor", className }: IconProps) {
    return (
      <LucideIcon
        size={size}
        color={color}
        className={className}
        // 1.6 stroke matches the visual weight of the previous inline SVGs.
        strokeWidth={1.6}
      />
    );
  };

export const Icons = {
  dashboard:   wrap(LayoutDashboard),
  leads:       wrap(Users),
  chat:        wrap(MessageSquare),
  creative:    wrap(Sparkles),
  campaigns:   wrap(Megaphone),
  properties:  wrap(Building2),
  reports:     wrap(BarChart3),
  settings:    wrap(SettingsIcon),
  briefing:    wrap(Star),
  visitors:    wrap(Eye),
  seo:         wrap(TrendingUp),
  search:      wrap(SearchIcon),
  plus:        wrap(Plus),
  arrowRight:  wrap(ArrowRight),
  bell:        wrap(Bell),
  check:       wrap(Check),
  close:       wrap(XIcon),
  chevronDown: wrap(ChevronDown),
  // Solid dot — lucide's Circle has a hole; fill it inline so callers that
  // pass `color` get a filled dot the same as the previous hand-rolled SVG.
  dot: ({ size = 6, color = "currentColor", className }: IconProps) => (
    <CircleIcon
      size={size}
      color={color}
      className={className}
      strokeWidth={0}
      fill={color}
    />
  ),
  download: wrap(Download),
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
