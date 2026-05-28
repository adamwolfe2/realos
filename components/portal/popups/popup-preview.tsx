"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Phone,
  X,
} from "lucide-react";
import { PopupTheme } from "@prisma/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PopupPreview — visual render of a PopupCampaign.
//
// One component, three contexts:
//   1. Portal editor: live preview as the operator types
//   2. Public marketing demo at /features/popups (interactive demo)
//   3. Reference for what public/embed/popup.js renders on customer sites
//      (the embed is vanilla JS but mirrors this layout exactly so the
//      operator's preview matches reality)
//
// Backward compatibility: when the phase 1 design fields are NULL the
// component falls through to the v1 treatment so pre-migration rows look
// identical to before.
// ---------------------------------------------------------------------------

export type PopupPreviewIcon =
  | "calendar"
  | "phone"
  | "external"
  | "arrow"
  | "none"
  | null;

export type PopupPreviewProps = {
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl?: string | null;
  offerCode?: string | null;
  secondaryText?: string | null;
  position: "CENTER" | "BOTTOM_RIGHT" | "BOTTOM_LEFT" | "TOP_BANNER";
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  heroImageUrl?: string | null;
  captureEmail?: boolean;
  capturePhone?: boolean;

  // Phase 1 — design parity additions (all nullable)
  eyebrowText?: string | null;
  accentColor?: string | null;
  theme?: PopupTheme | null;
  featuredLabel?: string | null;
  featuredValue?: string | null;
  featuredUnit?: string | null;
  featuredCaption?: string | null;
  secondaryCtaText?: string | null;
  secondaryCtaUrl?: string | null;
  secondaryCtaIcon?: PopupPreviewIcon;
  primaryCtaIcon?: PopupPreviewIcon;
  dismissText?: string | null;
  gradientColors?: string[] | null;

  /**
   * When true, the preview shrinks to fit inside the editor card and
   * positions itself relative to its parent container instead of the
   * viewport. Off by default for the marketing demo + embed reference.
   */
  contained?: boolean;
  onDismiss?: () => void;
  onCtaClick?: () => void;
  onSecondaryCtaClick?: () => void;
  onSubmit?: (data: { email: string; phone?: string }) => void;
};

const ICON_MAP = {
  calendar: Calendar,
  phone: Phone,
  external: ExternalLink,
  arrow: ArrowRight,
  none: null,
} as const;

function IconFor({ icon }: { icon?: PopupPreviewIcon }) {
  if (!icon || icon === "none") return null;
  const Cmp = ICON_MAP[icon];
  if (!Cmp) return null;
  return <Cmp className="h-3.5 w-3.5" />;
}

// Split a headline so a recognized year range (e.g. "2026-2027") renders in
// the accent color. Mirrors the Telegraph reference. Falls back to a single
// span when no year segment is present.
function splitYearAccent(headline: string): { head: string; accent: string | null; tail: string } {
  const m = headline.match(/(\d{4}\s*[–-]\s*\d{4}|\d{4})/);
  if (!m || m.index == null) return { head: headline, accent: null, tail: "" };
  return {
    head: headline.slice(0, m.index),
    accent: m[0],
    tail: headline.slice(m.index + m[0].length),
  };
}

