"use client";

import * as React from "react";
import {
  Bot,
  Eye,
  TrendingUp,
  Star,
  BarChart3,
  MessageSquare,
  Brush,
  Mail,
  Send,
  Share2,
  Sparkles,
  LineChart,
  GitBranch,
  Check,
  Globe,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { FeatureDef } from "@/lib/billing/features";

// ---------------------------------------------------------------------------
// Onboarding — à-la-carte feature cart (slice S2). The operator builds a
// custom package by toggling features. Each feature maps to a workspace
// module flag; the selection is posted to /api/onboarding/wizard/start-trial,
// which flips exactly those modules on and starts the 14-day trial.
// ---------------------------------------------------------------------------

const ICONS: Record<string, LucideIcon> = {
  Bot,
  Eye,
  TrendingUp,
  Star,
  BarChart3,
  MessageSquare,
  Brush,
  Mail,
  Send,
  Share2,
  Sparkles,
  LineChart,
  GitBranch,
};

const INK = "#1E2A3A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const ACCENT = "#2563EB";

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function FeaturesStep({
  features,
  basePlatformCents,
  initialSelected,
  onSubmit,
  disabled,
}: {
  // Effective catalog (admin-priced) passed from the server so the cart shows
  // the live, admin-editable prices, not hardcoded ones.
  features: FeatureDef[];
  basePlatformCents: number;
  // The operator's SAVED selection when they've already submitted this step
  // (e.g. navigated back). Seeds the cart from their real choices instead of
  // resetting to recommended. undefined = first visit → recommended starter.
  // (Codex onboarding review.)
  initialSelected?: string[];
  onSubmit: (body: { selectedModules: string[] }) => void;
  disabled?: boolean;
}) {
  // First visit → recommended starter package the operator can trim. Returning
  // with a saved selection → restore exactly what they had (even if empty).
  const [selected, setSelected] = React.useState<Set<string>>(() =>
    initialSelected !== undefined
      ? new Set(initialSelected)
      : new Set(
          features.filter((f) => f.recommended).map((f) => f.key as string),
        ),
  );

  const toggle = React.useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectedArr = React.useMemo(() => Array.from(selected), [selected]);
  const perPropertyCents =
    basePlatformCents +
    features
      .filter((f) => selected.has(f.key))
      .reduce((acc, f) => acc + f.monthlyCents, 0);

  return (
    <div className="space-y-6">
      <header>
        <p
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Build your package
        </p>
        <h1
          className="mt-2 leading-tight"
          style={{
            color: INK,
            fontFamily: "var(--font-serif)",
            fontSize: "26px",
            fontWeight: 500,
            letterSpacing: "-0.018em",
          }}
        >
          Pick the features you want.
        </h1>
        <p
          className="mt-2"
          style={{
            color: MUTED,
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            lineHeight: 1.55,
          }}
        >
          Add what you need to your cart — set it up per property next. Everything
          is free for 14 days; no card required.
        </p>
      </header>

      {/* Always-on base */}
      <div
        className="rounded-lg flex items-center gap-3"
        style={{ padding: "12px 14px", border: `1px solid ${BORDER}`, backgroundColor: "#F8FAFC" }}
      >
        <Check className="w-4 h-4 shrink-0" strokeWidth={2} style={{ color: ACCENT }} aria-hidden />
        <div className="flex-1 min-w-0">
          <span style={{ color: INK, fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600 }}>
            LeaseStack platform
          </span>
          {/* Inline feature list hidden on phones so the row fits 370px —
              just the name + price show on mobile. */}
          <span className="ml-2 hidden sm:inline-flex items-center gap-2 align-middle" style={{ color: MUTED, fontSize: "11.5px" }}>
            <Globe className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden /> Marketing site
            <Users className="w-3.5 h-3.5 ml-1" strokeWidth={1.5} aria-hidden /> Lead capture + inbox
          </span>
        </div>
        <span className="shrink-0" style={{ color: MUTED, fontFamily: "var(--font-mono)", fontSize: "11px" }}>
          {dollars(basePlatformCents)}/mo · included
        </span>
      </div>

      {/* Feature grid — add-to-cart cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {features.map((f) => {
          const Icon = ICONS[f.icon] ?? Sparkles;
          const isOn = selected.has(f.key);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => !disabled && toggle(f.key)}
              disabled={disabled}
              aria-pressed={isOn}
              className="text-left rounded-lg transition-colors relative"
              style={{
                padding: "12px 14px",
                border: `1.5px solid ${isOn ? ACCENT : BORDER}`,
                backgroundColor: isOn ? "rgba(37,99,235,0.04)" : "#FFFFFF",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <span className="flex items-start gap-2.5">
                <span
                  className="shrink-0 mt-0.5 grid place-items-center rounded-md"
                  style={{
                    width: 28,
                    height: 28,
                    border: `1px solid ${isOn ? ACCENT : BORDER}`,
                    backgroundColor: isOn ? ACCENT : "#FFFFFF",
                  }}
                >
                  {isOn ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} style={{ color: "#FFFFFF" }} aria-hidden />
                  ) : (
                    <Icon className="w-4 h-4" strokeWidth={1.5} style={{ color: MUTED }} aria-hidden />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span style={{ color: INK, fontFamily: "var(--font-sans)", fontSize: "13.5px", fontWeight: 600, letterSpacing: "-0.005em" }}>
                      {f.name}
                    </span>
                    <span style={{ color: isOn ? ACCENT : MUTED, fontFamily: "var(--font-mono)", fontSize: "11px", whiteSpace: "nowrap" }}>
                      {dollars(f.monthlyCents)}/mo
                    </span>
                  </span>
                  <span className="mt-0.5 block" style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: "12px", lineHeight: 1.4 }}>
                    {f.copy}
                  </span>
                  {f.recommended ? (
                    <span className="mt-1 inline-block" style={{ color: ACCENT, fontFamily: "var(--font-mono)", fontSize: "9.5px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                      Recommended
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Running total + CTA */}
      <div
        className="sticky bottom-0 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ padding: "14px 16px", border: `1px solid ${BORDER}`, backgroundColor: "#FFFFFF" }}
      >
        <div>
          <div style={{ color: INK, fontFamily: "var(--font-sans)", fontSize: "17px", fontWeight: 700 }}>
            {dollars(perPropertyCents)}
            <span style={{ color: MUTED, fontSize: "12px", fontWeight: 500 }}> /property /mo</span>
          </div>
          <div style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: "11.5px" }}>
            {selected.size} feature{selected.size === 1 ? "" : "s"} · free for 14 days, then billed
          </div>
        </div>
        <button
          type="button"
          onClick={() => !disabled && onSubmit({ selectedModules: selectedArr })}
          disabled={disabled}
          className="rounded-lg transition-colors w-full sm:w-auto shrink-0"
          style={{
            padding: "12px 20px",
            backgroundColor: ACCENT,
            color: "#FFFFFF",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 600,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          Continue to properties
        </button>
      </div>
    </div>
  );
}
