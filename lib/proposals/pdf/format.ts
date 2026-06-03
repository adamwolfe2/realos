// ---------------------------------------------------------------------------
// Proposal PDF — formatters.
//
// Kept local — `Intl.NumberFormat` and `Intl.DateTimeFormat` are both
// available on the Vercel Node runtime. Cents-in, locale-aware string out.
// ---------------------------------------------------------------------------

export function formatMoney(cents: number, currency: string): string {
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Unknown currency code: fall through to USD-style print so the PDF
    // never errors mid-render.
    return `$${value.toFixed(2)}`;
  }
}

export function cadenceSuffix(cadence: "MONTHLY" | "ANNUAL" | null): string {
  if (cadence === "MONTHLY") return "/mo";
  if (cadence === "ANNUAL") return "/yr";
  return "";
}

export function cadenceWord(cadence: "MONTHLY" | "ANNUAL" | null): string {
  if (cadence === "MONTHLY") return "monthly";
  if (cadence === "ANNUAL") return "annual";
  return "one-time";
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}
