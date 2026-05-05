// ---------------------------------------------------------------------------
// Display helpers for AppFolio-synced rows.
//
// AppFolio's `tenant_directory` and `rent_roll` reports key off different
// IDs: tenant_directory rows are keyed by occupancy/management entities
// (often property-management LLCs) while rent_roll rows reference the
// actual occupant via `tenant_id`. As a result, most Lease rows can't be
// joined back to a Resident row, and `lease.resident` ends up null in the UI.
//
// The good news: rent_roll's `tenant` column is the human-readable display
// name (e.g. "Castillo, Marianne K." or "Marianne K. Castillo"), and we
// already persist the entire row under `lease.raw`. These helpers read it
// out and normalize "Last, First" → "First Last" so the renewals pipeline
// can show real names without a re-sync.
// ---------------------------------------------------------------------------

// Normalize "Last, First" → "First Last". Strings without a comma are
// returned as-is, with internal whitespace collapsed.
export function normalizeTenantName(s: string): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  const idx = trimmed.indexOf(",");
  if (idx === -1) return trimmed;
  const last = trimmed.slice(0, idx).trim();
  const first = trimmed.slice(idx + 1).trim();
  return first ? `${first} ${last}`.trim() : last;
}

// Read the tenant display name from an AppFolio row stored in `Lease.raw`
// or `Resident.raw`. rent_roll stores it under `tenant`; tenant_directory
// stores split first/last fields. Returns null when nothing usable exists
// so callers can chain into other fallbacks (email, "Resident", etc.).
export function tenantNameFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const candidate = r.tenant ?? r.tenant_name ?? r.name;
  if (Array.isArray(candidate)) {
    const first = candidate.find(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    if (first) return normalizeTenantName(first);
  } else if (typeof candidate === "string" && candidate.trim().length > 0) {
    return normalizeTenantName(candidate);
  }

  // Fall through to first_name / last_name pair (used by tenant_directory).
  const first = typeof r.first_name === "string" ? r.first_name.trim() : "";
  const last = typeof r.last_name === "string" ? r.last_name.trim() : "";
  const joined = `${first} ${last}`.trim();
  return joined.length > 0 ? joined : null;
}
