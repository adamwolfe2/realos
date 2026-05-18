"use client";

import { useState } from "react";
import { X, Check, Copy } from "lucide-react";
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
// The component is intentionally pure — no network calls, no event
// dispatches. Wrappers handle "I dismissed" / "I clicked CTA" /
// "I submitted form" callbacks.
// ---------------------------------------------------------------------------

export type PopupPreviewProps = {
  headline: string;
  body: string;
  ctaText: string;
  offerCode?: string | null;
  secondaryText?: string | null;
  position: "CENTER" | "BOTTOM_RIGHT" | "BOTTOM_LEFT" | "TOP_BANNER";
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  heroImageUrl?: string | null;
  captureEmail?: boolean;
  capturePhone?: boolean;
  /**
   * When true, the preview shrinks to fit inside the editor card and
   * positions itself relative to its parent container instead of the
   * viewport. Off by default for the marketing demo + embed reference.
   */
  contained?: boolean;
  /** Wrapper-supplied handlers. */
  onDismiss?: () => void;
  onCtaClick?: () => void;
  onSubmit?: (data: { email: string; phone?: string }) => void;
};

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
    contained = false,
    onDismiss,
    onCtaClick,
    onSubmit,
  } = props;

  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // The card layer (the popup itself). Identical across positions so
  // the only thing that changes per-position is the wrapper.
  const card = (
    <div
      role="dialog"
      aria-modal={position === "CENTER"}
      aria-label={headline}
      className={cn(
        "relative overflow-hidden shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.06)]",
        position === "TOP_BANNER" ? "rounded-none" : "rounded-2xl",
        position === "TOP_BANNER" ? "w-full" : "w-full max-w-[420px]",
      )}
      style={{ backgroundColor }}
    >
      {/* Close button */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute top-2.5 right-2.5 z-10 inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
        style={{ color: textColor }}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {heroImageUrl && position !== "TOP_BANNER" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImageUrl}
          alt=""
          className="w-full h-32 object-cover"
        />
      ) : null}

      <div
        className={cn(
          "p-5",
          position === "TOP_BANNER"
            ? "flex items-center justify-between gap-4 py-3"
            : "space-y-3",
        )}
      >
        <div className={cn(position === "TOP_BANNER" ? "flex-1 min-w-0" : "")}>
          <h2
            className={cn(
              "font-semibold tracking-tight leading-snug",
              position === "TOP_BANNER" ? "text-base" : "text-xl",
            )}
            style={{ color: textColor }}
          >
            {headline || "Your headline goes here"}
          </h2>
          {position !== "TOP_BANNER" ? (
            <p
              className="mt-1 text-sm leading-relaxed"
              style={{ color: textColor, opacity: 0.78 }}
            >
              {body || "Tell visitors why they should claim this offer."}
            </p>
          ) : null}
        </div>

        {/* Offer code chip */}
        {offerCode ? (
          <div className={cn(position === "TOP_BANNER" ? "shrink-0" : "")}>
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
              style={{ borderColor: primaryColor, color: textColor }}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" style={{ color: primaryColor }} />
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

        {/* Optional capture form */}
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
              className="w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm placeholder:text-black/40 focus:outline-none focus:ring-2"
              style={{
                color: textColor,
                ["--tw-ring-color" as string]: primaryColor,
              }}
            />
            {capturePhone ? (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm placeholder:text-black/40 focus:outline-none focus:ring-2"
                style={{
                  color: textColor,
                  ["--tw-ring-color" as string]: primaryColor,
                }}
              />
            ) : null}
            <button
              type="submit"
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95"
              style={{ backgroundColor: primaryColor }}
            >
              {ctaText || "Claim offer"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={onCtaClick}
            className={cn(
              "rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95",
              position === "TOP_BANNER" ? "shrink-0" : "w-full",
            )}
            style={{ backgroundColor: primaryColor }}
          >
            {ctaText || "Claim offer"}
          </button>
        )}

        {secondaryText && position !== "TOP_BANNER" ? (
          <button
            type="button"
            onClick={onDismiss}
            className="block w-full text-center text-xs font-medium opacity-50 hover:opacity-80 transition-opacity"
            style={{ color: textColor }}
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
  const posClass = contained
    ? "absolute"
    : "fixed";

  if (position === "CENTER") {
    return (
      <div className={cn("inset-0 z-50 flex items-center justify-center px-4", posClass)}>
        <div
          aria-hidden="true"
          className={cn("absolute inset-0", contained ? "bg-black/20" : "bg-black/40 backdrop-blur-sm")}
          onClick={onDismiss}
        />
        <div className="relative">{card}</div>
      </div>
    );
  }

  if (position === "TOP_BANNER") {
    return (
      <div className={cn("top-0 inset-x-0 z-50", posClass)}>{card}</div>
    );
  }

  // BOTTOM_RIGHT / BOTTOM_LEFT — slide-in toast
  const corner =
    position === "BOTTOM_RIGHT"
      ? "bottom-4 right-4"
      : "bottom-4 left-4";
  return (
    <div className={cn("z-50 max-w-[420px] w-[calc(100%-2rem)]", posClass, corner)}>
      {card}
    </div>
  );
}