export function PopupPreview(props: PopupPreviewProps) {
  const {
    headline,
    body,
    ctaText,
    offerCode,
    secondaryText,
    position,
    primaryColor,
    textColor,
    backgroundColor,
    heroImageUrl,
    captureEmail = false,
    capturePhone = false,
    eyebrowText,
    accentColor,
    theme = PopupTheme.LIGHT,
    featuredLabel,
    featuredValue,
    featuredUnit,
    featuredCaption,
    secondaryCtaText,
    secondaryCtaIcon,
    primaryCtaIcon,
    dismissText,
    gradientColors,
    contained = false,
    onDismiss,
    onCtaClick,
    onSecondaryCtaClick,
    onSubmit,
  } = props;

  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const isDark = theme === PopupTheme.DARK;
  const isGradient = theme === PopupTheme.GRADIENT;
  const hasFeatured = Boolean(featuredValue || featuredLabel);
  const accent = accentColor || primaryColor;

  // Resolve theme-aware tokens. DARK ignores the operator-picked textColor
  // and uses white-on-dark hierarchy so the popup stays readable even when
  // an operator forgets to update the text color after switching themes.
  const resolvedText = isDark ? "#FFFFFF" : textColor;
  const resolvedMuted = isDark ? "rgba(255,255,255,0.65)" : undefined;
  const resolvedBg = isDark ? backgroundColor || "#0F1729" : backgroundColor;
  const featuredCardBg = isDark
    ? "rgba(255,255,255,0.04)"
    : "rgba(15,23,42,0.04)";
  const featuredCardBorder = isDark
    ? "rgba(255,255,255,0.06)"
    : "rgba(15,23,42,0.06)";

  const showDismissLink = dismissText && position !== "TOP_BANNER";
  const showSecondary = secondaryCtaText && position !== "TOP_BANNER";

  const yearSplit = isDark ? splitYearAccent(headline) : { head: headline, accent: null, tail: "" };

  // Optional gradient accent bar — visible on GRADIENT theme, and on DARK
  // theme when the operator provided stops (Telegraph reference shows
  // a gradient bar above a dark card).
  const showGradientBar =
    (isGradient || isDark) && Array.isArray(gradientColors) && gradientColors.length >= 2;

  const card = (
    <div
      role="dialog"
      aria-modal={position === "CENTER"}
      aria-label={headline}
      className={cn(
        "relative overflow-hidden",
        position === "TOP_BANNER" ? "rounded-none w-full" : "rounded-2xl w-full max-w-[520px]",
      )}
      style={{
        backgroundColor: resolvedBg,
        color: resolvedText,
        boxShadow: isDark
          ? "0 32px 64px -16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)"
          : "0 24px 48px -12px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06)",
      }}
    >
      {/* Top gradient accent bar */}
      {showGradientBar ? (
        <div
          aria-hidden="true"
          className="absolute top-0 inset-x-0 h-[3px] z-10"
          style={{
            background: `linear-gradient(90deg, ${gradientColors!.join(", ")})`,
          }}
        />
      ) : null}

      {/* Decorative corner circles (DARK only) */}
      {isDark && position !== "TOP_BANNER" ? (
        <>
          <span
            aria-hidden="true"
            className="absolute -top-16 -left-16 h-44 w-44 rounded-full pointer-events-none"
            style={{ background: accent, opacity: 0.06 }}
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-20 -right-16 h-52 w-52 rounded-full pointer-events-none"
            style={{ background: accent, opacity: 0.05 }}
          />
        </>
      ) : null}

      {/* Close button */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute top-3 right-3 z-20 inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors"
        style={{
          color: resolvedText,
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
        }}
      >
        <X className="h-4 w-4" />
      </button>

      {heroImageUrl && position !== "TOP_BANNER" ? (
        <div className="relative w-full h-32 overflow-hidden">
          <Image
            src={heroImageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-10",
          position === "TOP_BANNER"
            ? "flex items-center justify-between gap-4 px-5 py-3"
            : isDark
              ? "p-8 sm:p-10 space-y-5"
              : "p-6 space-y-4",
        )}
      >
        {/* Headline + eyebrow */}
        <div className={cn(position === "TOP_BANNER" ? "flex-1 min-w-0" : "space-y-2")}>
          {eyebrowText && position !== "TOP_BANNER" ? (
            <div
              className="text-[11px] font-semibold uppercase"
              style={{
                color: accent,
                letterSpacing: "0.18em",
              }}
            >
              {eyebrowText}
            </div>
          ) : null}
          <h2
            className={cn(
              "font-bold tracking-tight leading-[1.15]",
              position === "TOP_BANNER"
                ? "text-base"
                : isDark
                  ? "text-[28px] sm:text-[34px]"
                  : "text-2xl",
            )}
            style={{ color: resolvedText }}
          >
            {yearSplit.accent ? (
              <>
                <span>{yearSplit.head}</span>
                <span style={{ color: accent }}>{yearSplit.accent}</span>
                <span>{yearSplit.tail}</span>
              </>
            ) : (
              headline || "Your headline goes here"
            )}
          </h2>
          {position !== "TOP_BANNER" ? (
            <p
              className="text-[14px] leading-relaxed"
              style={{
                color: resolvedText,
                opacity: isDark ? 0.78 : 0.78,
              }}
            >
              {body || "Tell visitors why they should claim this offer."}
            </p>
          ) : null}
        </div>

        {/* Featured value card */}
        {hasFeatured && position !== "TOP_BANNER" ? (
          <div
            className="rounded-xl px-5 py-4"
            style={{
              background: featuredCardBg,
              border: `1px solid ${featuredCardBorder}`,
            }}
          >
            {featuredLabel ? (
              <div
                className="text-[10px] font-semibold uppercase"
                style={{ color: accent, letterSpacing: "0.18em" }}
              >
                {featuredLabel}
              </div>
            ) : null}
            {featuredValue ? (
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className="font-bold tracking-tight leading-none"
                  style={{ color: accent, fontSize: isDark ? "56px" : "40px" }}
                >
                  {featuredValue}
                </span>
                {featuredUnit ? (
                  <span
                    className="text-[16px] font-medium"
                    style={{ color: accent, opacity: 0.85 }}
                  >
                    {featuredUnit}
                  </span>
                ) : null}
              </div>
            ) : null}
            {featuredCaption ? (
              <div
                className="mt-1 text-[12px]"
                style={{
                  color: accent,
                  opacity: 0.75,
                }}
              >
                {featuredCaption}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Offer code chip */}
        {offerCode && position !== "TOP_BANNER" ? (
          <div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(offerCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* ignore */
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed px-3 py-1.5 text-sm font-mono font-semibold transition-colors hover:bg-black/[0.03]"
              style={{ borderColor: accent, color: resolvedText }}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" style={{ color: accent }} />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 opacity-60" />
                  {offerCode}
                </>
              )}
            </button>
          </div>
        ) : null}

        {/* Capture form OR CTA stack */}
        {captureEmail && position !== "TOP_BANNER" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              onSubmit?.({ email: email.trim(), phone: phone.trim() || undefined });
            }}
            className="space-y-2 pt-1"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                color: resolvedText,
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                ["--tw-ring-color" as string]: accent,
              }}
            />
            {capturePhone ? (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{
                  color: resolvedText,
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  ["--tw-ring-color" as string]: accent,
                }}
              />
            ) : null}
            <PrimaryCta
              text={ctaText}
              icon={primaryCtaIcon}
              accent={accent}
              dark={isDark}
              onClick={undefined}
              type="submit"
            />
          </form>
        ) : (
          <div
            className={cn(
              position === "TOP_BANNER" ? "shrink-0" : "space-y-2",
            )}
          >
            <PrimaryCta
              text={ctaText}
              icon={primaryCtaIcon}
              accent={accent}
              dark={isDark}
              onClick={onCtaClick}
              fullWidth={position !== "TOP_BANNER"}
            />
            {showSecondary ? (
              <button
                type="button"
                onClick={onSecondaryCtaClick ?? onCtaClick}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                  "w-full",
                )}
                style={{
                  background: "transparent",
                  color: resolvedText,
                  border: `1.5px solid ${isDark ? "rgba(255,255,255,0.4)" : resolvedText}`,
                }}
              >
                <IconFor icon={secondaryCtaIcon ?? null} />
                {secondaryCtaText}
              </button>
            ) : null}
          </div>
        )}

        {/* Tertiary dismiss link */}
        {showDismissLink ? (
          <button
            type="button"
            onClick={onDismiss}
            className="block w-full text-center text-[12px] font-medium transition-opacity"
            style={{
              color: resolvedMuted ?? resolvedText,
              opacity: isDark ? 1 : 0.5,
            }}
          >
            {dismissText}
          </button>
        ) : secondaryText && !showSecondary && position !== "TOP_BANNER" ? (
          // Backward compat — legacy `secondaryText` falls through to the
          // tertiary slot when neither dismissText nor secondaryCtaText is set.
          <button
            type="button"
            onClick={onDismiss}
            className="block w-full text-center text-xs font-medium opacity-50 hover:opacity-80 transition-opacity"
            style={{ color: resolvedText }}
          >
            {secondaryText}
          </button>
        ) : null}
      </div>
    </div>
  );

  // Position wrappers. `contained` collapses everything into a single
  // absolute container that fills the parent (the editor preview pane
  // does this). Full mode positions relative to the viewport.
  const posClass = contained ? "absolute" : "fixed";

  if (position === "CENTER") {
    return (
      <div className={cn("inset-0 z-50 flex items-center justify-center px-4", posClass)}>
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0",
            contained ? "bg-black/20" : "bg-black/40 backdrop-blur-sm",
          )}
          onClick={onDismiss}
        />
        <div className="relative">{card}</div>
      </div>
    );
  }

  if (position === "TOP_BANNER") {
    return <div className={cn("top-0 inset-x-0 z-50", posClass)}>{card}</div>;
  }

  const corner = position === "BOTTOM_RIGHT" ? "bottom-4 right-4" : "bottom-4 left-4";
  return (
    <div className={cn("z-50 max-w-[520px] w-[calc(100%-2rem)]", posClass, corner)}>
      {card}
    </div>
  );
}

function PrimaryCta({
  text,
  icon,
  accent,
  dark,
  onClick,
  fullWidth = true,
  type = "button",
}: {
  text: string;
  icon?: PopupPreviewIcon;
  accent: string;
  dark: boolean;
  onClick?: () => void;
  fullWidth?: boolean;
  type?: "button" | "submit";
}) {
  // Dark theme uses dark text on the (typically gold) accent button — that's
  // the Telegraph reference. Light themes keep the original white-on-accent.
  const fg = dark ? "#0F1729" : "#FFFFFF";
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-95",
        fullWidth ? "w-full" : "",
      )}
      style={{ backgroundColor: accent, color: fg }}
    >
      <span>{text || "Claim offer"}</span>
      <IconFor icon={icon} />
    </button>
  );
}
