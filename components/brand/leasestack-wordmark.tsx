import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// LeaseStackWordmark — inline SVG building mark + serif wordmark text.
//
// The PNG at /public/logos/leasestack-wordmark.png is just the blue building
// icon (no text), and trying to recolor it via CSS filter produced the
// gold/orange complement we saw on the dark sign-in panel. This component
// renders the mark inline as SVG so it inherits text color via
// `currentColor`, plus pairs it with a wordmark text so the brand
// actually reads.
//
// Pass `tone="dark"` for use on light backgrounds (default) or
// `tone="light"` for dark surfaces. Override sizing via `className`.
// ---------------------------------------------------------------------------

type Props = {
  className?: string;
  tone?: "dark" | "light";
  /** Render the building mark only, without the wordmark text. */
  iconOnly?: boolean;
  /** Hide the building mark, render only the wordmark text. */
  wordOnly?: boolean;
};

export function LeaseStackWordmark({
  className,
  tone = "dark",
  iconOnly = false,
  wordOnly = false,
}: Props) {
  const colorClass = tone === "light" ? "text-white" : "text-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 leading-none",
        colorClass,
        className
      )}
      aria-label="LeaseStack"
    >
      {!wordOnly ? <BuildingMark /> : null}
      {!iconOnly ? (
        <span
          className="font-bold tracking-[-0.025em] text-[1.05em]"
          // The Fraunces serif was removed from the brand. Wordmark now
          // uses Inter (the canonical brand sans) so it matches the
          // marketing nav, pricing page, and portal chrome.
          style={{
            fontFamily:
              "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          LeaseStack
        </span>
      ) : null}
    </span>
  );
}

// Stylized building mark: five offset horizontal bars forming a stepped
// building silhouette. Coords match the original blue PNG icon at
// /public/logos/leasestack-wordmark.png so visual continuity is preserved.
// Filled with currentColor so the parent's text color drives the swatch.
function BuildingMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-[1.25em] w-auto shrink-0"
      fill="currentColor"
      aria-hidden="true"
      role="presentation"
    >
      {/* 5 horizontal slats, each shorter than the one above to suggest a
          stepped roofline. Bottom slat anchors the silhouette. */}
      <rect x="6" y="5" width="20" height="2.6" rx="0.4" />
      <rect x="6" y="9.5" width="18" height="2.6" rx="0.4" />
      <rect x="6" y="14" width="20" height="2.6" rx="0.4" />
      <rect x="6" y="18.5" width="16" height="2.6" rx="0.4" />
      <rect x="6" y="23" width="20" height="2.6" rx="0.4" />
      {/* Subtle ground line under the building */}
      <rect x="9" y="26.4" width="14" height="1.2" rx="0.3" opacity="0.55" />
    </svg>
  );
}
