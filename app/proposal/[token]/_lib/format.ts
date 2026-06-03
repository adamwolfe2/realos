// ---------------------------------------------------------------------------
// Display helpers for the public proposal share page. Server-only is NOT
// declared — these are pure functions and the share-page tree renders
// them on the server. Keeping them isomorphic lets a future client-side
// renderer reuse the same formatting.
// ---------------------------------------------------------------------------

export function formatCents(
  cents: number | null | undefined,
  currency = "usd",
): string {
  const safe = Number.isFinite(cents ?? NaN) ? Math.max(0, Math.floor(cents as number)) : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      // No fractional digits on whole dollars keeps the share page tidy; we
      // still print pennies when present (custom-priced lines, discounts).
      maximumFractionDigits: safe % 100 === 0 ? 0 : 2,
      minimumFractionDigits: safe % 100 === 0 ? 0 : 2,
    }).format(safe / 100);
  } catch {
    // Bad currency code — fall back to plain dollars rather than throwing.
    return `$${(safe / 100).toFixed(2)}`;
  }
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function cadenceLabel(cadence: "MONTHLY" | "ANNUAL" | null): string {
  if (cadence === "ANNUAL") return "/yr";
  if (cadence === "MONTHLY") return "/mo";
  return "";
}

export function cadenceWord(cadence: "MONTHLY" | "ANNUAL" | null): string {
  if (cadence === "ANNUAL") return "annual";
  if (cadence === "MONTHLY") return "monthly";
  return "recurring";
}
