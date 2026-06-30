// Shared formatting helpers for the property Overview tab and its
// extracted sub-components. `formatAge` is used by PropertyHeroStrip,
// PropertyIntegrationsList, and OnboardingShellCard, so it lives here.
// `formatRentShort` was already in this module's source file; preserved
// verbatim.

export function formatAge(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatRentShort(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`;
  }
  return `$${dollars.toLocaleString()}`;
}
