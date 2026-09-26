// Carries the /pricing builder's feature picks into the onboarding features
// step. Clerk's forced sign-up redirect drops URL params, so this rides
// localStorage. Client-only; every call is a no-op on the server.

const KEY = "ls_pricing_intent";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function savePricingIntent(features: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ features, at: Date.now() }));
  } catch {
    // Storage blocked (private mode): onboarding falls back to recommended.
  }
}

/** Saved picks limited to `knownKeys`, or null when absent/stale/invalid. */
export function readPricingIntent(knownKeys: string[]): string[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { features?: unknown; at?: unknown };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > MAX_AGE_MS) {
      return null;
    }
    if (!Array.isArray(parsed.features)) return null;
    const known = new Set(knownKeys);
    const picked = parsed.features.filter(
      (k): k is string => typeof k === "string" && known.has(k),
    );
    return picked.length > 0 ? picked : null;
  } catch {
    return null;
  }
}
