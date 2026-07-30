// Shared number-formatting helpers used across the /portal/reputation page
// and its extracted sub-components.

// Defensive number → display helper. Catches Decimal-typed values from
// Prisma (which lack `.toLocaleString` formatting consistent with Number)
// and stray nulls so a single bad row can't blank the whole page.
export function safeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === "object" && "toString" in v) {
    const n = Number((v as { toString: () => string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function fmtInt(v: unknown): string {
  return safeNum(v).toLocaleString();
}

export function fmtRating(v: unknown): string {
  if (v == null) return "—";
  const n = safeNum(v);
  return n > 0 ? n.toFixed(1) : "—";
}
