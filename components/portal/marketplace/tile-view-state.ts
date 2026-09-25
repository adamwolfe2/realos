// ---------------------------------------------------------------------------
// Pure presentational mapping: catalog kind + org entitlement state ->
// status label, price text, and CTA state for one marketplace tile.
//
// Extracted so status and button can never disagree (the bug this fixes:
// concierge/addon tiles ignored `isEnabled` entirely and always rendered as
// "not active" with a checkout/request CTA, even for orgs where the org's
// own module flag is already true). No React, no fetch, no Stripe — table
// tested in __tests__/portal-marketplace-tile-status.test.ts.
//
// Status/price/CTA truth table (source of each input, see
// app/portal/marketplace/page.tsx + lib/marketplace/catalog.ts):
//   kind        | isEnabled source              | status when on | when off
//   ------------|--------------------------------|-----------------|----------
//   toggle      | org.module<X> boolean          | Active          | Not active (+"Popular")
//   included    | always true (no flag)          | Active (Included)| n/a
//   concierge   | org.module<X> boolean          | Active          | Not active (+"Guided setup")
//   addon       | org entitlement (often absent) | Active          | Not active (+"Pro add-on")
//   coming      | never                          | n/a             | Not active (+"Coming soon")
// ---------------------------------------------------------------------------

export type TileKind = "toggle" | "included" | "concierge" | "addon" | "coming";

export type TileStatus = "active" | "not_active";

export type TileCta =
  | { action: "open"; label: "Open" }
  | { action: "add"; label: "Add" }
  | { action: "request"; label: "Request setup" }
  | { action: "notify"; label: "Notified" | "Notify me"; disabled: boolean }
  | { action: "manage"; setupLabel: "Set up"; removeLabel: "Remove"; disabled: boolean }
  | { action: "activate"; label: "Activate" | "Unlock"; disabled: boolean };

export type TileViewState = {
  status: TileStatus;
  /** Secondary caption shown beside the status chip ("Popular", "Pro
      add-on", "Guided setup", "Coming soon") or null when there's none. */
  statusNote: string | null;
  /** Main price text: "Free", "Included free", "Coming soon", "Free during
      trial", "$99", or "from $249". Never includes the "/mo" suffix — that
      renders separately (smaller, muted) only when `priceSuffix` is set. */
  priceText: string;
  priceSuffix: "/mo" | null;
  /** "accent" = free/included eyebrow, "muted" = coming-soon eyebrow,
      "value" = a real dollar amount. */
  priceEmphasis: "accent" | "muted" | "value";
  cta: TileCta;
};

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function getTileViewState(input: {
  kind: TileKind;
  /** Whether the org already has this module/entitlement on. Ignored for
      "included" (always on) and "coming" (never activatable). */
  isEnabled: boolean;
  isTrialing: boolean;
  isPending: boolean;
  isNotified: boolean;
  popular: boolean;
  monthlyPriceCents: number;
}): TileViewState {
  const { kind, isEnabled, isTrialing, isPending, isNotified, popular, monthlyPriceCents } = input;

  if (kind === "coming") {
    return {
      status: "not_active",
      statusNote: "Coming soon",
      priceText: "Coming soon",
      priceSuffix: null,
      priceEmphasis: "muted",
      cta: { action: "notify", label: isNotified ? "Notified" : "Notify me", disabled: isNotified },
    };
  }

  if (kind === "included") {
    return {
      status: "active",
      statusNote: null,
      priceText: "Included free",
      priceSuffix: null,
      priceEmphasis: "accent",
      cta: { action: "open", label: "Open" },
    };
  }

  if (kind === "addon") {
    return {
      status: isEnabled ? "active" : "not_active",
      statusNote: isEnabled ? null : "Pro add-on",
      priceText: `+${formatPrice(monthlyPriceCents)}`,
      priceSuffix: "/mo",
      priceEmphasis: "value",
      cta: isEnabled ? { action: "open", label: "Open" } : { action: "add", label: "Add" },
    };
  }

  if (kind === "concierge") {
    return {
      status: isEnabled ? "active" : "not_active",
      statusNote: isEnabled ? null : "Guided setup",
      priceText: isEnabled
        ? formatPrice(monthlyPriceCents)
        : `from ${formatPrice(monthlyPriceCents)}`,
      priceSuffix: "/mo",
      priceEmphasis: "value",
      cta: isEnabled ? { action: "open", label: "Open" } : { action: "request", label: "Request setup" },
    };
  }

  // toggle
  if (isEnabled) {
    return {
      status: "active",
      statusNote: null,
      priceText: formatPrice(monthlyPriceCents),
      priceSuffix: "/mo",
      priceEmphasis: "value",
      cta: { action: "manage", setupLabel: "Set up", removeLabel: "Remove", disabled: isPending },
    };
  }
  return {
    status: "not_active",
    statusNote: popular ? "Popular" : null,
    priceText: isTrialing ? "Free during trial" : formatPrice(monthlyPriceCents),
    priceSuffix: isTrialing ? null : "/mo",
    priceEmphasis: isTrialing ? "accent" : "value",
    cta: { action: "activate", label: isTrialing ? "Activate" : "Unlock", disabled: isPending },
  };
}
